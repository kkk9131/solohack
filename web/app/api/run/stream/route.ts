import { spawn } from 'node:child_process';
import path from 'node:path';

export const runtime = 'nodejs';

type Payload = {
  preset: 'build-web' | 'lint-web' | 'test-repo' | 'echo';
  message?: string; // echo のみ
};

function getRepoRoot() {
  const env = (process.env.SOLOHACK_REPO_ROOT || '').trim();
  // web/ の 1 つ上がリポジトリルート
  return path.resolve(env || path.resolve(process.cwd(), '..'));
}

function parsePayload(value: unknown): Payload {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid payload');
  }
  const record = value as Record<string, unknown>;
  const preset = record.preset;
  if (preset !== 'build-web' && preset !== 'lint-web' && preset !== 'test-repo' && preset !== 'echo') {
    throw new Error('Invalid preset');
  }
  const message = typeof record.message === 'string' ? record.message : undefined;
  return { preset, message };
}

export async function POST(req: Request) {
  try {
    const enabled = process.env.SOLOHACK_RUN_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
    if (!enabled) return new Response('Run disabled', { status: 403 });
    const body = parsePayload(await req.json());
    const repoRoot = getRepoRoot();
    let cmd = '';
    let args: string[] = [];
    let cwd = repoRoot;

    switch (body.preset) {
      case 'build-web':
        cwd = path.join(repoRoot, 'web');
        cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        args = ['run', 'build'];
        break;
      case 'lint-web':
        cwd = path.join(repoRoot, 'web');
        cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        args = ['run', 'lint'];
        break;
      case 'test-repo':
        cwd = repoRoot;
        cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        args = ['test', '--', '--run'];
        break;
      case 'echo':
        cmd = process.platform === 'win32' ? 'cmd' : 'bash';
        args = process.platform === 'win32' ? ['/c', `echo ${body.message ?? 'Hello from SoloHack'}`] : ['-lc', `echo ${body.message ?? 'Hello from SoloHack'}`];
        break;
      default:
        return new Response('Invalid preset', { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (type: string, data: string) => {
          controller.enqueue(encoder.encode(`${type ? `event: ${type}\n` : ''}data: ${data}\n\n`));
        };
        try {
          const child = spawn(cmd, args, { cwd, shell: false });
          send('', `[cwd] ${cwd}`);
          send('', `[cmd] ${cmd} ${args.join(' ')}`);
          child.stdout.on('data', (d) => send('out', d.toString()));
          child.stderr.on('data', (d) => send('err', d.toString()));
          child.on('error', (error) => {
            const message = error instanceof Error ? error.message : String(error);
            send('err', `spawn error: ${message}`);
          });
          child.on('close', (code) => {
            send('exit', String(code ?? 0));
            controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
            controller.close();
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown';
          send('err', message);
          controller.close();
        }
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
