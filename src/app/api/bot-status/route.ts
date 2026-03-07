/**
 * GET /api/bot-status
 * Returns bot connection state, uptime, and message processing stats
 * Used by dashboard /settings page for polling
 */

import { createServerClient } from '@/lib/supabase/server';
import pino from 'pino';

const logger = pino(
  process.env.NODE_ENV === 'development'
    ? { level: process.env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty' } }
    : { level: process.env.LOG_LEVEL || 'info' }
);

export interface BotStatusResponse {
  connected: boolean;
  sessionId: string;
  lastMessageAt: string | null;
  messagesProcessed: number;
  uptimeSeconds: number;
  qrPending: boolean;
  timestamp: string;
}

export async function GET(): Promise<Response> {
  try {
    const db = createServerClient() as any;
    const sessionId = process.env.BOT_SESSION_ID || 'khatabot-primary';

    // Fetch bot session status
    const { data: session, error } = await db
      .from('bot_sessions')
      .select(
        'created_at, updated_at, last_message_at, messages_processed, qr_pending'
      )
      .eq('session_id', sessionId)
      .single();

    if (error) {
      logger.warn(
        { error, sessionId },
        'Failed to fetch bot session status'
      );
      return new Response(
        JSON.stringify({
          connected: false,
          sessionId,
          lastMessageAt: null,
          messagesProcessed: 0,
          uptimeSeconds: 0,
          qrPending: false,
          timestamp: new Date().toISOString(),
        } as BotStatusResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!session) {
      logger.warn({ sessionId }, 'No bot session found');
      return new Response(
        JSON.stringify({
          connected: false,
          sessionId,
          lastMessageAt: null,
          messagesProcessed: 0,
          uptimeSeconds: 0,
          qrPending: false,
          timestamp: new Date().toISOString(),
        } as BotStatusResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate uptime in seconds
    const sessionCreatedAt = new Date(session.created_at).getTime();
    const uptimeMs = Date.now() - sessionCreatedAt;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);

    // Bot is considered connected if:
    // 1. It has processed messages recently (within last 5 minutes)
    // 2. AND it's not waiting for QR
    const lastMessageTime = session.last_message_at
      ? new Date(session.last_message_at).getTime()
      : null;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentActivity =
      lastMessageTime !== null && lastMessageTime > fiveMinutesAgo;
    const qrPending = session.qr_pending === true;
    const connected = recentActivity && !qrPending;

    const response: BotStatusResponse = {
      connected,
      sessionId,
      lastMessageAt: session.last_message_at || null,
      messagesProcessed: session.messages_processed || 0,
      uptimeSeconds,
      qrPending: qrPending,
      timestamp: new Date().toISOString(),
    };

    logger.debug(
      { sessionId, connected, uptimeSeconds },
      'Bot status retrieved'
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Bot status endpoint error');

    return new Response(
      JSON.stringify({
        connected: false,
        sessionId: process.env.BOT_SESSION_ID || 'khatabot-primary',
        lastMessageAt: null,
        messagesProcessed: 0,
        uptimeSeconds: 0,
        qrPending: false,
        timestamp: new Date().toISOString(),
      } as BotStatusResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
