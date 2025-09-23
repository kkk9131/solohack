import { NextRequest } from 'next/server';
import { getSession } from '@/lib/server/ptyManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const enabled = process.env.SOLOHACK_PTY_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
    if (!enabled) return new Response('PTY disabled', { status: 403 });
    const id = (req.nextUrl.searchParams.get('id') || '').trim();
    const sess = id && getSession(id);
    if (!sess) return new Response('No session', { status: 404 });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (type: string, data: string) => controller.enqueue(encoder.encode(`${type ? `event: ${type}\n` : ''}data: ${data}\n\n`));
        const onData = (d: string) => send('out', d);
        const onExit = ({ exitCode }: any) => {
          send('exit', String(exitCode ?? 0));
          controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
          controller.close();
        };
        sess.pty.onData(onData);
        sess.pty.onExit(onExit);
        // クライアント切断時のクリーンアップ
        // NOTE: セッション自体は保持（再接続許容）。必要ならここでkillも可能。
        // controller.tee は不要、ReadableStream#cancelで検知
      },
      cancel() {},
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (e: any) {
    return new Response(`Error: ${e?.message ?? 'unknown'}`, { status: 500 });
  }
}

