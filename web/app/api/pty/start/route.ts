import { NextRequest } from 'next/server';
import { createSession } from '@/lib/server/ptyManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const enabled = process.env.SOLOHACK_PTY_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
    if (!enabled) return new Response('PTY disabled', { status: 403 });
    const body = (await req.json().catch(() => ({}))) as {
      cwd?: string;
      cols?: number;
      rows?: number;
      shell?: string;
      prompt?: string;
    };
    const sess = await createSession({
      cwd: body.cwd,
      cols: body.cols ?? 80,
      rows: body.rows ?? 24,
      shell: body.shell,
      prompt: body.prompt,
    });
    return Response.json({ id: sess.id, cwd: sess.cwd });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
