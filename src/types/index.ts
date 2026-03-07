/**
 * KhataBot Type Definitions
 * All shared TypeScript interfaces for database, AI, bot pipeline, and dashboard
 */

// ============================================================
// DATABASE ROW TYPES (Supabase tables)
// ============================================================

export interface Group {
  id: string;
  wa_group_jid: string;
  name: string;
  category: 'home' | 'personal' | 'company' | 'custom';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  name: string;
  aliases: string[];
  phone?: string | null;
  role?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
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
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  transaction_id: string;
  storage_path: string;
  file_type?: string | null;
  original_filename?: string | null;
  created_at: string;
}

export interface BotSession {
  id: string;
  session_id: string;
  creds: Record<string, unknown>;
  keys: Record<string, unknown>;
  qr_code_png?: Buffer | string | null;
  qr_pending?: boolean;
  last_message_at?: string | null;
  messages_processed?: number;
  uptime_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  phone_number?: string | null;
  display_name?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// AI EXTRACTION TYPES (Claude API integration)
// ============================================================

export interface ParsedTransaction {
  transaction: {
    amount: number;
    person_name: string;
    purpose?: string;
    category: string;
    payment_mode?: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
    txn_date?: string;
    txn_id?: string;
  };
  confidence: number;
  has_image_evidence: boolean;
  extracted_text?: string;
  validation_notes?: string[];
}

export interface EnrichedExtraction extends ParsedTransaction {
  matched_contact?: Contact;
  matched_group?: Group;
  matched_contact_confidence?: number;
  is_potential_duplicate?: boolean;
  duplicate_candidate_ids?: string[];
}

// ============================================================
// BOT PIPELINE TYPES
// ============================================================

export type MessageType = 'text' | 'image' | 'document' | 'irrelevant';

export interface ClassifiedMessage {
  original_jid: string;
  message_type: MessageType;
  text_content?: string;
  image_buffer?: Buffer;
  image_mime?: string;
  document_buffer?: Buffer;
  document_filename?: string;
  wa_message_id: string;
  timestamp: number;
  sender_name: string;
}

export interface BotStatus {
  is_connected: boolean;
  last_message_time?: number;
  pending_extractions: number;
  error_count_24h: number;
  uptime_seconds: number;
}

// ============================================================
// DASHBOARD TYPES
// ============================================================

export interface TransactionWithRelations extends Transaction {
  group?: Group | null;
  contact?: Contact | null;
  attachments?: Attachment[];
}

export interface TransactionSummary {
  total_amount: number;
  transaction_count: number;
  by_category: Record<string, number>;
  by_payment_mode: Record<string, number>;
  by_person: Array<{
    person_name: string;
    amount: number;
    count: number;
  }>;
  date_range: {
    start: string;
    end: string;
  };
}

export interface TransactionFilters {
  group_id?: string;
  contact_id?: string;
  category?: string;
  payment_mode?: string;
  search_query?: string;
  date_from?: string;
  date_to?: string;
  is_deleted?: boolean;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// ============================================================
// UTILITY TYPES
// ============================================================

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'INTERNAL_ERROR',
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ============================================================
// SUPABASE AUTH TYPES
// ============================================================

export interface AuthSession {
  user: {
    id: string;
    phone: string | null;
    email: string | null;
  };
  session: {
    access_token: string;
    refresh_token: string | null;
    expires_at: number;
  };
}

// ============================================================
// BAILEYS MESSAGE TYPES (WhatsApp protocol)
// ============================================================

export interface WhatsAppMessage {
  key: {
    remoteJid: string;
    id: string;
    fromMe: boolean;
  };
  messageTimestamp: number;
  pushName?: string;
  message?: {
    conversation?: string;
    imageMessage?: {
      url?: string;
      mediaKey?: string;
      mimetype?: string;
      caption?: string;
    };
    documentMessage?: {
      url?: string;
      mediaKey?: string;
      mimetype?: string;
      fileName?: string;
    };
  };
}

// ============================================================
// CATEGORY TYPES
// ============================================================

export const TRANSACTION_CATEGORIES = [
  'income',
  'expense',
  'transfer',
  'investment',
  'savings',
  'debt',
  'medical',
  'food',
  'transport',
  'utilities',
  'entertainment',
  'shopping',
  'education',
  'other',
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const PAYMENT_MODES = [
  'cash',
  'upi',
  'bank_transfer',
  'cheque',
  'other',
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const GROUP_CATEGORIES = ['home', 'personal', 'company', 'custom'] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number];
