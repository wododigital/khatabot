/**
 * GET /api/qr
 * Serves QR code for WhatsApp bot linking
 * Returns PNG image or JSON status message
 */

import { createServerClient } from '@/lib/supabase/server';

export async function GET(): Promise<Response> {
  try {
    const db = createServerClient() as any;
    const sessionId = process.env.BOT_SESSION_ID || 'khatabot-primary';

    const { data: session, error } = await db
      .from('bot_sessions')
      .select('qr_code_png, qr_pending')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      return Response.json(
        { status: 'error', message: 'Bot session not found' },
        { status: 404 }
      );
    }

    if (session?.qr_code_png && session.qr_pending === true) {
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

    if (session?.qr_pending === true) {
      return Response.json(
        { status: 'pending', message: 'QR code is being generated, please try again in a moment' },
        { status: 202, headers: { 'Cache-Control': 'no-cache' } }
      );
    }

    return Response.json(
      { status: 'connected', message: 'Bot is already connected, QR code not needed' },
      { status: 200 }
    );
  } catch (error) {
    console.error('QR endpoint error:', error);
    return Response.json(
      { status: 'error', message: 'Failed to fetch QR code' },
      { status: 500 }
    );
  }
}
