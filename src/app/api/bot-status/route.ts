/**
 * GET /api/bot-status
 * Returns bot connection state, uptime, and message processing stats
 */

export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';

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
  const sessionId = process.env.BOT_SESSION_ID || 'khatabot-primary';

  try {
    const db = createServerClient() as any;

    const { data: session, error } = await db
      .from('bot_sessions')
      .select('created_at, updated_at, last_message_at, messages_processed, qr_pending, creds, last_heartbeat')
      .eq('session_id', sessionId)
      .single();

    if (error || !session) {
      return Response.json(
        {
          connected: false,
          sessionId,
          lastMessageAt: null,
          messagesProcessed: 0,
          uptimeSeconds: 0,
          qrPending: false,
          timestamp: new Date().toISOString(),
        } as BotStatusResponse,
        { status: 200 }
      );
    }

    const uptimeSeconds = Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000);
    const qrPending = session.qr_pending === true;
    // Bot is live only if heartbeat was received within the last 60 seconds
    const lastHeartbeat = session.last_heartbeat ? new Date(session.last_heartbeat).getTime() : 0;
    const heartbeatFresh = Date.now() - lastHeartbeat < 60_000;
    const paired = !!session.creds?.me?.id;
    const connected = paired && heartbeatFresh && !qrPending;

    return Response.json(
      {
        connected,
        sessionId,
        lastMessageAt: session.last_message_at || null,
        messagesProcessed: session.messages_processed || 0,
        uptimeSeconds,
        qrPending,
        timestamp: new Date().toISOString(),
      } as BotStatusResponse,
      {
        status: 200,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Bot status endpoint error:', errMsg);
    return Response.json(
      {
        connected: false,
        sessionId,
        lastMessageAt: null,
        messagesProcessed: 0,
        uptimeSeconds: 0,
        qrPending: false,
        timestamp: new Date().toISOString(),
      } as BotStatusResponse,
      { status: 500 }
    );
  }
}
