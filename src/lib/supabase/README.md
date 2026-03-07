# Supabase Integration Layer

This directory contains the complete Supabase integration for KhataBot Phase 1b, including typed clients, query functions, and storage helpers.

## Files

### 1. `database.types.ts`
Auto-generated TypeScript types for all Supabase tables and functions.

Key types exported:
- `Tables` - Union of all table types (Row, Insert, Update)
- `Database` - Full database schema type for Supabase client

Never import this in components directly. Instead, use the query functions below.

### 2. `client.ts`
Browser-safe Supabase client for client components and API routes.

**Usage:**
```typescript
import { createBrowserClient } from '@/lib/supabase/client';

// In client components or browser code
const supabase = createBrowserClient();
const { data } = await supabase.from('transactions').select();
```

**Key points:**
- Singleton pattern - returns same instance
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- RLS policies enforce authentication
- Suitable for Next.js client components, browser code, and API routes with user context

### 3. `server.ts`
Server-only Supabase client for Route Handlers and Server Components.

**Usage:**
```typescript
import { createServerClient } from '@/lib/supabase/server';

// In Route Handlers or Server Components
const supabase = createServerClient();
const { data } = await supabase.from('transactions').select();
```

**Key points:**
- Singleton pattern - returns same instance
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- Can bypass RLS policies (service role access)
- Used for bot session persistence and server-side operations

### 4. `queries.ts`
Typed query functions wrapping Supabase calls. All database queries go through here.

**Never use raw `.from().select()` calls in components - always use these functions.**

#### Transaction Queries

- `getTransactions(filters)` - Fetch transactions with optional filters
  - Filters: group_id, contact_id, category, payment_mode, search_query, date_from, date_to, is_deleted
  - Returns: `Transaction[]`

- `getTransactionById(id)` - Fetch single transaction
  - Returns: `Transaction | null`

- `insertTransaction(data)` - Create new transaction
  - Called by bot after AI extraction and dedup checks
  - Returns: `Transaction`

- `updateTransaction(id, data)` - Update existing transaction
  - Called by dashboard or bot
  - Returns: `Transaction`

#### Group Queries

- `getGroups(isActive?)` - Fetch all groups
  - Optional filter by active status
  - Returns: `Group[]`

- `getGroupByChatId(wa_group_jid)` - Find group by WhatsApp JID
  - Used by bot message listener
  - Returns: `Group | null`

#### Contact Queries

- `getContacts(search?)` - Fetch all contacts with optional search
  - Returns: `Contact[]`

- `getFuzzyContactMatches(name, threshold)` - Fetch all contacts for fuzzy matching
  - Client-side matching done by contact matcher service
  - Returns: `Contact[]`

#### Bot Session Queries

- `getBotSession(sessionId)` - Fetch Baileys session
  - Used on bot startup
  - Returns: `BotSession | null`

- `upsertBotSession(data)` - Create or update session
  - Called when Baileys updates credentials
  - Returns: `BotSession`

#### Deduplication Queries

- `checkDuplicate(wa_message_id)` - Check if message ID exists
  - Prevents duplicate transaction entries
  - Returns: `boolean`

- `checkDuplicateTxnId(txn_id)` - Check if transaction ID exists
  - Some receipts include unique transaction IDs
  - Returns: `boolean`

### 5. `storage.ts`
Supabase Storage helpers for file uploads, signed URLs, and deletions.

#### Upload

```typescript
import { uploadAttachment, buildReceiptPath, STORAGE_BUCKETS } from '@/lib/supabase/storage';

const path = buildReceiptPath(new Date(), 'receipt.jpg');
const url = await uploadAttachment(STORAGE_BUCKETS.RECEIPTS, path, buffer, 'image/jpeg');
```

**Functions:**

- `uploadAttachment(bucket, path, file, mimetype)` - Upload file to storage
  - Uses server client (service role)
  - Automatically generates signed URL (7 days expiry)
  - Returns: signed URL string

#### Signed URLs

```typescript
import { getSignedUrl } from '@/lib/supabase/storage';

const url = await getSignedUrl('receipts', 'receipts/20260307/file.jpg', 3600); // 1 hour
```

- `getSignedUrl(bucket, path, expiresIn)` - Generate signed URL
  - Used by dashboard to display images
  - Respects RLS policies
  - Returns: signed URL string

#### Deletion

```typescript
import { deleteFile, deleteFiles } from '@/lib/supabase/storage';

await deleteFile('receipts', 'receipts/20260307/file.jpg');
await deleteFiles('attachments', [path1, path2, path3]);
```

- `deleteFile(bucket, path)` - Delete single file
- `deleteFiles(bucket, paths)` - Delete multiple files in batch

#### Path Builders

```typescript
import { buildReceiptPath, buildAttachmentPath, sanitizeFilename } from '@/lib/supabase/storage';

const receiptPath = buildReceiptPath(new Date(), 'upi.jpg');
// -> receipts/20260307/upi.jpg

const attachPath = buildAttachmentPath(txnId, 'invoice.pdf');
// -> attachments/abc-123/invoice.pdf

const safe = sanitizeFilename('My Receipt (1).jpg');
// -> My_Receipt_1_.jpg
```

- `buildReceiptPath(date, filename)` - Path: `receipts/YYYYMMDD/filename`
- `buildAttachmentPath(txnId, filename)` - Path: `attachments/txnId/filename`
- `sanitizeFilename(original)` - Remove special chars, preserve extension

## Environment Variables Required

```bash
# Browser-exposed (in .env.local)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-only (in .env.local)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Error Handling

All functions throw `Error` with descriptive messages on failure:

```typescript
try {
  const txns = await getTransactions({ category: 'food' });
} catch (error) {
  console.error(error.message); // "Failed to fetch transactions: ..."
}
```

## Usage Patterns

### Client Component (Dashboard)
```typescript
'use client';

import { getTransactions } from '@/lib/supabase/queries';
import { useEffect, useState } from 'react';

export function TransactionList() {
  const [txns, setTxns] = useState([]);

  useEffect(() => {
    getTransactions({ is_deleted: false })
      .then(setTxns)
      .catch(console.error);
  }, []);

  return (
    <ul>
      {txns.map(t => <li key={t.id}>{t.person_name}: {t.amount}</li>)}
    </ul>
  );
}
```

### Route Handler
```typescript
// app/api/transactions/route.ts
import { getTransactions } from '@/lib/supabase/queries';

export async function GET(req: Request) {
  const txns = await getTransactions({ is_deleted: false });
  return Response.json(txns);
}
```

### Bot Service
```typescript
import { insertTransaction } from '@/lib/supabase/queries';
import { uploadAttachment } from '@/lib/supabase/storage';

// After AI extraction
await insertTransaction({
  amount: 500,
  person_name: 'Rahul',
  category: 'food',
  wa_message_id: 'msg123',
});

// After downloading media
const url = await uploadAttachment('receipts', path, buffer, 'image/jpeg');
```

## RLS Security

All tables have Row-Level Security (RLS) enabled:

- **Authenticated users** can read/write/update/delete their own data
- **Service role** (server client) can bypass RLS
- **Anon key** (browser client) cannot access data - must be authenticated

Bot sessions are service-role only:
```sql
-- bot_sessions RLS policy
USING (auth.role() = 'service_role');
```

## Database Schema

See `/supabase/migrations/001_initial_schema.sql` for full schema including:
- Tables: groups, contacts, transactions, attachments, bot_sessions, user_profiles
- Indexes: wa_group_jid, contact name, transaction dates, etc.
- Triggers: auto-updating updated_at timestamps
- Functions: get_monthly_summary, get_spending_by_person

## Testing

All functions are async and return typed responses. Test with:

```bash
npm run type-check  # Verify TypeScript types
```

No unit tests yet - Phase 2+ will add integration tests.

## Next Steps (Future Phases)

- Phase 2: Add Supabase Auth (Phone + Password login)
- Phase 3b: Add Claude extraction -> insertTransaction flow
- Phase 4: Add image download and storage flow
- Phase 5: Dashboard pages calling these query functions
