/**
 * KhataBot Supabase Integration Examples
 * Real-world usage patterns for each module
 *
 * NOTE: This file demonstrates usage patterns.
 * Do not import or execute this in production code.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

// ============================================================
// EXAMPLE 1: Bot - Save extracted transaction
// ============================================================

// Location: src/services/transaction-saver.ts
async function exampleBotSaveTransaction() {
  const { insertTransaction, checkDuplicateByMessageId } = await import('./queries');

  // After Claude extraction
  const extraction = {
    amount: 250.5,
    person_name: 'Priya Kumar',
    category: 'food',
    payment_mode: 'upi' as const,
    txn_id: 'UPI2026030701234567',
    txn_date: '2026-03-07',
  };

  // Check if already saved
  const isDuplicate = await checkDuplicateByMessageId('wa_msg_abc123');
  if (isDuplicate) {
    console.log('Message already processed');
    return;
  }

  // Save transaction
  const transaction = await insertTransaction({
    ...extraction,
    wa_message_id: 'wa_msg_abc123',
    confidence: 0.95,
    raw_message: 'Paid 250.50 to Priya via UPI',
  });

  console.log('Saved transaction:', transaction.id);
}

// ============================================================
// EXAMPLE 2: Bot - Upload receipt image
// ============================================================

async function exampleBotUploadReceipt(_txnId: string, imageBuffer: Buffer) {
  const {
    uploadAttachment,
    buildReceiptPath,
    sanitizeFilename,
    STORAGE_BUCKETS,
  } = await import('./storage');

  // Create safe filename
  const filename = sanitizeFilename('UPI_Receipt_20260307_001.jpg');

  // Build storage path: receipts/YYYYMMDD/filename
  const path = buildReceiptPath(new Date(), filename);

  // Upload and get signed URL
  const signedUrl = await uploadAttachment(
    STORAGE_BUCKETS.RECEIPTS,
    path,
    imageBuffer,
    'image/jpeg'
  );

  console.log('Receipt stored at:', signedUrl);
  return signedUrl;
}

// ============================================================
// EXAMPLE 3: Bot - Persist session on startup
// ============================================================

async function exampleBotPersistSession(sessionId: string, baileysCreds: unknown) {
  const { getBotSession, upsertBotSession } = await import('./queries');

  // Check if session exists
  const existing = await getBotSession(sessionId);
  if (existing) {
    console.log('Resuming existing session');
    return existing;
  }

  // Store new session
  const session = await upsertBotSession({
    session_id: sessionId,
    creds: baileysCreds as Record<string, unknown>,
    keys: {
      // Baileys key data
    },
  });

  console.log('Session created:', session.id);
  return session;
}

// ============================================================
// EXAMPLE 4: Dashboard - Fetch transactions with filters
// ============================================================

// Location: src/app/transactions/page.tsx (Client Component)
async function exampleDashboardGetTransactions() {
  const { getTransactions } = await import('./queries');

  // Get March 2026 food expenses
  const transactions = await getTransactions({
    category: 'food',
    date_from: '2026-03-01',
    date_to: '2026-03-31',
    is_deleted: false,
  });

  return transactions;
}

// ============================================================
// EXAMPLE 5: Dashboard - Get spending by person
// ============================================================

async function exampleDashboardSpendingByPerson() {
  const { getTransactions } = await import('./queries');

  // Get all March expenses
  const transactions = await getTransactions({
    date_from: '2026-03-01',
    date_to: '2026-03-31',
  });

  // Group by person
  const byPerson = transactions.reduce(
    (acc, txn) => {
      if (!acc[txn.person_name]) {
        acc[txn.person_name] = { total: 0, count: 0 };
      }
      acc[txn.person_name].total += txn.amount;
      acc[txn.person_name].count += 1;
      return acc;
    },
    {} as Record<string, { total: number; count: number }>
  );

  console.log('Spending by person:', byPerson);
  return byPerson;
}

// ============================================================
// EXAMPLE 6: Dashboard - Get groups and group transactions
// ============================================================

async function exampleDashboardGetGroupTransactions(groupId: string) {
  const { getGroups, getTransactions } = await import('./queries');

  // Get all groups
  const groups = await getGroups(true); // Active only

  // Get transactions for specific group
  const groupTxns = await getTransactions({
    group_id: groupId,
    is_deleted: false,
  });

  return { groups, transactions: groupTxns };
}

// ============================================================
// EXAMPLE 7: Dashboard - Edit transaction
// ============================================================

async function exampleDashboardEditTransaction(txnId: string) {
  const { getTransactionById, updateTransaction } = await import('./queries');

  // Get current
  const current = await getTransactionById(txnId);
  if (!current) {
    throw new Error('Transaction not found');
  }

  // Update amount and notes
  const updated = await updateTransaction(txnId, {
    amount: 300, // Changed amount
    notes: 'Updated: Paid in full',
  });

  console.log('Updated transaction:', updated);
  return updated;
}

// ============================================================
// EXAMPLE 8: Dashboard - Delete transaction with cleanup
// ============================================================

async function exampleDashboardDeleteTransaction(txnId: string) {
  const { getTransactionById, updateTransaction } = await import('./queries');
  // const { _deleteFiles: deleteFiles, _STORAGE_BUCKETS: STORAGE_BUCKETS } = await import('./storage');

  // Mark as deleted (soft delete)
  await updateTransaction(txnId, {
    is_deleted: true,
  });

  // Clean up attachments from storage
  const txn = await getTransactionById(txnId);
  if (txn) {
    // attachments.ts would have the attachment list
    // await deleteFiles(STORAGE_BUCKETS.ATTACHMENTS, attachmentPaths);
  }

  console.log('Transaction deleted (soft)');
}

// ============================================================
// EXAMPLE 9: Dashboard - Search transactions
// ============================================================

async function exampleDashboardSearch(query: string) {
  const { getTransactions } = await import('./queries');

  // Search across person_name, purpose, notes
  const results = await getTransactions({
    search_query: query,
  });

  console.log(`Found ${results.length} transactions matching "${query}"`);
  return results;
}

// ============================================================
// EXAMPLE 10: Dashboard - Get receipt image URL
// ============================================================

async function exampleDashboardGetReceiptUrl(storagePath: string) {
  const { getSignedUrl } = await import('./storage');

  // Generate signed URL (valid for 1 day)
  const url = await getSignedUrl('receipts', storagePath, 24 * 60 * 60);

  console.log('Receipt URL:', url);
  return url;
}

// ============================================================
// EXAMPLE 11: Contact management - Get all contacts
// ============================================================

async function exampleGetContacts() {
  const { getContacts } = await import('./queries');

  // Get all contacts
  const contacts = await getContacts();

  // Get contacts matching "priya"
  const matches = await getContacts('priya');

  return { all: contacts, matches };
}

// ============================================================
// EXAMPLE 12: Contact matching service
// ============================================================

async function exampleContactMatcher(personName: string) {
  const { getFuzzyContactMatches } = await import('./queries');
  // Import from Phase 6: contact-matcher service would do fuzzy matching

  const contacts = await getFuzzyContactMatches(personName, 0.7);
  return contacts;
}

// ============================================================
// EXAMPLE 13: Bot - Route Handler to check status
// ============================================================

// Location: src/app/api/bot-status/route.ts
async function exampleApiCheckBotStatus() {
  const { getBotSession } = await import('./queries');

  const session = await getBotSession('khatabot_default');
  const isConnected = session !== null;

  return {
    is_connected: isConnected,
    session_id: session?.session_id,
  };
}

// ============================================================
// EXAMPLE 14: Route Handler - Create transaction from API
// ============================================================

// Location: src/app/api/transactions/route.ts
async function exampleApiCreateTransaction(payload: {
  amount: number;
  person_name: string;
  category: string;
}) {
  const { insertTransaction, checkDuplicateByMessageId } = await import('./queries');

  // Optional dedup check
  if (payload.person_name === 'Duplicate') {
    const isDup = await checkDuplicateByMessageId('api_txn_123');
    if (isDup) {
      return { error: 'Already exists' };
    }
  }

  const txn = await insertTransaction({
    amount: payload.amount,
    person_name: payload.person_name,
    category: payload.category,
  });

  return { success: true, id: txn.id };
}

// ============================================================
// EXAMPLE 15: Error handling pattern
// ============================================================

async function exampleErrorHandling() {
  const { getTransactions } = await import('./queries');

  try {
    const txns = await getTransactions({ category: 'invalid' });
    return txns;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to fetch transactions:', error.message);
      // Log error, show user-friendly message
      return [];
    }
    throw error;
  }
}

// Export nothing - this is examples only
export {};

// Export all examples as a no-op to satisfy TypeScript/ESLint
export const EXAMPLES = {
  exampleBotSaveTransaction,
  exampleBotUploadReceipt,
  exampleBotPersistSession,
  exampleDashboardGetTransactions,
  exampleDashboardSpendingByPerson,
  exampleDashboardGetGroupTransactions,
  exampleDashboardEditTransaction,
  exampleDashboardDeleteTransaction,
  exampleDashboardSearch,
  exampleDashboardGetReceiptUrl,
  exampleGetContacts,
  exampleContactMatcher,
  exampleApiCheckBotStatus,
  exampleApiCreateTransaction,
  exampleErrorHandling,
};
