export async function GET(): Promise<Response> {
  return new Response('Supabase auth callback', { status: 200 });
}
