import { NextRequest } from 'next/server';
import { getSession } from '@/lib/server/ptyManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const enabled = process.env.SOLOHACK_PTY_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
    if (!enabled) return new Response('PTY disabled', { status: 403 });
    const body = (await req.json()) as { id?: string; cols?: number; rows?: number };
    const id = (body.id || '').trim();
    if (!id) return new Response('Missing id', { status: 400 });
    const sess = getSession(id);
    if (!sess) return new Response('No session', { status: 404 });
    const cols = Math.max(1, Math.floor(body.cols || 80));
    const rows = Math.max(1, Math.floor(body.rows || 24));
    sess.pty.resize(cols, rows);
    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(`Error: ${e?.message ?? 'unknown'}`, { status: 500 });
  }
}

