import { NextRequest } from 'next/server';
import { getSession } from '@/lib/server/ptyManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const enabled = process.env.SOLOHACK_PTY_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
    if (!enabled) return new Response('PTY disabled', { status: 403 });
    const id = (req.nextUrl.searchParams.get('id') || '').trim();
    if (!id) return new Response('Missing id', { status: 400 });
    const sess = getSession(id);
    if (!sess) return new Response('Not found', { status: 404 });
    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(`Error: ${e?.message ?? 'unknown'}`, { status: 500 });
  }
}

