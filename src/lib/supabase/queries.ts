/**
 * Supabase Query Functions
 * Typed wrappers for all database operations
 * All query functions are async and return typed responses
 * NO raw .from().select() calls in components - all via these functions
 */

import { createBrowserClient } from './client';
import { createServerClient } from './server';
import type {
  Transaction,
  Contact,
  Group,
  BotSession,
  TransactionFilters,
} from '../../types';

/**
 * Sanitize user input for PostgREST filter strings
 * Escapes characters that could manipulate .or() filter syntax
 */
function sanitizeFilterValue(input: string): string {
  return input.replace(/[,.()"'\\{}]/g, '');
}

// ============================================================
// TRANSACTION QUERIES
// ============================================================

/**
 * Fetch transactions with optional filters
 * Used by dashboard transaction list
 * Filters: group_id, contact_id, category, payment_mode, search_query, date range
 */
export async function getTransactions(
  filters: TransactionFilters
): Promise<Transaction[]> {
  const supabase = createBrowserClient();

  let query = supabase.from('transactions').select('*');

  if (filters.group_id) {
    query = query.eq('group_id', filters.group_id);
  }

  if (filters.contact_id) {
    query = query.eq('contact_id', filters.contact_id);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.payment_mode) {
    query = query.eq('payment_mode', filters.payment_mode);
  }

  if (filters.search_query) {
    const q = sanitizeFilterValue(filters.search_query);
    query = query.or(
      `person_name.ilike.%${q}%,purpose.ilike.%${q}%,notes.ilike.%${q}%`
    );
  }

  if (filters.date_from) {
    query = query.gte('txn_date', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('txn_date', filters.date_to);
  }

  if (filters.is_deleted !== undefined) {
    query = query.eq('is_deleted', filters.is_deleted);
  } else {
    query = query.eq('is_deleted', false);
  }

  query = query.order('txn_date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  return (data || []) as Transaction[];
}

/**
 * Fetch a single transaction by ID
 */
export async function getTransactionById(id: string): Promise<Transaction | null> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch transaction: ${error.message}`);
  }

  return data as Transaction;
}

/**
 * Insert a new transaction
 * Called by bot after AI extraction and dedup checks
 */
export async function insertTransaction(
  data: {
    group_id?: string | null;
    contact_id?: string | null;
    amount: number;
    person_name: string;
    purpose?: string | null;
    category: string;
    payment_mode?: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other' | null;
    txn_id?: string | null;
    txn_date?: string | null;
    notes?: string | null;
    confidence?: number | null;
    raw_message?: string | null;
    wa_message_id?: string | null;
    is_edited?: boolean;
    is_deleted?: boolean;
  }
): Promise<Transaction> {
  const supabase = createServerClient();

  const { data: inserted, error } = await supabase
    .from('transactions')
    .insert(data as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert transaction: ${error.message}`);
  }

  return inserted as Transaction;
}

/**
 * Update an existing transaction
 * Can be called by dashboard (user edits) or bot (update from new message)
 */
export async function updateTransaction(
  id: string,
  data: Partial<{
    amount: number;
    person_name: string;
    category: string;
    payment_mode: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other' | null;
    txn_id: string | null;
    txn_date: string | null;
    notes: string | null;
    is_edited: boolean;
    is_deleted: boolean;
  }>
): Promise<Transaction> {
  const supabase = createBrowserClient();

  const { data: updated, error } = await (supabase as any)
    .from('transactions')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update transaction: ${error.message}`);
  }

  return updated as Transaction;
}

// ============================================================
// GROUP QUERIES
// ============================================================

/**
 * Fetch all groups, optionally filtered by active status
 */
export async function getGroups(isActive?: boolean): Promise<Group[]> {
  const supabase = createBrowserClient();

  let query = supabase.from('groups').select('*');

  if (isActive !== undefined) {
    query = query.eq('is_active', isActive);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch groups: ${error.message}`);
  }

  return (data || []) as Group[];
}

/**
 * Fetch a group by its WhatsApp JID
 * Used by bot message listener to find group context
 */
export async function getGroupByChatId(wa_group_jid: string): Promise<Group | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('wa_group_jid', wa_group_jid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch group: ${error.message}`);
  }

  return data as Group;
}

// ============================================================
// CONTACT QUERIES
// ============================================================

/**
 * Fetch all contacts, optionally filtered by name search
 */
export async function getContacts(search?: string): Promise<Contact[]> {
  const supabase = createBrowserClient();

  let query = supabase.from('contacts').select('*');

  if (search) {
    const q = sanitizeFilterValue(search);
    query = query.or(
      `name.ilike.%${q}%,phone.ilike.%${q}%`
    );
  }

  query = query.order('name', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  return (data || []) as Contact[];
}

/**
 * Fuzzy match contacts by name (for contact matcher service)
 * Returns contacts that approximately match the given name
 * Used during transaction extraction to find best contact match
 */
export async function getFuzzyContactMatches(
  _name: string,
  _threshold: number = 0.6
): Promise<Contact[]> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch contacts for fuzzy matching: ${error.message}`);
  }

  // Client-side fuzzy filtering will be done by contact matcher service
  // This just returns all contacts for the matcher to work with
  return (data || []) as Contact[];
}

// ============================================================
// GROUP MUTATIONS
// ============================================================

export async function insertGroup(data: {
  wa_group_jid: string;
  name: string;
  category: 'home' | 'personal' | 'company' | 'custom';
  is_active?: boolean;
}): Promise<Group> {
  const supabase = createBrowserClient();
  const { data: inserted, error } = await supabase
    .from('groups')
    .insert(data as any)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert group: ${error.message}`);
  return inserted as Group;
}

export async function upsertGroup(data: {
  wa_group_jid: string;
  name: string;
  category?: 'home' | 'personal' | 'company' | 'custom';
  is_active?: boolean;
}): Promise<Group> {
  const supabase = createBrowserClient();
  const { data: upserted, error } = await supabase
    .from('groups')
    .upsert(data as any, { onConflict: 'wa_group_jid' })
    .select()
    .single();
  if (error) throw new Error(`Failed to upsert group: ${error.message}`);
  return upserted as Group;
}

export async function updateGroup(
  id: string,
  data: Partial<{ name: string; category: string; is_active: boolean }>
): Promise<Group> {
  const supabase = createBrowserClient();
  const { data: updated, error } = await (supabase as any)
    .from('groups')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update group: ${error.message}`);
  return updated as Group;
}

export async function deleteGroup(id: string): Promise<void> {
  const supabase = createBrowserClient();
  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete group: ${error.message}`);
}

// ============================================================
// CONTACT MUTATIONS
// ============================================================

export async function insertContact(data: {
  name: string;
  aliases?: string[];
  phone?: string | null;
  role?: string | null;
  notes?: string | null;
}): Promise<Contact> {
  const supabase = createBrowserClient();
  const { data: inserted, error } = await supabase
    .from('contacts')
    .insert(data as any)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert contact: ${error.message}`);
  return inserted as Contact;
}

export async function updateContact(
  id: string,
  data: Partial<{
    name: string;
    aliases: string[];
    phone: string | null;
    role: string | null;
    notes: string | null;
  }>
): Promise<Contact> {
  const supabase = createBrowserClient();
  const { data: updated, error } = await (supabase as any)
    .from('contacts')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update contact: ${error.message}`);
  return updated as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = createBrowserClient();
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete contact: ${error.message}`);
}

export async function getContactById(id: string): Promise<Contact | null> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch contact: ${error.message}`);
  }
  return data as Contact;
}

// ============================================================
// SERVER-SIDE GROUP MUTATIONS (for bot use)
// ============================================================

export async function upsertGroupServer(data: {
  wa_group_jid: string;
  name: string;
  category?: string;
  is_active?: boolean;
}): Promise<Group> {
  const supabase = createServerClient();
  const { data: upserted, error } = await supabase
    .from('groups')
    .upsert(
      { category: 'custom', is_active: false, ...data } as any,
      { onConflict: 'wa_group_jid' }
    )
    .select()
    .single();
  if (error) throw new Error(`Failed to upsert group (server): ${error.message}`);
  return upserted as Group;
}

// ============================================================
// BOT SESSION QUERIES
// ============================================================

/**
 * Fetch bot session by session ID
 * Used by Baileys session store on bot startup
 */
export async function getBotSession(sessionId: string): Promise<BotSession | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('bot_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch bot session: ${error.message}`);
  }

  return data as BotSession;
}

/**
 * Upsert bot session (create or update)
 * Called by Baileys session store on auth credential updates
 * Ensures bot can persist authentication state across restarts
 */
export async function upsertBotSession(data: {
  session_id: string;
  creds: Record<string, unknown>;
  keys: Record<string, unknown>;
}): Promise<BotSession> {
  const supabase = createServerClient();

  const { data: upserted, error } = await supabase
    .from('bot_sessions')
    .upsert(data as any, { onConflict: 'session_id' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert bot session: ${error.message}`);
  }

  return upserted as BotSession;
}

// ============================================================
// DEDUPLICATION QUERIES
// ============================================================

/**
 * Check if a WhatsApp message ID already exists in transactions
 * Prevents duplicate transaction entries from re-processed messages
 */
export async function checkDuplicateByMessageId(wa_message_id: string): Promise<boolean> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact' })
    .eq('wa_message_id', wa_message_id)
    .eq('is_deleted', false);

  if (error) {
    throw new Error(`Failed to check duplicate message: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Check if a transaction ID (extracted from UPI/bank context) already exists
 * Some payment receipts include transaction IDs that should be unique
 */
export async function checkDuplicateTxnId(txn_id: string): Promise<boolean> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact' })
    .eq('txn_id', txn_id)
    .eq('is_deleted', false);

  if (error) {
    throw new Error(`Failed to check duplicate transaction ID: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}
