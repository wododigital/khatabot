/**
 * Session Store (Baileys Auth State Provider)
 * Persists WhatsApp session credentials to Supabase
 * Allows bot to reconnect without QR re-scan on restart
 */

import { createServerClient } from '@/lib/supabase/server.js';
import pino from 'pino';
import type { AuthenticationState } from '@whiskeysockets/baileys';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: false },
  },
});

export interface SessionAuthState {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
}

/**
 * Initialize Baileys auth state from Supabase
 * Creates new session record if doesn't exist
 */
export async function useSupabaseAuthState(
  sessionId: string
): Promise<SessionAuthState> {
  const db = createServerClient() as any;
  let credsData: Record<string, unknown> = {};
  let keysData: Record<string, unknown> = {};

  try {
    // Load existing session credentials
    const { data: existingSession, error } = await (
      db
        .from('bot_sessions')
        .select('creds, keys')
        .eq('session_id', sessionId)
        .single() as Promise<any>
    );

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, which is expected on first run
      throw error;
    }

    if (existingSession) {
      logger.info({ sessionId }, 'Loaded existing session from Supabase');
      credsData = existingSession.creds || {};
      keysData = existingSession.keys || {};
    } else {
      logger.info({ sessionId }, 'Creating new session in Supabase');
      // Insert new empty session
      const { error: insertError } = await (
        db.from('bot_sessions').insert({
          session_id: sessionId,
          creds: {},
          keys: {},
        }) as Promise<any>
      );

      if (insertError) {
        throw insertError;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ sessionId, error: message }, 'Failed to load session');
    throw err;
  }

  // Baileys auth state object
  const authState: AuthenticationState = {
    creds: credsData as any,
    keys: keysData as any,
  };

  // Save credentials whenever Baileys updates them
  const saveCreds = async (): Promise<void> => {
    try {
      const { error } = await (
        db
          .from('bot_sessions')
          .update({
            creds: authState.creds,
            keys: authState.keys,
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId) as Promise<any>
      );

      if (error) {
        throw error;
      }

      logger.debug({ sessionId }, 'Session credentials saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ sessionId, error: message }, 'Failed to save credentials');
    }
  };

  // Clear session (on logout or session reset)
  const clearState = async (): Promise<void> => {
    try {
      const { error } = await (
        db
          .from('bot_sessions')
          .update({
            creds: {},
            keys: {},
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId) as Promise<any>
      );

      if (error) {
        throw error;
      }

      authState.creds = {} as any;
      authState.keys = {} as any;

      logger.info({ sessionId }, 'Session cleared');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ sessionId, error: message }, 'Failed to clear session');
    }
  };

  return { state: authState, saveCreds, clearState };
}
