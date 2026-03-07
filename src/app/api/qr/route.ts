/**
 * GET /api/qr
 * Serves QR code for WhatsApp bot linking
 * Returns PNG image or JSON status message
 */

import { createServerClient } from '@/lib/supabase/server';
import pino from 'pino';

const logger = pino(
  process.env.NODE_ENV === 'development'
    ? { level: process.env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty' } }
    : { level: process.env.LOG_LEVEL || 'info' }
);

export async function GET(): Promise<Response> {
  try {
    const db = createServerClient() as any;
    const sessionId = process.env.BOT_SESSION_ID || 'khatabot-primary';

    // Fetch QR code from bot_sessions
    const { data: session, error } = await db
      .from('bot_sessions')
      .select('qr_code_png, qr_pending')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      logger.warn({ error }, 'Failed to fetch bot session');
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Bot session not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // If QR code exists and is not pending, serve as PNG
    if (session?.qr_code_png && session.qr_pending === true) {
      logger.debug({ sessionId }, 'Serving QR code PNG');

      // Convert buffer to response
      const pngBuffer =
        session.qr_code_png instanceof Buffer
          ? session.qr_code_png
          : Buffer.from(session.qr_code_png, 'base64');

      return new Response(pngBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    // QR is pending or doesn't exist
    if (session?.qr_pending === true) {
      logger.debug({ sessionId }, 'QR pending, returning 202');
      return new Response(
        JSON.stringify({
          status: 'pending',
          message: 'QR code is being generated, please try again in a moment',
        }),
        {
          status: 202,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        }
      );
    }

    // No QR code available
    logger.debug({ sessionId }, 'No QR code available');
    return new Response(
      JSON.stringify({
        status: 'connected',
        message: 'Bot is already connected, QR code not needed',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'QR endpoint error');

    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Failed to fetch QR code',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
