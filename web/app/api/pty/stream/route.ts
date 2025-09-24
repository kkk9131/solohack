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
    // 日本語メモ: ReadableStream の start() はコンストラクタ内で同期呼び出しされるため、
    // その中で外側の const stream を参照するとTDZで落ちる。クリーンアップはクロージャ変数で持つ。
    let cleanup: (() => void) | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (type: string, data: string) => controller.enqueue(encoder.encode(`${type ? `event: ${type}\n` : ''}data: ${data}\n\n`));
        const dataDisp = sess.pty.onData((d: string) => send('out', d));
        const exitDisp = sess.pty.onExit(({ exitCode }: any) => {
          send('exit', String(exitCode ?? 0));
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
    // @ts-ignore custom hook for cleanup on Node/Next response close (best-effort)
    (res as any).on?.('close', () => { try { cleanup?.(); } catch {} });
    return res;
  } catch (e: any) {
    return new Response(`Error: ${e?.message ?? 'unknown'}`, { status: 500 });
  }
}
