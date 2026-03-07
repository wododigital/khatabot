/**
 * Supabase Database Types
 * Auto-generated type definitions for all tables
 * Generated from schema: supabase/migrations/001_initial_schema.sql
 */

export interface Tables {
  groups: {
    Row: {
      id: string;
      wa_group_jid: string;
      name: string;
      category: 'home' | 'personal' | 'company' | 'custom';
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      wa_group_jid: string;
      name: string;
      category: 'home' | 'personal' | 'company' | 'custom';
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      wa_group_jid?: string;
      name?: string;
      category?: 'home' | 'personal' | 'company' | 'custom';
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    };
  };
  contacts: {
    Row: {
      id: string;
      name: string;
      aliases: string[];
      phone: string | null;
      role: string | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      name: string;
      aliases?: string[];
      phone?: string | null;
      role?: string | null;
      notes?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      name?: string;
      aliases?: string[];
      phone?: string | null;
      role?: string | null;
      notes?: string | null;
      created_at?: string;
      updated_at?: string;
    };
  };
  transactions: {
    Row: {
      id: string;
      group_id: string | null;
      contact_id: string | null;
      amount: number;
      person_name: string;
      purpose: string | null;
      category: string;
      payment_mode: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other' | null;
      txn_id: string | null;
      txn_date: string | null;
      notes: string | null;
      confidence: number | null;
      raw_message: string | null;
      wa_message_id: string | null;
      is_edited: boolean;
      is_deleted: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
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
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      group_id?: string | null;
      contact_id?: string | null;
      amount?: number;
      person_name?: string;
      purpose?: string | null;
      category?: string;
      payment_mode?: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other' | null;
      txn_id?: string | null;
      txn_date?: string | null;
      notes?: string | null;
      confidence?: number | null;
      raw_message?: string | null;
      wa_message_id?: string | null;
      is_edited?: boolean;
      is_deleted?: boolean;
      created_at?: string;
      updated_at?: string;
    };
  };
  attachments: {
    Row: {
      id: string;
      transaction_id: string;
      storage_path: string;
      file_type: string | null;
      original_filename: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      transaction_id: string;
      storage_path: string;
      file_type?: string | null;
      original_filename?: string | null;
      created_at?: string;
    };
    Update: never;
  };
  bot_sessions: {
    Row: {
      id: string;
      session_id: string;
      creds: Record<string, unknown>;
      keys: Record<string, unknown>;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      session_id: string;
      creds: Record<string, unknown>;
      keys: Record<string, unknown>;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      session_id?: string;
      creds?: Record<string, unknown>;
      keys?: Record<string, unknown>;
      created_at?: string;
      updated_at?: string;
    };
  };
  user_profiles: {
    Row: {
      id: string;
      phone_number: string | null;
      display_name: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id: string;
      phone_number?: string | null;
      display_name?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      phone_number?: string | null;
      display_name?: string | null;
      created_at?: string;
      updated_at?: string;
    };
  };
}

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, unknown>;
    Functions: {
      get_monthly_summary: {
        Args: { month_date: string };
        Returns: Array<{
          category: string;
          total_amount: number;
          transaction_count: number;
        }>;
      };
      get_spending_by_person: {
        Args: { start_date: string; end_date: string };
        Returns: Array<{
          person_name: string;
          total_amount: number;
          transaction_count: number;
        }>;
      };
    };
    Enums: Record<string, unknown>;
  };
  graphql_public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
  Schemas: {
    public: 'public';
    graphql_public: 'graphql_public';
  };
};
