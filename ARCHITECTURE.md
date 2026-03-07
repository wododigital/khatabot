# KhataBot - System Architecture

## 1. System Overview

KhataBot is a monorepo deployed as two Railway services that share a single Supabase instance. The bot service is a long-running Node.js process (Baileys + AI pipeline). The web service is a Next.js 14 App Router application. They are completely decoupled at the process level and communicate only through the database.

---

## 2. Full Data Flow Diagram

```
INBOUND PATH (WhatsApp -> Supabase)
=====================================

WhatsApp Network
     |
     | (linked device protocol, encrypted)
     v
+--------------------+
|   Baileys Client   |  src/bot/index.ts
|   (Railway svc 2)  |  - Maintains WebSocket to WA servers
|                    |  - Emits "messages.upsert" events
+--------------------+
     |
     | message event (WAMessage object)
     v
+--------------------+
|  Message Listener  |  src/bot/listener.ts
|                    |  - Receives all group messages
|                    |  - Extracts: group JID, sender JID,
|                    |    message ID, timestamp, content type
+--------------------+
     |
     | {groupJid, messageId, type, text?, imageData?}
     v
+--------------------+
|  Message Router    |  src/services/message-router.ts
|                    |  GATE 1: Is group registered + active?
|                    |    -> NO: drop silently
|                    |  GATE 2: Is message type processable?
|                    |    -> sticker/reaction/link-only: drop
|                    |    -> text or image: continue
|                    |  GATE 3: Dedup check
|                    |    -> wa_message_id in DB: drop
+--------------------+
     |
     | {groupRecord, messageId, text?, imageBuffer?, caption?}
     v
+--------------------+
|   Media Handler    |  src/bot/media.ts
|                    |  - If image: download via Baileys
|                    |  - Convert to base64 for Claude
|                    |  - Keep buffer in memory (not disk)
+--------------------+
     |
     | {text?, base64Image?, mimeType?, caption?}
     v
+--------------------+
|    AI Parser       |  src/services/ai-parser.ts
|                    |  - Builds multimodal Claude request
|                    |  - Text: sends as user text content
|                    |  - Image: sends as base64 image block
|                    |    + caption as text block
|                    |  - Calls Claude Haiku 4.5 Vision API
|                    |  - Parses JSON response
|                    |  - Validates schema with Zod
+--------------------+
     |
     | ClaudeResult {is_transaction, amount, person,
     |   purpose, payment_mode, txn_id, date, confidence}
     v
+--------------------+
|  Result Filter     |  (inline in ai-parser.ts)
|                    |  - is_transaction = false -> drop
|                    |  - confidence < 0.5 -> drop
|                    |  - JSON parse error -> log + drop
+--------------------+
     |
     | validated ClaudeResult
     v
+--------------------+
| Contact Matcher    |  src/services/contact-matcher.ts
|                    |  - Loads contacts + aliases from DB
|                    |  - Fuzzy match person_name
|                    |    (Levenshtein / trigram similarity)
|                    |  - Returns contact_id or null
+--------------------+
     |
     v
+--------------------+
|  Data Enrichment   |  src/services/transaction-saver.ts
|                    |  - category <- group.category
|                    |  - txn_date <- extracted date
|                    |    OR message timestamp
|                    |  - If image: upload to Supabase Storage
|                    |    at path receipts/{year}/{month}/{uuid}
+--------------------+
     |
     | TransactionInsert + optional StoragePath
     v
+--------------------+
|  Supabase Client   |  src/lib/supabase/client.ts
|  (service role)    |  - Bypasses RLS (bot writes as service)
|                    |  - INSERT transactions
|                    |  - INSERT attachments (if image)
+--------------------+
     |
     v
+---------------------------+
|      Supabase             |
|  PostgreSQL               |
|  - transactions           |
|  - attachments            |
|  - groups                 |
|  - contacts               |
|  - bot_sessions           |
|  - user_profiles          |
|                           |
|  Storage                  |
|  - receipts bucket        |
+---------------------------+


OUTBOUND PATH (Supabase -> Dashboard)
=======================================

Supabase PostgreSQL
     |
     | Supabase Realtime (postgres_changes)
     | - INSERT on transactions table
     | - UPDATE on transactions table
     v
+--------------------+
|  Next.js Client    |  src/app/* (browser)
|  Realtime Hook     |  - useEffect subscribes to channel
|                    |  - On INSERT: prepend to local state
|                    |  - On UPDATE: patch existing row
|                    |  - Shows toast: "New transaction added"
+--------------------+
     |
     v
+--------------------+
| React State        |  - useState / useReducer in page
|                    |  - Filters applied client-side
|                    |    for performance on small datasets
|                    |  - Server-fetched on initial load
|                    |    via Server Components (RSC)
+--------------------+
```

---

## 3. Service Boundaries

```
+============================================================+
|  RAILWAY SERVICE 1: khatabot-web                          |
|  Process: Next.js (npm run start)                         |
|  Port: 3000                                               |
|                                                            |
|  Responsibilities:                                         |
|  - Serve dashboard UI (App Router pages)                  |
|  - Handle Supabase Auth session (cookies)                 |
|  - CRUD API routes for dashboard actions                  |
|  - Serve QR code endpoint (/api/qr)                       |
|  - Serve bot status endpoint (/api/bot-status)            |
|  - Read-only DB queries with anon key (RLS enforced)      |
|                                                            |
|  Does NOT:                                                 |
|  - Run Baileys (no WhatsApp connection)                   |
|  - Call Claude API (AI is bot-only concern)               |
|  - Write transactions (dashboard edits go via API routes  |
|    which use service role only for deletes, anon for rest)|
+============================================================+

+============================================================+
|  RAILWAY SERVICE 2: khatabot-bot                          |
|  Process: npx tsx scripts/start-bot.ts                    |
|  No public port (internal process only)                   |
|                                                            |
|  Responsibilities:                                         |
|  - Maintain Baileys WebSocket connection                  |
|  - Load/save session from bot_sessions table              |
|  - Classify incoming messages                             |
|  - Download media from WhatsApp                           |
|  - Call Claude API for AI extraction                      |
|  - Upload images to Supabase Storage                      |
|  - Write transactions + attachments to DB                 |
|  - Deduplication checks                                   |
|  - Contact fuzzy matching                                 |
|                                                            |
|  Does NOT:                                                 |
|  - Serve HTTP (no web server)                             |
|  - Send WhatsApp messages (read-only)                     |
|  - Handle auth sessions                                   |
|  - Serve dashboard UI                                     |
+============================================================+

+============================================================+
|  EXTERNAL: Supabase (managed, not Railway)                |
|                                                            |
|  Responsibilities:                                         |
|  - PostgreSQL (primary data store)                        |
|  - Auth (magic link / email-password sessions)            |
|  - Storage (receipt images bucket)                        |
|  - Realtime (pushes DB changes to dashboard browser)      |
|  - Row-Level Security enforcement                         |
|                                                            |
|  Two client contexts:                                      |
|  - anon key: dashboard browser, RLS enforced              |
|  - service role key: bot process, bypasses RLS            |
+============================================================+

+============================================================+
|  EXTERNAL: Anthropic Claude API                           |
|                                                            |
|  Used exclusively by: khatabot-bot service                |
|  Model: claude-haiku-4-5 (vision capable)                 |
|  Call pattern: one API call per processable message       |
|  Input: text OR base64 image + optional caption text      |
|  Output: structured JSON (validated with Zod)             |
+============================================================+
```

---

## 4. Message Processing Pipeline (Detailed)

```
Step 1 - RECEIVE
  Baileys emits "messages.upsert" event
  Payload: { messages: WAMessage[], type: "notify" | "append" }

  Filters applied immediately:
  - type must be "notify" (new message, not history sync)
  - message.key.fromMe must be false (ignore own messages)
  - message.key.remoteJid must end with "@g.us" (group only)

  Extracted fields:
    groupJid     = message.key.remoteJid
    messageId    = message.key.id
    senderJid    = message.key.participant
    timestamp    = message.messageTimestamp (Unix seconds)
    messageObj   = message.message


Step 2 - CLASSIFY
  Determine content type from messageObj:

  IGNORE types (drop silently, no DB write):
  - stickerMessage
  - reactionMessage
  - protocolMessage (message delete/edit notifications)
  - messageContextInfo only (no content)
  - extendedTextMessage where text is a bare URL (no context)
  - pollCreationMessage

  PROCESSABLE types:
  - conversation (plain text)
  - extendedTextMessage (text with link preview, use text field)
  - imageMessage (image, may have caption)
  - documentMessage with image mimetype (PDF treated as skip)

  Classification result:
    { type: "text" | "image" | "ignore", text?, hasImage? }


Step 3 - GATE CHECKS (fast, sequential, cheap)

  Gate A - Group registered?
    Query: SELECT id, category, is_active FROM groups
           WHERE wa_group_jid = $groupJid
    - Not found OR is_active = false: drop
    - Found + active: continue with groupRecord

  Gate B - Duplicate check?
    Query: SELECT id FROM transactions
           WHERE wa_message_id = $messageId LIMIT 1
    - Row found: drop (already processed)
    - No row: continue

  Both gates use the service role Supabase client.
  No Claude API is called before passing both gates.


Step 4 - MEDIA DOWNLOAD (image messages only)
  Call Baileys downloadMediaMessage(message)
  Returns: Buffer
  Convert: Buffer.from(buffer).toString('base64')
  Capture: message.message.imageMessage.mimetype

  Error handling:
  - If download fails: log error, fall back to caption-only
    (treat as text message with caption as the text)
  - Never block transaction insertion for a media failure


Step 5 - AI EXTRACTION
  Build Claude request:
    model: "claude-haiku-4-5"
    max_tokens: 300
    system: [extraction system prompt from src/lib/ai/prompts.ts]
    messages: [{
      role: "user",
      content: [
        // Always present if text or caption exists:
        { type: "text", text: textContent },
        // Present only if image was downloaded:
        { type: "image", source: {
            type: "base64",
            media_type: mimeType,
            data: base64String
        }}
      ]
    }]

  Response handling:
    rawJson = response.content[0].text
    parsed = JSON.parse(rawJson)        // may throw
    validated = ClaudeOutputSchema.parse(parsed)  // Zod

  Drop conditions (no DB write):
    - JSON.parse throws -> log malformed response, drop
    - Zod parse fails -> log schema mismatch, drop
    - validated.is_transaction === false -> drop silently
    - validated.confidence < 0.5 -> drop silently

  Continue conditions:
    - is_transaction === true AND confidence >= 0.5


Step 6 - ENRICH + SAVE

  6a. Contact matching
    Load all contacts + aliases from cache
    (contacts cached in memory, refreshed every 5 minutes)
    Run fuzzy match against validated.person
    Result: contactId (uuid) or null

  6b. Date resolution
    if validated.date is a valid ISO date string:
      txn_date = validated.date
    else:
      txn_date = new Date(timestamp * 1000).toISOString().split('T')[0]

  6c. Image upload (if image was present)
    path = receipts/{yyyy}/{mm}/{uuid}.{ext}
    supabase.storage.from('receipts').upload(path, buffer)
    storagePath = path (saved to attachments row)

  6d. Transaction insert
    INSERT INTO transactions (
      group_id, contact_id, amount, person_name,
      purpose, category, payment_mode, txn_id,
      txn_date, confidence, raw_message, wa_message_id
    ) VALUES (...)
    RETURNING id

  6e. Attachment insert (if image)
    INSERT INTO attachments (
      transaction_id, storage_path, file_type, original_filename
    ) VALUES (...)

  6f. Dedup safety net - txn_id uniqueness
    If Claude extracted a txn_id AND a row with that txn_id
    already exists: skip insert, log as duplicate UPI txn_id.
    This catches forwarded payment confirmations.
```

---

## 5. Database Relationship Model

```
+------------------+          +------------------+
|     groups       |          |     contacts     |
+------------------+          +------------------+
| id (PK)          |          | id (PK)          |
| wa_group_jid     |          | name             |
| name             |          | aliases text[]   |
| category         |          | phone            |
| is_active        |          | role             |
| created_at       |          | notes            |
| updated_at       |          | created_at       |
+------------------+          | updated_at       |
         |                    +------------------+
         | 1                           | 1
         |                             |
         | N                           | N (nullable)
         v                             v
+------------------------------------------------+
|                  transactions                  |
+------------------------------------------------+
| id (PK)                                        |
| group_id (FK -> groups.id, SET NULL on delete) |
| contact_id (FK -> contacts.id, nullable)       |
| amount numeric(12,2)                           |
| person_name text           <- raw AI output    |
| purpose text                                   |
| category text              <- copied from group |
| payment_mode text                              |
| txn_id text                <- UPI/bank ref     |
| txn_date date                                  |
| notes text                                     |
| confidence numeric(3,2)                        |
| raw_message text           <- original WA text  |
| wa_message_id text UNIQUE  <- dedup key        |
| is_edited boolean                              |
| is_deleted boolean         <- soft delete      |
| created_at timestamptz                         |
| updated_at timestamptz                         |
+------------------------------------------------+
                    | 1
                    |
                    | N (cascade delete)
                    v
+------------------+
|   attachments    |
+------------------+
| id (PK)          |
| transaction_id   |  FK -> transactions.id
| storage_path     |  Supabase Storage path
| file_type        |  image/jpeg, image/png
| original_filename|
| created_at       |
+------------------+

+------------------+
|   bot_sessions   |  (isolated, no FK relationships)
+------------------+
| id (PK)          |
| session_id text  |  "khatabot-primary"
| creds jsonb      |  Baileys credentials
| keys jsonb       |  Baileys pre-keys + sessions
| created_at       |
| updated_at       |
+------------------+

+------------------+
|  user_profiles   |  (extends auth.users)
+------------------+
| id (PK, FK ->    |
|   auth.users.id) |
| phone_number     |
| display_name     |
| created_at       |
| updated_at       |
+------------------+

Cardinality summary:
  group -> transactions      : 1-to-many
  contact -> transactions    : 1-to-many (nullable)
  transaction -> attachments : 1-to-many (usually 0 or 1)
  bot_sessions               : standalone (no relations)
  user_profiles              : standalone (1-to-1 with auth.users)

Indexes that matter most:
  transactions.wa_message_id  - UNIQUE, used in dedup gate (Step 3B)
  transactions.txn_id         - for UPI dedup safety net
  transactions.txn_date       - for date-range dashboard filters
  transactions.is_deleted     - filtered out on every dashboard query
  transactions.group_id       - for group-based filtering
  groups.wa_group_jid         - looked up on every message (Step 3A)
```

---

## 6. Error Handling Strategy

### 6.1 Claude API Failures

```
Scenario: Claude API returns 5xx or network timeout

Behavior:
  - Catch error in ai-parser.ts
  - Log: { messageId, groupJid, error, timestamp }
  - Do NOT retry immediately (avoid thundering herd on outages)
  - Return { shouldSave: false, reason: "claude_api_error" }
  - Message is DROPPED for this run

Why not queue for retry?
  MVP has ~10 messages/day. The cost of an occasional missed
  transaction is lower than the complexity of a retry queue.
  A failed message can be manually re-entered on the dashboard.

Future enhancement (post-MVP):
  Add a failed_messages table. If Claude fails, insert the
  raw message there with status "pending_retry". A cron
  (Supabase pg_cron or Railway cron) retries daily.

Scenario: Claude returns unparseable JSON

Behavior:
  - Log the raw response string for debugging
  - Drop message silently
  - This usually means Claude added markdown fencing (```json)
  - Fix: prompt instructs "ONLY valid JSON, nothing else"
  - Add a JSON.parse fallback that strips markdown fencing
```

### 6.2 Duplicate Messages

```
Layer 1 - wa_message_id UNIQUE constraint
  The DB column has a UNIQUE constraint. Even if the
  application-level Gate B check is bypassed by a race
  condition (two messages arrive within milliseconds),
  the INSERT will throw a unique violation. Catch this
  error specifically and drop silently.

Layer 2 - txn_id dedup
  If Claude extracts a txn_id (UPI/NEFT reference):
    SELECT id FROM transactions WHERE txn_id = $txnId
    If found: drop with log "duplicate txn_id"
  Handles forwarded payment screenshots.

Layer 3 - soft heuristic window (P2, not MVP)
  If same amount + same person_name within 5 minutes:
    Mark as confidence_flag = "possible_duplicate"
    Insert anyway but surface in dashboard review queue
  This avoids false drops when someone legitimately pays
  the same person twice in quick succession.

Race condition during bot restart:
  Baileys re-delivers history on reconnect (type="append").
  The listener must filter: only process type="notify".
  History sync events have type="append" - these are IGNORED.
```

### 6.3 Media Download Failures

```
Scenario: Baileys fails to download an image

Behavior:
  - Log the error with messageId
  - Check if the image message has a caption
  - If caption exists: process caption as text-only message
  - If no caption: drop silently (image-only with no text,
    nothing useful to extract without the image)
  - Never block the pipeline for a media failure

Scenario: Supabase Storage upload fails

Behavior:
  - Log the storage error
  - Proceed with transaction INSERT anyway (without attachment)
  - The transaction is still saved without an image link
  - User can manually note the missing attachment
  - Do NOT fail the whole transaction for a storage failure
```

### 6.4 Database Write Failures

```
Scenario: Supabase INSERT fails (network, constraint, etc.)

Behavior:
  - Catch error in transaction-saver.ts
  - Log full error: { error, transactionData, messageId }
  - If it is a UNIQUE violation on wa_message_id: drop silently
  - If it is any other error: log as ERROR level, drop
  - No crash of the bot process

Bot process crash recovery:
  - Railway restartPolicyType = "always"
  - Bot restarts automatically
  - Baileys session loaded from bot_sessions on startup
  - Duplicate protection ensures re-delivered messages
    during restart window are not double-inserted
```

### 6.5 Group Not Registered

```
Scenario: Message arrives from a WhatsApp group that is not
in the groups table (or is_active = false)

Behavior:
  - Drop silently with no log entry
  - This is the normal case for groups the user joined
    for other purposes (family, friends, etc.)
  - Logging would create noise at ~10-50x transaction volume

How to register a new group:
  - Dashboard "Groups" page shows discovered_groups (future)
  - OR user adds the group JID manually on the Groups page
  - Once added with is_active = true, bot starts processing
```

---

## 7. Session Persistence (Baileys on Railway)

### The Problem

Railway deploys destroy the local filesystem on every redeploy.
Baileys by default stores its auth credentials in a local folder
(.auth_info_baileys). If this is wiped, the bot is "unlinked"
from WhatsApp and must scan a QR code again to reconnect.

### The Solution: Supabase as Session Store

```
src/bot/session-store.ts implements the Baileys
IAuthStateProvider interface backed by Supabase:

  useDatabaseAuthState(sessionId: string) -> {
    state: AuthenticationState,
    saveCreds: () => Promise<void>
  }

How it works:

  On startup:
    1. Query bot_sessions WHERE session_id = 'khatabot-primary'
    2. If row exists: deserialize creds + keys, pass to Baileys
    3. If no row: Baileys generates new creds, shows QR code
    4. User scans QR on WhatsApp (Settings -> Linked Devices)
    5. saveCreds() is called automatically by Baileys after scan
    6. UPSERT bot_sessions SET creds = $creds, keys = $keys

  On every key update (frequent during active sessions):
    Baileys calls saveCreds()
    -> UPSERT bot_sessions WHERE session_id = 'khatabot-primary'

  On Railway restart:
    Railway starts new container (empty filesystem)
    Bot calls useDatabaseAuthState('khatabot-primary')
    Row found in Supabase -> session restored
    Bot reconnects without QR scan (< 5 seconds)

  Storage structure in bot_sessions:
    creds: {
      noiseKey, signedIdentityKey, signedPreKey,
      registrationId, advSecretKey, nextPreKeyId,
      firstUnuploadedPreKeyId, serverHasPreKeys,
      account, me, signalIdentities, myAppStateKeyId,
      firstUnuploadedPreKeyId, accountSettings, ...
    }
    keys: {
      pre-key:0, pre-key:1, ...,    (pre-key store)
      session:jid1, session:jid2,  (signal sessions)
      app-state-sync-key:xxx,      (WA state keys)
      ...
    }

  Note on key volatility:
    Baileys updates keys on every message exchange.
    The keys JSONB object is large (~50-200KB) and written
    frequently. This is within Supabase free tier limits but
    should be monitored. At >1000 messages/day, consider
    using Redis for keys with Supabase only for creds.
```

### QR Re-scan Flow

```
If session is lost (user unlinked the device on phone):

  1. Bot fails to reconnect, Baileys emits "connection.update"
     with DisconnectReason.loggedOut
  2. Bot deletes the bot_sessions row for 'khatabot-primary'
  3. Bot calls makeInMemoryStore() + fresh makeWASocket()
  4. New QR code is generated and stored in memory
  5. GET /api/qr on the web service reads QR from shared state

  How web service reads QR from bot service:
    They share Supabase -> use bot_sessions table
    Add a qr_code TEXT column to bot_sessions
    Bot writes base64 QR there, web service reads it
    QR expires in 20 seconds, column is cleared after scan

  QR endpoint:
    GET /api/qr
    Returns: { qr: "data:image/png;base64,...", expires_at: "..." }
    Or: { status: "connected" } if already linked
```

---

## 8. Dashboard State Management

### Philosophy

The dataset is small (300 transactions/month). Favor simplicity
over complex client-side state management. Use Server Components
for initial render, Supabase Realtime only for live updates.

### Initial Load

```
Page: /transactions (Server Component)

  Server side (RSC):
    const supabase = createServerClient(cookies())
    const { data } = await supabase
      .from('transactions')
      .select('*, groups(name, category), attachments(*)')
      .eq('is_deleted', false)
      .order('txn_date', { ascending: false })
      .range(0, 49)  // first 50 rows

  Pass as prop to TransactionTable (Client Component)
  No loading spinner on first paint - data arrives pre-rendered
```

### Live Updates via Supabase Realtime

```
TransactionTable (Client Component):

  useEffect(() => {
    const channel = supabase
      .channel('transactions-live')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
        filter: 'is_deleted=eq.false'
      }, (payload) => {
        // Prepend new transaction to local state
        setTransactions(prev => [payload.new, ...prev])
        toast.success(`New: ${payload.new.person_name} - ₹${payload.new.amount}`)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions'
      }, (payload) => {
        // Patch the updated row in local state
        setTransactions(prev =>
          prev.map(t => t.id === payload.new.id ? payload.new : t)
        )
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])
```

### Realtime vs Polling Decision

```
USE REALTIME for:
  - New transaction notifications (bot just processed a message)
  - Edit updates (user edits on another tab/device)

USE POLLING for:
  - Bot status (connected/disconnected)
    Rationale: Bot status changes infrequently, Realtime on
    bot_sessions adds complexity. Poll /api/bot-status every 30s.

  - Summary card totals (today/week/month spend)
    Rationale: Realtime INSERT event triggers a client-side
    recalculation: just add payload.new.amount to the relevant
    period total. No polling needed.

DO NOT use Realtime for:
  - Attachment data (joins not supported in Realtime payloads)
    On INSERT event, fetch full transaction with attachments
    via a separate query if the new transaction is expanded.
```

### Filter State

```
Filters are client-side state only (no URL params for MVP):

  interface FilterState {
    dateRange: { from: Date | null, to: Date | null }
    category: string | null   // "home" | "personal" | "company"
    paymentMode: string | null
    personSearch: string      // substring match on person_name
    minAmount: number | null
    maxAmount: number | null
    showDeleted: boolean       // default false
  }

Filtering is done client-side with Array.filter() on the
loaded dataset. For MVP (< 500 rows per month loaded), this
is fast enough. If data grows, move filters to server-side
query params with router.push() to trigger RSC re-fetch.
```

---

## 9. API Boundaries

### Bot Service - No HTTP Server

The bot service has no HTTP server. All its operations are
outbound (to Supabase, to Claude API). Dashboard reads bot
state indirectly through Supabase.

### Web Service API Routes

```
GET  /api/bot-status
  Purpose: Dashboard status indicator
  Returns: { status: "connected"|"disconnected"|"qr_pending",
             lastMessageAt: ISO string | null,
             sessionId: string }
  Implementation: Read bot_sessions table updated_at.
    If updated_at < 5 minutes ago: "connected"
    If qr_code column is non-null: "qr_pending"
    Else: "disconnected"
  Auth: Supabase session cookie required

GET  /api/qr
  Purpose: Display QR code for WhatsApp linking
  Returns: { qr: "data:image/png;base64,...",
             expiresAt: ISO string }
  Or:      { status: "connected" }
  Implementation: Read qr_code from bot_sessions table
  Auth: Supabase session cookie required

PATCH /api/transactions/[id]
  Purpose: Edit a transaction from dashboard
  Body: Partial<Transaction> (any editable fields)
  Implementation:
    - Validate body with Zod
    - Set is_edited = true, updated_at = now()
    - UPDATE transactions WHERE id = $id
  Auth: Supabase session cookie required
  Note: Use Supabase client with anon key + RLS,
        not service role (user should own this action)

DELETE /api/transactions/[id]
  Purpose: Soft delete
  Implementation: UPDATE SET is_deleted = true
  Auth: Supabase session cookie required

GET /api/transactions/export
  Purpose: CSV export
  Query params: Same as filter state
  Returns: text/csv with Content-Disposition header
  Implementation: Server-side Supabase query -> csv-stringify

POST /api/groups
  Purpose: Register a new WhatsApp group
  Body: { wa_group_jid, name, category }
  Auth: Supabase session cookie required

PATCH /api/groups/[id]
  Purpose: Toggle is_active, rename, recategorize
  Auth: Supabase session cookie required

POST /api/contacts
  Purpose: Add a known contact
  Body: { name, aliases, phone, role, notes }
  Auth: Supabase session cookie required
```

### Supabase Direct Queries (no API route needed)

```
These are called directly from Client Components using the
anon key Supabase client (RLS enforced):

  supabase.from('transactions').select(...)  -> list page
  supabase.from('groups').select(...)        -> groups page
  supabase.from('contacts').select(...)      -> contacts page
  supabase.from('transactions')
    .rpc('get_monthly_summary', { month_date })  -> reports

No API route proxy needed for reads - the anon key + RLS
provides appropriate access control.
```

---

## 10. Multi-User Scalability Design

The MVP is single-user. These are the specific design decisions
that make multi-user support addable without a schema rewrite.

### What needs to change for multi-user

```
Current state (single-user):
  All rows in groups, contacts, transactions are implicitly
  owned by "the one user". RLS just checks authenticated role.

What to add for multi-user:

  1. Add user_id column to groups, contacts, transactions:
     ALTER TABLE groups ADD COLUMN user_id UUID
       REFERENCES auth.users(id) DEFAULT auth.uid();
     (Same for contacts, transactions)

  2. Update RLS policies:
     DROP POLICY "users_can_read_groups" ON groups;
     CREATE POLICY "users_own_groups" ON groups
       FOR ALL USING (user_id = auth.uid());

  3. Bot service identifies which user a group belongs to:
     The groups table maps wa_group_jid -> user_id.
     Bot looks up the group to get both category AND user_id.
     Transaction is inserted with that user_id.

  4. Multiple bot sessions:
     Add user_id to bot_sessions.
     Each user has their own WhatsApp number linked.
     Bot service runs one Baileys socket per active user
     (or one process per user using Railway replicas).

  5. Billing:
     Each user has a plan that limits transaction count or
     API call volume (same pattern as OMG Bridge).

The schema is designed to support this with minimal migration.
The main engineering cost is the bot architecture change from
single-socket to multi-socket, which requires careful memory
management on Railway.
```

---

## 11. Technology Decision Rationale

```
Baileys over whatsapp-web.js:
  - No Puppeteer / Chrome required
  - Railway free tier does not support headless Chrome reliably
  - Baileys is lighter, faster to start (~2s vs ~15s for WA Web)
  - Trade-off: Baileys is unofficial, can break on WA protocol
    changes. Monitor the Baileys repo for updates.

Haiku 4.5 over Sonnet for parsing:
  - Structured JSON extraction is not a reasoning task
  - Haiku is 3-5x cheaper per token
  - Vision capability is present in Haiku 4.5
  - Latency is lower (~1s vs ~3s), which matters for throughput
    if transaction volume grows
  - Fall back to Sonnet only if Haiku accuracy is insufficient

Single Claude call for OCR + parsing:
  - Eliminates a separate Tesseract/Google Vision OCR step
  - Claude handles messy handwriting, mixed Hindi+English text,
    partial UPI screenshot crops, and varied receipt formats
  - Prompt engineering is the only lever for accuracy tuning

Supabase over raw PostgreSQL:
  - Realtime built in (no separate Pusher/Ably subscription)
  - Storage built in (no separate S3 setup)
  - Auth built in (no custom JWT system needed)
  - Free tier is sufficient for MVP volume
  - RLS provides data isolation without application code

Monorepo (bot + web in one Next.js project):
  - Shared TypeScript types prevent drift between services
  - Single Railway repo with two service configs
  - Shared Supabase client code in src/lib/supabase/
  - Simpler for solo developer - one package.json, one tsconfig
  - Trade-off: bot startup time is slightly slower (Next.js
    build artifacts present). Mitigated by tsx for bot entry.
```

---

## 12. File-to-Responsibility Map

```
src/bot/index.ts
  - Baileys socket initialization
  - Connection event handler (qr, open, close, update)
  - Write QR to bot_sessions.qr_code
  - Call listener.ts on messages.upsert

src/bot/listener.ts
  - Filter notify vs append
  - Extract groupJid, messageId, senderJid, timestamp
  - Determine content type (text / image / ignore)
  - Hand off to message-router.ts

src/bot/session-store.ts
  - useDatabaseAuthState() implementing Baileys IAuthState
  - UPSERT to bot_sessions on saveCreds()
  - SELECT from bot_sessions on startup

src/bot/media.ts
  - downloadMediaMessage() wrapper
  - Returns { buffer, base64, mimeType }
  - Handles download failures gracefully

src/services/message-router.ts
  - Gate A: group lookup (groups table)
  - Gate B: dedup check (transactions.wa_message_id)
  - Orchestrates media download -> AI parse -> save

src/services/ai-parser.ts
  - Builds Claude API request (text or multimodal)
  - Calls Anthropic SDK
  - Parses + Zod-validates JSON response
  - Returns ClaudeResult or null (drop signal)

src/services/transaction-saver.ts
  - Uploads image to Supabase Storage
  - Inserts transaction row
  - Inserts attachment row
  - Handles unique violations gracefully

src/services/contact-matcher.ts
  - Loads contacts + aliases (memory cache, 5-min TTL)
  - Fuzzy match person string
  - Returns contactId or null

src/services/dedup.ts
  - checkWaMessageId(id) -> boolean
  - checkTxnId(txnId) -> boolean
  - Future: soft heuristic window check

src/lib/supabase/client.ts
  - createBrowserClient() for dashboard (anon key)
  - createServerClient(cookies) for RSC (anon key + RLS)
  - createServiceClient() for bot (service role, bypasses RLS)

src/lib/supabase/queries.ts
  - getGroupByJid(jid)
  - getTransactionsByDateRange(from, to, filters)
  - getMonthlySummary(month)
  - upsertBotSession(sessionId, creds, keys)

src/lib/supabase/storage.ts
  - uploadReceipt(buffer, path) -> storagePath
  - getReceiptUrl(path) -> signed URL (1 hour TTL)

src/lib/ai/claude.ts
  - Anthropic SDK client singleton
  - extractTransaction(input: TextInput | ImageInput) -> ClaudeResult

src/lib/ai/prompts.ts
  - EXTRACTION_SYSTEM_PROMPT (the prompt from PRD section 7)
  - Versioned so prompt changes are trackable

src/app/api/bot-status/route.ts
  - GET: reads bot_sessions, returns connection state

src/app/api/qr/route.ts
  - GET: reads bot_sessions.qr_code, returns base64 PNG

src/app/api/transactions/[id]/route.ts
  - PATCH: edit transaction fields, set is_edited = true
  - DELETE: soft delete, set is_deleted = true

src/app/api/transactions/export/route.ts
  - GET: server-side query -> CSV response

src/app/(dashboard)/transactions/page.tsx
  - RSC: initial data load (50 rows)
  - Client component: filter state, Realtime subscription

scripts/start-bot.ts
  - Entry point for Railway bot service
  - Imports src/bot/index.ts
  - Handles process signals (SIGTERM for graceful shutdown)
```

---

## 13. Deployment Checklist

```
Environment variables (both services share these):
  NEXT_PUBLIC_SUPABASE_URL          - Supabase project URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY     - Dashboard read access
  SUPABASE_SERVICE_ROLE_KEY         - Bot write access (secret)
  ANTHROPIC_API_KEY                 - Claude API (bot only)
  BOT_SESSION_ID                    - "khatabot-primary"
  NEXT_PUBLIC_APP_URL               - Railway web service URL

Railway services:
  Service 1 (khatabot-web):
    Build: nixpacks
    Start: npm run start
    Health check: GET / (Next.js responds with 200)

  Service 2 (khatabot-bot):
    Build: nixpacks
    Start: npx tsx scripts/start-bot.ts
    restartPolicyType: always
    Health check: none (not an HTTP service)
    Memory: 512MB minimum (Baileys + media buffers)

Supabase:
  - Enable Realtime for transactions table
  - Create storage bucket: receipts (private)
  - Run migration: supabase/migrations/001_initial_schema.sql
  - Enable RLS on all tables (migration does this)
  - Create auth user for dashboard access
```
