# KhataBot — Product Requirements Document

## 1. Overview

KhataBot is a personal finance tracker for a construction contractor in India. A passive WhatsApp bot (Baileys) listens to designated group messages containing payment details as text, UPI screenshots, or receipt photos. Claude Vision API (Haiku 4.5) extracts structured transaction data in a single call. Everything is stored in Supabase and displayed on a Next.js dashboard.

The bot never sends messages. It is a silent, read-only listener.

**Target user:** Single user (the contractor), with potential to invite a partner or accountant later.

---

## 2. Tech Stack

| Layer | Technology | Role |
|---|---|---|
| WhatsApp Connector | Baileys (WhiskeySockets) | Read-only listener, linked device via QR scan |
| AI Extraction | Claude Haiku 4.5 (Vision) | Parse text + images into structured JSON |
| Database | Supabase PostgreSQL | Transactions, contacts, groups, metadata |
| File Storage | Supabase Storage | Receipt photos, UPI screenshots |
| Frontend | Next.js 14+ (App Router) | Dashboard for viewing and managing data |
| Auth | Supabase Auth | Protect dashboard access |
| Styling | Tailwind CSS + shadcn/ui | UI components |
| Hosting | Railway | Long-running bot + Next.js server |

---

## 3. Architecture

```
WhatsApp Groups                         Railway Server
+-------------------+                  +----------------------------------------------+
| Home Expenses     |                  |  Next.js Monorepo                            |
| Personal          |  --- messages -> |                                              |
| Company / Sites   |                  |  src/                                        |
+-------------------+                  |  ├── bot/           Baileys listener          |
                                       |  ├── services/      AI parser, message router |
                                       |  ├── app/           Dashboard (App Router)    |
                                       |  ├── lib/db/        Supabase client + queries |
                                       |  └── lib/ai/        Claude API integration    |
                                       +----------------------┬-----------------------+
                                                              |
                                                    +---------+---------+
                                                    |     Supabase      |
                                                    |  ├── PostgreSQL   |
                                                    |  └── Storage      |
                                                    +-------------------+
```

---

## 4. Data Flow

**Step 1: Message received**
Baileys listener picks up a new message from a monitored WhatsApp group.

**Step 2: Message classification**
Determine message type: text, image (with or without caption), or irrelevant (stickers, links, reactions). Irrelevant messages are ignored.

**Step 3: AI extraction**
The message (text or image + caption) is sent to Claude Haiku 4.5 with a structured system prompt. Claude returns JSON:

```json
{
  "amount": 5000,
  "person": "Raju",
  "purpose": "Cement purchase",
  "payment_mode": "UPI",
  "txn_id": "T240315093822",
  "date": "2026-03-07",
  "confidence": 0.95,
  "raw_text": "Paid Raju 5000 for cement via GPay"
}
```

If confidence is below 0.5 or the message is clearly not a transaction (like "Good morning" or a meme), it is silently skipped.

**Step 4: Storage**
Transaction JSON is inserted into Supabase `transactions` table. If an image was present, it is uploaded to Supabase Storage and linked via `attachments` table.

**Step 5: Dashboard**
User views, filters, edits, or deletes transactions on the Next.js dashboard.

---

## 5. Database Schema

### 5.1 groups

Maps WhatsApp group JIDs to user-defined categories.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| wa_group_jid | text | WhatsApp group ID (unique) |
| name | text | Display name ("Home", "Company") |
| category | text | home, personal, company, or custom |
| is_active | boolean | Whether bot monitors this group |
| created_at | timestamptz | Auto |

### 5.2 contacts

People you transact with regularly. Helps AI match names consistently.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | text | Primary name ("Raju") |
| aliases | text[] | Alternate names/spellings |
| phone | text | Optional phone number |
| role | text | Optional: "labourer", "supplier", "electrician" |
| notes | text | Any extra info |
| created_at | timestamptz | Auto |

### 5.3 transactions

Core table. One row per financial entry.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| group_id | uuid | FK to groups |
| contact_id | uuid | FK to contacts (nullable, matched after extraction) |
| amount | numeric(12,2) | Transaction amount in INR |
| person_name | text | Name as extracted by AI (raw) |
| purpose | text | What the payment was for |
| category | text | Inherited from group, or overridden manually |
| payment_mode | text | cash, upi, bank_transfer, cheque, other |
| txn_id | text | UPI/bank transaction ID if available |
| txn_date | date | Date of the actual transaction |
| notes | text | Additional notes |
| confidence | numeric(3,2) | AI confidence score (0.00 to 1.00) |
| raw_message | text | Original message text |
| wa_message_id | text | WhatsApp message ID (for dedup) |
| is_edited | boolean | Whether user edited this on dashboard |
| is_deleted | boolean | Soft delete flag |
| created_at | timestamptz | When the record was created |
| updated_at | timestamptz | Auto-updated on edit |

### 5.4 attachments

Linked images (UPI screenshots, receipt photos).

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| transaction_id | uuid | FK to transactions |
| storage_path | text | Path in Supabase Storage |
| file_type | text | image/jpeg, image/png, etc. |
| original_filename | text | From WhatsApp if available |
| created_at | timestamptz | Auto |

### 5.5 bot_sessions

Stores Baileys auth credentials to survive restarts/redeployments.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| session_id | text | Identifier for this session |
| creds | jsonb | Baileys auth credentials |
| keys | jsonb | Baileys keys data |
| updated_at | timestamptz | Auto |

---

## 6. Monorepo Folder Structure

```
khatabot/
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── .env.local
│
├── src/
│   ├── bot/
│   │   ├── index.ts               # Baileys setup, QR code, connection
│   │   ├── listener.ts            # Message event handler
│   │   ├── session-store.ts       # Save/load session from Supabase
│   │   └── media.ts               # Download images from WhatsApp messages
│   │
│   ├── services/
│   │   ├── ai-parser.ts           # Claude API call with system prompt
│   │   ├── message-router.ts      # Classify message type, route to parser
│   │   ├── transaction-saver.ts   # Validate + insert into Supabase
│   │   ├── contact-matcher.ts     # Match extracted names to known contacts
│   │   └── dedup.ts               # Prevent duplicate entries
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Supabase client init
│   │   │   ├── queries.ts         # Reusable DB query functions
│   │   │   └── storage.ts         # Upload/download from Supabase Storage
│   │   └── ai/
│   │       ├── claude.ts          # Claude API wrapper
│   │       └── prompts.ts         # System prompts for extraction
│   │
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Dashboard home (summary view)
│   │   ├── transactions/
│   │   │   ├── page.tsx           # Transaction list with filters
│   │   │   └── [id]/page.tsx      # Single transaction detail/edit
│   │   ├── groups/
│   │   │   └── page.tsx           # Manage group-category mapping
│   │   ├── contacts/
│   │   │   └── page.tsx           # Manage known contacts
│   │   ├── reports/
│   │   │   └── page.tsx           # Monthly/category reports
│   │   ├── settings/
│   │   │   └── page.tsx           # Bot status, re-scan QR, preferences
│   │   └── api/
│   │       ├── bot-status/route.ts
│   │       └── qr/route.ts        # Serve QR code for scanning
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn components
│   │   ├── TransactionTable.tsx
│   │   ├── TransactionCard.tsx
│   │   ├── SummaryCards.tsx
│   │   ├── FilterBar.tsx
│   │   ├── MonthlyChart.tsx
│   │   ├── GroupManager.tsx
│   │   └── QRScanner.tsx          # Display QR for WhatsApp linking
│   │
│   └── types/
│       └── index.ts               # Shared TypeScript types
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Database migration
│
├── scripts/
│   └── start-bot.ts               # Entry point for bot process
│
└── railway.toml                   # Railway config (two services)
```

---

## 7. AI Extraction System Prompt

This is the core prompt sent with every message to Claude Haiku 4.5:

```
You are a financial transaction extractor for an Indian construction contractor.
You receive messages (text or images) from WhatsApp groups used to track payments.

Extract the following fields and return ONLY valid JSON, nothing else:

{
  "is_transaction": boolean,
  "amount": number | null,
  "person": string | null,
  "purpose": string | null,
  "payment_mode": string | null,
  "txn_id": string | null,
  "date": string | null,
  "confidence": number
}

Rules:
- If the message is clearly not a transaction (greetings, memes, general chat), set is_transaction to false
- For images: read UPI payment screenshots, bank transfer confirmations, or handwritten/printed receipts
- Amount should always be a number without commas or currency symbols
- If date is not explicitly mentioned or visible, set it to null (the system will use message timestamp)
- For UPI screenshots, extract the transaction ID if visible
- Confidence should reflect how clear the transaction details are
- Common payment modes in India: GPay, PhonePe, Paytm, NEFT, IMPS, RTGS, cash, cheque
- Map GPay/PhonePe/Paytm to "upi", NEFT/IMPS/RTGS to "bank_transfer"
```

---

## 8. Feature Breakdown

### 8.1 Bot Features

| Feature | Description | Priority |
|---|---|---|
| WhatsApp listener | Connect via Baileys, listen to group messages | P0 |
| Text parsing | Extract transaction data from plain text messages | P0 |
| Image parsing | Extract data from UPI screenshots and receipt photos | P0 |
| Session persistence | Store Baileys credentials in Supabase to survive restarts | P0 |
| Group registration | Map WhatsApp groups to categories | P0 |
| Auto-skip irrelevant | Ignore non-transaction messages (greetings, memes, stickers) | P0 |
| Duplicate detection | Skip if wa_message_id already exists | P0 |
| Contact matching | Fuzzy match extracted names to known contacts | P1 |
| QR code endpoint | Web endpoint to display QR for re-scanning | P1 |
| Caption + image combo | Use both image and caption text for better extraction | P1 |

### 8.2 Dashboard Features

| Feature | Description | Priority |
|---|---|---|
| Transaction list | Paginated list with date, amount, person, category, status | P0 |
| Filters | By date range, group/category, person, payment mode, amount range | P0 |
| Edit transaction | Fix any field the AI got wrong | P0 |
| Delete transaction | Soft delete with undo | P0 |
| Summary cards | Total spent today, this week, this month per category | P0 |
| View attachment | Click to view the original screenshot/receipt | P0 |
| Group management | Add/remove groups, assign categories | P1 |
| Contact management | Add/edit contacts with aliases | P1 |
| Monthly report | Bar/pie charts by category, person, payment mode | P1 |
| Search | Full-text search across transactions | P1 |
| Export CSV | Download filtered transactions as CSV | P2 |
| Bot status | Show connected/disconnected, last message time | P2 |
| Low confidence queue | Review transactions where AI confidence < 0.7 | P2 |

---

## 9. Message Processing Logic

```
Message received from WhatsApp
        |
        v
Is the group registered/active?
    No  --> Ignore
    Yes --> Continue
        |
        v
Message type?
    Sticker/Reaction/Link-only --> Ignore
    Text or Image (with optional caption) --> Continue
        |
        v
Check wa_message_id in DB
    Already exists --> Skip (duplicate)
    New --> Continue
        |
        v
Send to Claude Haiku 4.5 Vision API
    Text message --> send as text
    Image --> send as base64 image + caption if present
        |
        v
Parse JSON response
    is_transaction = false --> Ignore
    is_transaction = true, confidence < 0.5 --> Ignore
    is_transaction = true, confidence >= 0.5 --> Continue
        |
        v
Enrich data:
    - Set category from group mapping
    - Set txn_date to extracted date OR message timestamp
    - Fuzzy match person_name to contacts table
    - Upload image to Supabase Storage if present
        |
        v
Insert into transactions table
    Link attachment if image was uploaded
    Done.
```

---

## 10. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxx

# Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxxxx

# Bot config
BOT_SESSION_ID=khatabot-primary
MONITORED_GROUPS=             # Comma-separated group JIDs (or manage via dashboard)

# App
NEXT_PUBLIC_APP_URL=https://khatabot.up.railway.app
```

---

## 11. Railway Deployment

Railway needs to run two processes from the same repo:

**Service 1: Next.js web server**
```toml
[service]
name = "khatabot-web"

[build]
builder = "nixpacks"

[deploy]
startCommand = "npm run start"
```

**Service 2: WhatsApp bot (long-running)**
```toml
[service]
name = "khatabot-bot"

[build]
builder = "nixpacks"

[deploy]
startCommand = "npx tsx scripts/start-bot.ts"
restartPolicyType = "always"
```

Both services share the same environment variables and connect to the same Supabase instance.

---

## 12. Cost Estimate

Based on ~10 transactions/day (300/month), mix of text and images:

| Service | Monthly Cost |
|---|---|
| Claude Haiku 4.5 API | ~₹40-50 |
| Supabase (free tier) | ₹0 |
| Railway (Starter, 2 services) | ~₹425-850 |
| Domain (optional) | ~₹65/month (~₹800/year) |
| Dedicated SIM (one-time) | ₹100 |
| **Total** | **~₹500-950/month** |

---

## 13. Deduplication Strategy

Multiple safeguards to prevent double-counting:

1. **wa_message_id uniqueness**: Every WhatsApp message has a unique ID. Store it and check before inserting.
2. **txn_id uniqueness**: If a UPI transaction ID is extracted, check if it already exists in DB.
3. **Time + amount + person window**: If the same amount to the same person appears within 5 minutes, flag it for review rather than auto-inserting.

---

## 14. Security Considerations

- **Baileys session**: Stored encrypted in Supabase, not in filesystem (survives redeployments)
- **Supabase RLS**: Row-level security enabled, dashboard only accessible to authenticated user
- **API keys**: All stored as Railway environment variables, never in code
- **Dedicated WhatsApp number**: Bot runs on a separate SIM, not the user's personal number
- **HTTPS only**: Railway provides SSL by default
- **No outgoing messages**: Bot is read-only, minimizing WhatsApp ban risk

---

## 15. Future Enhancements (Post-MVP)

- Voice note support via Whisper API transcription
- Site/project tracking with a projects table for construction-level expense tracking
- Budget alerts when approaching monthly limits per category
- Multi-user access for partner/accountant with role-based permissions
- WhatsApp summary command (breaks read-only mode, optional, increases ban risk)
- Telegram fallback as secondary input channel
- Recurring payment detection and flagging
- Mobile PWA to make the dashboard installable on phone

---

## 16. Development Phases

### Phase 1: Foundation (Week 1)
- Set up Next.js monorepo with TypeScript, Tailwind, shadcn/ui
- Configure Supabase project, create database schema, enable RLS
- Set up Supabase Auth (magic link or email/password)
- Basic dashboard layout with placeholder pages

### Phase 2: Bot Core (Week 2)
- Baileys integration with QR code connection
- Session persistence in Supabase
- Message listener for registered groups
- Claude Haiku integration for text message parsing
- Transaction insertion pipeline

### Phase 3: Image Processing (Week 3)
- Image download from WhatsApp messages via Baileys
- Upload to Supabase Storage
- Claude Vision API for UPI screenshot and receipt parsing
- Attachment linking to transactions

### Phase 4: Dashboard (Week 3-4)
- Transaction list with pagination and filters
- Edit/delete transaction functionality
- Summary cards (today, this week, this month)
- Group management page
- Contact management page
- View attachments (open image in modal)

### Phase 5: Polish (Week 4)
- Deduplication logic
- Contact fuzzy matching
- Low confidence review queue
- Monthly report with charts (recharts)
- Bot status indicator
- CSV export
- Railway deployment with two services
- QR re-scan endpoint

---

## 17. Key Technical Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Baileys over whatsapp-web.js | Baileys | No Puppeteer/Chrome needed, lighter on Railway |
| Haiku over Sonnet for parsing | Haiku 4.5 | 3x cheaper, fast enough for structured extraction |
| Single Claude call for OCR + parsing | Vision API | Eliminates separate OCR step, handles messy receipts better |
| Session stored in Supabase | jsonb columns | Survives Railway redeployments, no filesystem dependency |
| Monorepo | Single Next.js project | Shared types, single deploy pipeline, simpler for solo dev |
| Soft deletes | is_deleted flag | Never lose data, maintain audit trail |
| Group-based categorization | Auto-category from group | Zero-effort tagging, just send message to the right group |
