# KhataBot - Phase 1 Planning Document

---

## 1. Monorepo Folder Structure

```
khatabot/
│
├── package.json                        # Root package with all deps + scripts
├── next.config.js                      # Next.js config with webpack externals for Baileys
├── tailwind.config.ts                  # Tailwind config with shadcn/ui preset
├── postcss.config.mjs                  # PostCSS for Tailwind
├── tsconfig.json                       # Base TS config for Next.js (web + shared types)
├── tsconfig.bot.json                   # Extends base, targets src/bot + src/services + scripts/
├── .env.local                          # Local secrets (gitignored)
├── .env.example                        # Template (committed)
├── railway.toml                        # Two-service Railway config
├── .gitignore
│
├── src/
│   │
│   ├── types/
│   │   └── index.ts                    # ALL shared TypeScript interfaces + DB row types
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser-safe anon client (createBrowserClient)
│   │   │   ├── server.ts               # Server-only service-role client (createClient)
│   │   │   ├── queries.ts              # All parameterised DB query functions
│   │   │   └── storage.ts             # Upload / download / signed URL helpers
│   │   │
│   │   └── ai/
│   │       ├── claude.ts               # Anthropic SDK wrapper (text + vision calls)
│   │       └── prompts.ts              # System prompt strings as typed constants
│   │
│   ├── bot/
│   │   ├── index.ts                    # Baileys makeWASocket(), QR generation, connection lifecycle
│   │   ├── listener.ts                 # messages.upsert handler - routes to services
│   │   ├── session-store.ts            # useMultiFileAuthState replacement - read/write to Supabase
│   │   └── media.ts                    # downloadMediaMessage() wrapper, returns Buffer
│   │
│   ├── services/
│   │   ├── message-router.ts           # Classify: text / image / irrelevant. Entry point for pipeline
│   │   ├── ai-parser.ts                # Build payload, call claude.ts, parse + validate JSON response
│   │   ├── contact-matcher.ts          # Fuzzy name match against contacts table (Levenshtein)
│   │   ├── transaction-saver.ts        # Validate + upsert transaction + link attachment
│   │   └── dedup.ts                    # Check wa_message_id, txn_id, time+amount+person window
│   │
│   ├── app/                            # Next.js App Router
│   │   ├── layout.tsx                  # Root layout: Supabase Auth provider, Toaster
│   │   ├── page.tsx                    # Dashboard home: summary cards + recent transactions
│   │   ├── globals.css                 # Tailwind directives
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx            # Supabase Auth UI or custom phone+password form
│   │   │   └── callback/
│   │   │       └── route.ts            # Supabase Auth callback handler
│   │   │
│   │   ├── transactions/
│   │   │   ├── page.tsx                # Paginated list with FilterBar
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Detail view + inline edit form
│   │   │
│   │   ├── groups/
│   │   │   └── page.tsx                # Group list, toggle active, assign category
│   │   │
│   │   ├── contacts/
│   │   │   └── page.tsx                # Contact list, add/edit aliases and role
│   │   │
│   │   ├── reports/
│   │   │   └── page.tsx                # Monthly bar chart + category pie chart
│   │   │
│   │   ├── settings/
│   │   │   └── page.tsx                # Bot status, QR display, preferences
│   │   │
│   │   └── api/
│   │       ├── bot-status/
│   │       │   └── route.ts            # GET: returns bot connection state + last message time
│   │       └── qr/
│   │           └── route.ts            # GET: returns current QR code as base64 PNG or SSE stream
│   │
│   └── components/
│       ├── ui/                         # shadcn/ui generated components (Button, Card, Dialog, etc.)
│       ├── layout/
│       │   ├── Sidebar.tsx             # Nav links to all dashboard pages
│       │   └── TopNav.tsx              # Page title + user avatar + logout
│       ├── TransactionTable.tsx        # Sortable table with edit/delete actions
│       ├── TransactionCard.tsx         # Mobile-friendly card variant
│       ├── SummaryCards.tsx            # Today / Week / Month totals per category
│       ├── FilterBar.tsx               # Date range, category, payment mode, search
│       ├── MonthlyChart.tsx            # Recharts bar/pie wrapper
│       ├── GroupManager.tsx            # Table of groups with toggle + category selector
│       ├── ContactManager.tsx          # Table of contacts with alias editor
│       └── QRDisplay.tsx               # Poll /api/qr and render QR code image
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      # All 5 tables + RLS policies + indexes
│
├── scripts/
│   └── start-bot.ts                    # Bot entry: import src/bot/index.ts, handle signals
│
└── docs/
    └── tasks.md                        # Phase-by-phase task checklist
```

---

## 2. NPM Dependencies

### Production Dependencies

```
Framework + UI:
  next                          14.2.x    App Router, Server Components
  react                         18.3.x    Peer dep for Next.js
  react-dom                     18.3.x    Peer dep for Next.js

Supabase:
  @supabase/supabase-js         2.47.x    Universal Supabase client
  @supabase/ssr                 0.5.x     Cookie-based auth helpers for Next.js App Router

AI:
  @anthropic-ai/sdk             0.39.x    Official Claude API SDK (supports vision)

WhatsApp:
  @whiskeysockets/baileys       6.7.x     Baileys WhatsApp multi-device library
  qrcode                        1.5.x     Generate QR PNG from Baileys QR string
  sharp                         0.33.x    Image buffer processing / resize before sending to Claude

Styling:
  tailwindcss                   3.4.x     Utility-first CSS
  tailwind-merge                2.5.x     Conditional class merging (clsx companion)
  clsx                          2.1.x     Class conditional utility
  class-variance-authority      0.7.x     shadcn/ui variant engine
  lucide-react                  0.469.x   shadcn/ui icon set

shadcn/ui component primitives:
  @radix-ui/react-dialog        1.1.x
  @radix-ui/react-dropdown-menu 2.1.x
  @radix-ui/react-select        2.1.x
  @radix-ui/react-label         2.1.x
  @radix-ui/react-separator     1.1.x
  @radix-ui/react-slot          1.1.x
  @radix-ui/react-toast         1.2.x
  @radix-ui/react-tabs          1.1.x

Charts:
  recharts                      2.14.x    Monthly bar + category pie charts

Utilities:
  date-fns                      3.6.x     Date formatting (Indian locale, IST)
  fast-fuzzy                    1.12.x    Levenshtein-based fuzzy contact matching
  p-queue                       8.0.x     Concurrency-limited queue for AI calls
  pino                          9.6.x     Structured JSON logging (bot process)
  pino-pretty                   13.0.x    Dev-mode pretty logging

Runtime compat (Baileys requires):
  @hapi/boom                    21.0.x    Baileys peer
  @hapi/hoek                    11.0.x    Baileys peer
  link-preview-js               3.0.x     Baileys peer (optional, avoids missing module warn)
```

### Development Dependencies

```
TypeScript:
  typescript                    5.5.x
  @types/node                   22.x
  @types/react                  18.x
  @types/react-dom              18.x
  @types/qrcode                 1.5.x

Build tools for bot process:
  tsx                           4.19.x    Run TypeScript directly (scripts/start-bot.ts)

Linting + Formatting:
  eslint                        8.x
  eslint-config-next            14.x
  prettier                      3.x
```

---

## 3. Environment Variables (.env.example)

```env
# ============================================================
# SUPABASE
# ============================================================

# Public keys (safe to expose to browser via NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxx

# Service role key - SERVER ONLY, never expose to browser
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxx

# ============================================================
# ANTHROPIC / CLAUDE
# ============================================================

# Claude Haiku 4.5 for transaction extraction (text + vision)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx

# Which Claude model to use
CLAUDE_MODEL=claude-haiku-4-5

# Minimum confidence score to accept a parsed transaction
MIN_CONFIDENCE_THRESHOLD=0.5

# ============================================================
# BOT CONFIGURATION
# ============================================================

# Unique identifier for this bot session
BOT_SESSION_ID=khatabot-primary

# Comma-separated list of WhatsApp group JIDs (manage via dashboard)
MONITORED_GROUPS=

# Max concurrent AI parsing calls
AI_CONCURRENCY_LIMIT=3

# ============================================================
# APPLICATION
# ============================================================

# Public URL of the deployed web service
NEXT_PUBLIC_APP_URL=https://khatabot.up.railway.app

# Node environment
NODE_ENV=production

# ============================================================
# LOGGING
# ============================================================

# Pino log level for bot process
LOG_LEVEL=info
```

---

## 4. TypeScript Type Definitions (src/types/index.ts)

See full types in ARCHITECTURE.md - includes:
- Database row types (Group, Contact, Transaction, Attachment, BotSession, UserProfile)
- AI extraction types (ClaudeExtractionResult, EnrichedExtraction)
- Bot pipeline types (ClassifiedMessage, BotStatus)
- Dashboard types (TransactionWithRelations, TransactionSummary, TransactionFilters)
- Utility types (ApiResponse, Pagination, PaginatedResponse)

---

## Key Design Decisions

1. **Baileys separation**: Baileys MUST NOT be imported in Next.js routes (src/app/). Only src/bot/ and src/services/ can use it.
2. **Session persistence**: Baileys creds stored in Supabase jsonb table, not filesystem. Survives Railway restarts without QR re-scan.
3. **Two Railway services**: khatabot-web (Next.js) and khatabot-bot (Baileys listener) communicate through Supabase only.
4. **Dedup at DB layer**: `wa_message_id` UNIQUE constraint prevents duplicates even if application logic fails.
5. **Error handling**: Claude API failures logged but not retried. Message dropped silently. Bot does not crash.
6. **Dashboard state**: Initial load via RSC, live updates via Supabase Realtime postgres_changes subscription.
