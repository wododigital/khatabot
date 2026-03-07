-- KhataBot Database Schema
-- Initial migration: Groups, Contacts, Transactions, Attachments, Bot Sessions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. GROUPS TABLE
-- Maps WhatsApp group JIDs to user-defined categories
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wa_group_jid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('home', 'personal', 'company', 'custom')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_wa_group_jid ON groups(wa_group_jid);
CREATE INDEX idx_groups_category ON groups(category);

-- 2. CONTACTS TABLE
-- Known people for consistent name matching
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  phone TEXT,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_name ON contacts(name);
CREATE INDEX idx_contacts_phone ON contacts(phone);

-- 3. TRANSACTIONS TABLE
-- Core financial data
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  person_name TEXT NOT NULL,
  purpose TEXT,
  category TEXT NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  txn_id TEXT,
  txn_date DATE,
  notes TEXT,
  confidence NUMERIC(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
  raw_message TEXT,
  wa_message_id TEXT UNIQUE,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_group_id ON transactions(group_id);
CREATE INDEX idx_transactions_contact_id ON transactions(contact_id);
CREATE INDEX idx_transactions_txn_date ON transactions(txn_date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_person_name ON transactions(person_name);
CREATE INDEX idx_transactions_wa_message_id ON transactions(wa_message_id);
CREATE INDEX idx_transactions_is_deleted ON transactions(is_deleted);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- 4. ATTACHMENTS TABLE
-- Images: UPI screenshots, receipt photos
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  original_filename TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_transaction_id ON attachments(transaction_id);
CREATE INDEX idx_attachments_storage_path ON attachments(storage_path);

-- 5. BOT_SESSIONS TABLE
-- Baileys auth persistence
CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT UNIQUE NOT NULL,
  creds JSONB NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bot_sessions_session_id ON bot_sessions(session_id);

-- 6. AUTH USERS TABLE (extends Supabase auth.users)
-- Store additional user profile data
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_phone_number ON user_profiles(phone_number);

-- ============================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
-- Since this is a single-user app, all transactions belong to the authenticated user

-- Groups: Owner can see all (future: multi-user)
CREATE POLICY "users_can_read_groups" ON groups
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "users_can_insert_groups" ON groups
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "users_can_update_groups" ON groups
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "users_can_delete_groups" ON groups
  FOR DELETE USING (auth.role() = 'authenticated');

-- Contacts: Owner can manage
CREATE POLICY "users_can_read_contacts" ON contacts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "users_can_insert_contacts" ON contacts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "users_can_update_contacts" ON contacts
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "users_can_delete_contacts" ON contacts
  FOR DELETE USING (auth.role() = 'authenticated');

-- Transactions: Owner can manage
CREATE POLICY "users_can_read_transactions" ON transactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "users_can_insert_transactions" ON transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "users_can_update_transactions" ON transactions
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "users_can_delete_transactions" ON transactions
  FOR DELETE USING (auth.role() = 'authenticated');

-- Attachments: Owner can manage (via transaction relationship)
CREATE POLICY "users_can_read_attachments" ON attachments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "users_can_insert_attachments" ON attachments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "users_can_delete_attachments" ON attachments
  FOR DELETE USING (auth.role() = 'authenticated');

-- Bot Sessions: Only accessible to service role (for Baileys persistence)
CREATE POLICY "bot_sessions_admin_only" ON bot_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- User Profiles: Users can only manage their own
CREATE POLICY "users_can_read_own_profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_can_update_own_profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at on groups
CREATE OR REPLACE FUNCTION update_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER groups_updated_at_trigger
BEFORE UPDATE ON groups
FOR EACH ROW
EXECUTE FUNCTION update_groups_updated_at();

-- Auto-update updated_at on contacts
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at_trigger
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_contacts_updated_at();

-- Auto-update updated_at on transactions
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_updated_at_trigger
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_transactions_updated_at();

-- Auto-update updated_at on bot_sessions
CREATE OR REPLACE FUNCTION update_bot_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bot_sessions_updated_at_trigger
BEFORE UPDATE ON bot_sessions
FOR EACH ROW
EXECUTE FUNCTION update_bot_sessions_updated_at();

-- Auto-update updated_at on user_profiles
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at_trigger
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_user_profiles_updated_at();

-- ============================================
-- STORED PROCEDURES
-- ============================================

-- Get monthly summary by category
CREATE OR REPLACE FUNCTION get_monthly_summary(month_date DATE)
RETURNS TABLE(category TEXT, total_amount NUMERIC, transaction_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.category,
    SUM(t.amount)::NUMERIC as total_amount,
    COUNT(*)::BIGINT as transaction_count
  FROM transactions t
  WHERE DATE_TRUNC('month', t.txn_date)::DATE = DATE_TRUNC('month', month_date)::DATE
    AND t.is_deleted = FALSE
  GROUP BY t.category
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql;

-- Get spending by person for a date range
CREATE OR REPLACE FUNCTION get_spending_by_person(start_date DATE, end_date DATE)
RETURNS TABLE(person_name TEXT, total_amount NUMERIC, transaction_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.person_name,
    SUM(t.amount)::NUMERIC as total_amount,
    COUNT(*)::BIGINT as transaction_count
  FROM transactions t
  WHERE t.txn_date BETWEEN start_date AND end_date
    AND t.is_deleted = FALSE
  GROUP BY t.person_name
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql;
