/**
 * Session Store (Baileys Auth State Provider)
 * Persists WhatsApp session credentials to Supabase
 * Allows bot to reconnect without QR re-scan on restart
 */

import { createServerClient } from '@/lib/supabase/server.js';
import {
  initAuthCreds,
  BufferJSON,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import type { AuthenticationCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: false } } }
    : {}),
});

export interface SessionAuthState {
  state: { creds: AuthenticationCreds; keys: ReturnType<typeof makeCacheableSignalKeyStore> };
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
}

/**
 * Initialize Baileys auth state from Supabase
 * Creates new session record if doesn't exist
 * Returns proper SignalKeyStore (not a plain object)
 */
export async function useSupabaseAuthState(
  sessionId: string
): Promise<SessionAuthState> {
  const db = createServerClient() as any;
  let creds: AuthenticationCreds;
  let keysData: Record<string, unknown> = {};

  try {
    const { data: existingSession, error } = await (
      db
        .from('bot_sessions')
        .select('creds, keys')
        .eq('session_id', sessionId)
        .single() as Promise<any>
    );

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (existingSession?.creds && Object.keys(existingSession.creds).length > 0) {
      logger.info({ sessionId }, 'Loaded existing session from Supabase');
      // Deserialize creds using BufferJSON to restore Buffer objects
      creds = JSON.parse(JSON.stringify(existingSession.creds), BufferJSON.reviver);
      keysData = existingSession.keys || {};
    } else {
      logger.info({ sessionId }, 'Creating new session with fresh credentials');
      creds = initAuthCreds();

      // Insert new session with initialized creds
      const { error: insertError } = await (
        db.from('bot_sessions').upsert({
          session_id: sessionId,
          creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
          keys: {},
        }, { onConflict: 'session_id' }) as Promise<any>
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

  // Build a proper SignalKeyStore with .get() and .set() methods
  // Baileys requires this interface, NOT a plain object
  const keyStore: any = {
    get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]): Promise<Record<string, SignalDataTypeMap[T]>> => {
      const data: Record<string, SignalDataTypeMap[T]> = {};
      const typeMap = (keysData[type] as Record<string, unknown>) || {};
      for (const id of ids) {
        const value = typeMap[id];
        if (value) {
          data[id] = JSON.parse(JSON.stringify(value), BufferJSON.reviver);
        }
      }
      return data;
    },
    set: async (data: Record<string, Record<string, unknown | null>>): Promise<void> => {
      for (const category in data) {
        if (!keysData[category]) {
          keysData[category] = {};
        }
        const categoryMap = keysData[category] as Record<string, unknown>;
        for (const id in data[category]) {
          const value = data[category][id];
          if (value) {
            categoryMap[id] = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
          } else {
            delete categoryMap[id];
          }
        }
      }
    },
  };

  // Wrap with Baileys' caching layer for performance
  const keys = makeCacheableSignalKeyStore(keyStore, logger as any);

  // Save credentials whenever Baileys updates them
  const saveCreds = async (): Promise<void> => {
    try {
      const { error } = await (
        db
          .from('bot_sessions')
          .update({
            creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
            keys: JSON.parse(JSON.stringify(keysData, BufferJSON.replacer)),
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
      const newCreds = initAuthCreds();
      const { error } = await (
        db
          .from('bot_sessions')
          .update({
            creds: JSON.parse(JSON.stringify(newCreds, BufferJSON.replacer)),
            keys: {},
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId) as Promise<any>
      );

      if (error) {
        throw error;
      }

      Object.assign(creds, newCreds);
      keysData = {};

      logger.info({ sessionId }, 'Session cleared');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ sessionId, error: message }, 'Failed to clear session');
    }
  };

  return { state: { creds, keys }, saveCreds, clearState };
}
