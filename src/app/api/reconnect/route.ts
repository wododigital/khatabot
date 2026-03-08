/**
 * POST /api/reconnect
 * Clears bot credentials so next Railway restart generates a fresh QR
 */

export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';

export async function POST(): Promise<Response> {
  try {
    const db = createServerClient() as any;
    const sessionId = process.env.BOT_SESSION_ID || 'khatabot-primary';

    await db
      .from('bot_sessions')
      .update({
        creds: {},
        keys: {},
        qr_code_png: null,
        qr_pending: false,
        last_heartbeat: null,
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('reconnect error:', err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
