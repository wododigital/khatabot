/**
 * GET /api/qr
 * Serves QR code for WhatsApp bot linking
 * Returns PNG image or JSON status message
 */

export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';

export async function GET(): Promise<Response> {
  try {
    const db = createServerClient() as any;
    const sessionId = process.env.BOT_SESSION_ID || 'khatabot-primary';

    const { data: session, error } = await db
      .from('bot_sessions')
      .select('qr_code_png, qr_pending, creds')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      return Response.json(
        { status: 'error', message: 'Bot session not found' },
        { status: 404 }
      );
    }

    if (session?.qr_code_png && session.qr_pending === true) {
      let pngBuffer: Buffer;
      const raw = session.qr_code_png;
      console.log('[QR] qr_code_png type:', typeof raw, 'length:', raw?.length, 'starts with:', String(raw).substring(0, 20));

      if (raw instanceof Buffer || raw instanceof Uint8Array) {
        // Already binary
        pngBuffer = Buffer.from(raw);
      } else if (typeof raw === 'string' && raw.startsWith('\\x')) {
        // Supabase bytea hex format: \x6956424f... -> decode hex to get the base64 string, then decode base64
        const hexStr = raw.slice(2);
        const base64Str = Buffer.from(hexStr, 'hex').toString('utf-8');
        pngBuffer = Buffer.from(base64Str, 'base64');
      } else if (typeof raw === 'string' && raw.startsWith('iVBOR')) {
        // Plain base64 PNG string
        pngBuffer = Buffer.from(raw, 'base64');
      } else if (typeof raw === 'string') {
        // Try base64 decode as fallback
        pngBuffer = Buffer.from(raw, 'base64');
      } else {
        console.error('[QR] Unexpected qr_code_png format:', typeof raw);
        return Response.json({ status: 'error', message: 'Invalid QR data format' }, { status: 500 });
      }

      console.log('[QR] PNG buffer size:', pngBuffer.length, 'first bytes:', pngBuffer.slice(0, 4).toString('hex'));

      return new Response(new Uint8Array(pngBuffer), {
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

    const registered = session?.creds?.registered === true;
    if (registered) {
      return Response.json(
        { status: 'connected', message: 'Bot is already connected, QR code not needed' },
        { status: 200 }
      );
    }

    return Response.json(
      { status: 'disconnected', message: 'Bot is not connected. Start the bot process to generate a QR code.' },
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
