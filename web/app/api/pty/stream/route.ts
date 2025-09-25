import { NextRequest } from 'next/server';
import { getSession } from '@/lib/server/ptyManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const enabled = process.env.SOLOHACK_PTY_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
    if (!enabled) return new Response('PTY disabled', { status: 403 });
    const id = (req.nextUrl.searchParams.get('id') || '').trim();
    const sess = id ? getSession(id) : null;
    if (!sess) return new Response('No session', { status: 404 });
    const encoder = new TextEncoder();
    // 日本語メモ: ReadableStream の start() はコンストラクタ内で同期呼び出しされるため、
    // その中で外側の const stream を参照するとTDZで落ちる。クリーンアップはクロージャ変数で持つ。
    let cleanup: (() => void) | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (type: string, data: string) => {
          controller.enqueue(encoder.encode(`${type ? `event: ${type}\n` : ''}data: ${data}\n\n`));
        };
        const dataDisp = sess.pty.onData((d: string) => send('out', d));
        const exitDisp = sess.pty.onExit((event) => {
          const exitCode = event?.exitCode ?? 0;
          send('exit', String(exitCode));
          controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
          controller.close();
          try { dataDisp.dispose(); } catch {}
          try { exitDisp.dispose(); } catch {}
        });
        cleanup = () => {
          try { dataDisp.dispose(); } catch {}
          try { exitDisp.dispose(); } catch {}
        };
      },
      cancel() {
        try { cleanup?.(); } catch {}
      },
    });
    const res = new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
    const nodeResponse = res as unknown as { on?: (event: string, handler: () => void) => void };
    nodeResponse.on?.('close', () => { try { cleanup?.(); } catch {} });
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
