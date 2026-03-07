# Supabase Integration Quick Reference

## All Exported Functions (22 total)

### Clients (2)
```typescript
import { createBrowserClient } from '@/lib/supabase/client';
import { createServerClient } from '@/lib/supabase/server';

const supabase = createBrowserClient();  // Browser/dashboard
const supabase = createServerClient();    // Bot/server operations
```

### Transactions (4)
```typescript
import {
  getTransactions,      // Fetch with filters
  getTransactionById,   // Fetch single
  insertTransaction,    // Create
  updateTransaction,    // Update
} from '@/lib/supabase/queries';
```

### Groups (2)
```typescript
import {
  getGroups,           // Fetch all groups
  getGroupByChatId,    // Find by WhatsApp JID
} from '@/lib/supabase/queries';
```

### Contacts (2)
```typescript
import {
  getContacts,              // Fetch all with optional search
  getFuzzyContactMatches,   // Get all for fuzzy matching
} from '@/lib/supabase/queries';
```

### Bot Sessions (2)
```typescript
import {
  getBotSession,    // Fetch Baileys session
  upsertBotSession, // Create or update
} from '@/lib/supabase/queries';
```

### Deduplication (2)
```typescript
import {
  checkDuplicate,       // Check if wa_message_id exists
  checkDuplicateTxnId,  // Check if txn_id exists
} from '@/lib/supabase/queries';
```

### Storage (7)
```typescript
import {
  uploadAttachment,        // Upload file with signed URL
  getSignedUrl,            // Generate browser-safe URL
  deleteFile,              // Delete single file
  deleteFiles,             // Delete multiple files
  buildReceiptPath,        // Path: receipts/YYYYMMDD/filename
  buildAttachmentPath,     // Path: attachments/txnId/filename
  sanitizeFilename,        // Remove special chars
  STORAGE_BUCKETS,         // { RECEIPTS, ATTACHMENTS }
} from '@/lib/supabase/storage';
```

## Common Patterns

### Fetch Transactions (Dashboard)
```typescript
import { getTransactions } from '@/lib/supabase/queries';

const txns = await getTransactions({
  category: 'food',
  date_from: '2026-03-01',
  date_to: '2026-03-31',
});
```

### Save Transaction (Bot)
```typescript
import { insertTransaction, checkDuplicate } from '@/lib/supabase/queries';

if (!(await checkDuplicate(wa_msg_id))) {
  await insertTransaction({
    amount: 500,
    person_name: 'Rahul',
    category: 'food',
    wa_message_id: wa_msg_id,
  });
}
```

### Upload Receipt (Bot)
```typescript
import { uploadAttachment, buildReceiptPath } from '@/lib/supabase/storage';

const path = buildReceiptPath(new Date(), 'receipt.jpg');
const url = await uploadAttachment('receipts', path, buffer, 'image/jpeg');
```

### Get Receipt URL (Dashboard)
```typescript
import { getSignedUrl } from '@/lib/supabase/storage';

const url = await getSignedUrl('receipts', 'receipts/20260307/file.jpg');
```

### Find Contact (Bot)
```typescript
import { getFuzzyContactMatches } from '@/lib/supabase/queries';

const allContacts = await getFuzzyContactMatches('Rahul');
// Matcher service does fuzzy filtering
```

### Persist Bot Session (Startup)
```typescript
import { upsertBotSession } from '@/lib/supabase/queries';

await upsertBotSession({
  session_id: 'khatabot_default',
  creds: baileysCreds,
  keys: baileysKeys,
});
```

## Environment Variables

```bash
# Required in .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Error Handling

```typescript
try {
  const txns = await getTransactions({...});
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message); // "Failed to fetch transactions: ..."
  }
}
```

## Which Client to Use?

**Browser Client** (`createBrowserClient`):
- Client components ('use client')
- Dashboard pages
- Browser-side code
- API routes with user session

**Server Client** (`createServerClient`):
- Bot operations
- Server Components
- Route Handlers
- Session persistence
- Service-role operations

## Type Definitions

All imported types from `src/types/index.ts`:
- `Transaction` - Transaction row
- `Contact` - Contact row
- `Group` - Group row
- `BotSession` - Session row
- `TransactionFilters` - Query filter object

## Documentation

- Full guide: `src/lib/supabase/README.md`
- Examples: `src/lib/supabase/examples.ts` (15 patterns)
- Implementation: `docs/PHASE_1B_IMPLEMENTATION.md`

## Testing Imports

```typescript
// ✅ Correct - use query functions
import { getTransactions } from '@/lib/supabase/queries';
const txns = await getTransactions({});

// ❌ Wrong - never use raw client calls
import { createBrowserClient } from '@/lib/supabase/client';
const { data } = await createBrowserClient().from('transactions').select();
```

## Troubleshooting

**Import not found:**
```
Error: Cannot find module '@/lib/supabase/...'
→ Use relative imports in .ts files: '../../lib/supabase/queries'
```

**Type errors with Database:**
```
Type 'SchemaName' does not satisfy constraint
→ Run: npm run type-check -- --skipLibCheck
```

**RLS Permission denied:**
```
Error: new row violates row-level security policy
→ Check you're using browser client in components (not server client)
→ Ensure user is authenticated
```

**Storage file not found:**
```
Error: The object does not exist
→ Check bucket name: 'receipts' or 'attachments'
→ Verify path was returned from uploadAttachment
```

---

**Implementation:** Phase 1b - Complete ✅
**Ready for:** Phase 2 - Authentication
