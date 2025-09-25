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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rel = (searchParams.get('p') || '').trim();
    const root = getRoot();
    const file = path.resolve(root, rel || '.');
    if (!isInside(root, file)) return new Response('Path out of scope', { status: 400 });
    const st = await fs.stat(file);
    if (!st.isFile()) return new Response('Not a file', { status: 400 });
    const MAX = 100 * 1024; // 100KB 上限
    const text = await fs.readFile(file, 'utf8');
    const truncated = text.length > MAX;
    const out = text.slice(0, MAX);
    return new Response(out, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Truncated': String(truncated) },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
