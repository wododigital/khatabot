/**
 * DELETE /api/transactions/[id]
 * Hard-deletes a transaction by ID
 */

export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const { id } = params;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  try {
    const db = createServerClient() as any;
    const { error } = await db.from('transactions').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('delete transaction error:', err);
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
