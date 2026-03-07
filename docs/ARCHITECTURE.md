# KhataBot Architecture Design

---

## 1. Data Flow

The pipeline has two completely separate paths that share only the database:

**Inbound (WhatsApp to Supabase):**
```
Baileys WebSocket
  -> Message Listener (filter notify events only)
  -> Message Router (Gate A: group registered? Gate B: duplicate?)
  -> Media Handler (download image, convert to base64, stay in memory)
  -> AI Parser (build multimodal Claude request, Zod-validate response)
  -> Result Filter (drop if is_transaction=false or confidence < 0.5)
  -> Contact Matcher (fuzzy match against contacts cache)
  -> Transaction Saver (Storage upload, INSERT transactions, INSERT attachments)
  -> Supabase PostgreSQL
```

**Outbound (Supabase to Dashboard):**
```
Supabase Realtime (postgres_changes on INSERT/UPDATE)
  -> Browser Client Component listener
  -> Prepend new row to local state
  -> Toast notification to user
```

No HTTP call ever goes from the bot to the web service or vice versa. They are fully decoupled.

---

## 2. Service Boundaries

| Service | Responsibility | Forbidden From |
|---|---|---|
| khatabot-web (Railway svc 1) | Dashboard UI, auth sessions, CRUD API routes, QR endpoint, bot-status endpoint | Running Baileys, calling Claude API |
| khatabot-bot (Railway svc 2) | Baileys connection, AI extraction, DB writes, Storage uploads | Serving HTTP, handling user auth |
| Supabase | PostgreSQL, Auth, Storage, Realtime | - |
| Claude API | Multimodal extraction | - |

The two Railway services communicate through Supabase only - never directly.

---

## 3. Message Processing Pipeline

Six gates, ordered from cheapest to most expensive:

1. **Event type filter** - drop "append" (history sync), keep "notify" (live messages)
2. **Message type classification** - drop stickers, reactions, link-only; keep text and image
3. **Gate A: Group registration check** - SQL lookup on `groups.wa_group_jid`, drop if not found or `is_active=false`
4. **Gate B: Dedup check** - SQL lookup on `transactions.wa_message_id`, drop if exists
5. **Claude API call** - only reached if all four gates pass; drops if `is_transaction=false` or `confidence < 0.5`
6. **Enrichment and save** - contact fuzzy match, date resolution, Storage upload, INSERT

Claude is the most expensive step (money and latency) and is called last.

---

## 4. Database Relationships

```
groups (1) ----< transactions (N)
contacts (1) ---< transactions (N, nullable)
transactions (1) ---< attachments (N, usually 0 or 1)
bot_sessions - standalone, no FKs
user_profiles - extends auth.users (1-to-1)
```

Key design choices in the schema:
- `wa_message_id` has a UNIQUE constraint - this is the primary dedup mechanism at the DB layer
- `category` is denormalized onto transactions (copied from the group at insert time) so the dashboard can filter by category even if the group is later deleted
- `contact_id` is nullable - many messages will not match a known contact
- `is_deleted` soft delete on all transactions - no data is ever destroyed

---

## 5. Error Handling Strategy

| Failure | Behavior |
|---|---|
| Claude API 5xx / timeout | Log, drop message silently. No retry in MVP. |
| Claude returns malformed JSON | Strip markdown fencing and retry parse; if still fails, log and drop |
| `wa_message_id` already in DB | Caught at Gate B (application) AND as a UNIQUE violation at DB layer. Drop silently both ways |
| `txn_id` already in DB | Safety net check after Claude extraction - drop as "duplicate UPI transaction" |
| Image download fails | Fall back to caption-only text extraction; if no caption, drop silently |
| Supabase Storage upload fails | Continue with transaction INSERT without attachment row - never block a transaction for a storage failure |
| DB INSERT fails (non-dedup) | Log as ERROR, drop. Bot does not crash. Railway restarts automatically on crash. |
| Bot reconnect after restart | Session loaded from `bot_sessions` table in under 5 seconds, no QR needed |

---

## 6. Session Persistence

Baileys credentials are stored as JSONB in the `bot_sessions` table. The `session-store.ts` implements Baileys' `IAuthStateProvider` interface backed by Supabase instead of the filesystem.

On every Railway restart (which wipes the filesystem), the bot reads from `bot_sessions` and reconnects without QR. The QR flow only triggers if the WhatsApp session is explicitly unlinked from the phone. When that happens, the bot writes a base64 QR to `bot_sessions.qr_code`, and the web service's `/api/qr` endpoint reads and serves it.

The one caveat: Baileys updates session keys frequently. The `keys` JSONB object is 50-200KB and written on every message exchange. This is fine for 10 transactions/day but warrants a Redis keys store at higher volume.

---

## 7. Dashboard State

- **Initial load**: Server Components (RSC) fetch first 50 rows server-side. First paint has data, no spinner.
- **Live updates**: Supabase Realtime `postgres_changes` subscription on the `transactions` table. On INSERT, prepend to local state and show a toast. On UPDATE, patch the row in place.
- **Filters**: Client-side `Array.filter()` on the loaded dataset. Fast enough for under 500 rows. Upgrade path: move to server-side query params with RSC re-fetch if needed.
- **Bot status**: Polling every 30 seconds (not Realtime) because bot status changes infrequently.

---

## 8. Multi-User Scalability

The schema is ready for multi-user with one migration: add `user_id UUID` to `groups`, `contacts`, and `transactions`, then update RLS policies from `auth.role() = 'authenticated'` to `user_id = auth.uid()`. The bot service would look up the owning `user_id` from the `groups` table and stamp it on each transaction. The main engineering cost is changing from one Baileys socket to one-per-user.

---

## 9. Critical Import Boundaries

**RULE: Baileys must NEVER be imported in Next.js code paths.**

SAFE:
- `scripts/start-bot.ts` imports `src/bot/index.ts`
- `src/bot/*.ts` imports `src/lib/supabase/server.ts`
- `src/services/*.ts` imports `src/lib/ai/claude.ts`

FORBIDDEN:
- `src/app/**` must NOT import `src/bot/**`
- `src/app/**` must NOT import `src/services/**`
- `src/components/**` must NOT import Baileys directly

ENFORCEMENT:
- `tsconfig.json` excludes `src/bot/` and `src/services/` from Next.js compilation
- `next.config.js` webpack externals prevents accidental bundling
- ESLint rules can enforce this at lint time
