/**
 * GET /api/message-logs
 * Returns recent message logs for the Settings page debug panel
 */

export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';

export async function GET(): Promise<Response> {
  try {
    const db = createServerClient() as any;

    const { data, error } = await db
      .from('message_logs')
      .select('id, group_name, sender, message_type, text_preview, status, skip_reason, amount, transaction_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return Response.json({ logs: [] }, { status: 200 });
    }

    return Response.json(
      { logs: data ?? [] },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      }
    );
  } catch (err) {
    console.error('message-logs error:', err);
    return Response.json({ logs: [] }, { status: 200 });
  }
}
