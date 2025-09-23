import { NextRequest } from 'next/server';
import { killSession } from '@/lib/server/ptyManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const enabled = process.env.SOLOHACK_PTY_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
    if (!enabled) return new Response('PTY disabled', { status: 403 });
    const body = (await req.json()) as { id?: string };
    const id = (body.id || '').trim();
    if (!id) return new Response('Missing id', { status: 400 });
    const ok = killSession(id);
    return Response.json({ ok });
  } catch (e: any) {
    return new Response(`Error: ${e?.message ?? 'unknown'}`, { status: 500 });
  }
}

