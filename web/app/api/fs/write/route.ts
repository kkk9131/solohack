import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

function getRoot() {
  const env = (process.env.SOLOHACK_REPO_ROOT || '').trim();
  const root = env || path.resolve(process.cwd(), '..');
  return path.resolve(root);
}

function isInside(base: string, target: string) {
  const b = path.resolve(base) + path.sep;
  const t = path.resolve(target) + path.sep;
  return t.startsWith(b);
}

type WritePayload = {
  p?: string;
  content?: string;
};

function parsePayload(value: unknown): WritePayload {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid payload');
  }
  const record = value as Record<string, unknown>;
  return {
    p: typeof record.p === 'string' ? record.p : undefined,
    content: typeof record.content === 'string' ? record.content : undefined,
  };
}

export async function POST(req: Request) {
  try {
    const enabled = process.env.SOLOHACK_FS_WRITE_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
    if (!enabled) return new Response('Write disabled', { status: 403 });
    const body = parsePayload(await req.json());
    const rel = (body.p || '').trim();
    const content = body.content ?? '';
    if (!rel) return new Response('Missing path', { status: 400 });
    if (typeof content !== 'string') return new Response('Invalid content', { status: 400 });
    const MAX = 200 * 1024; // 200KB 限定
    if (content.length > MAX) return new Response('Too large', { status: 413 });
    const root = getRoot();
    const file = path.resolve(root, rel);
    if (!isInside(root, file)) return new Response('Path out of scope', { status: 400 });
    const st = await fs.stat(file).catch(() => null);
    if (!st || !st.isFile()) return new Response('Not a file', { status: 400 });
    await fs.writeFile(file, content, 'utf8');
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
