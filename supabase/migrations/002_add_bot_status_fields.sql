-- Migration: Add QR code and status tracking to bot_sessions
-- Phase 6: Polish - QR Endpoint and Bot Status API

ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS qr_code_png BYTEA;
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS qr_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS messages_processed INTEGER DEFAULT 0;
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS uptime_seconds INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bot_sessions_qr_pending ON bot_sessions(qr_pending);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_last_message_at ON bot_sessions(last_message_at);
