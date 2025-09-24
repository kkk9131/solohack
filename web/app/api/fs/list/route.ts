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

type DirectoryEntry = {
  name: string;
  type: 'dir' | 'file';
  size?: number;
  mtimeMs: number;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rel = (searchParams.get('p') || '').trim();
    const showHidden = (searchParams.get('hidden') || '').toLowerCase() === 'true';
    const root = getRoot();
    const base = path.resolve(root, rel || '.');
    if (!isInside(root, base)) {
      return new Response('Path out of scope', { status: 400 });
    }
    const st = await fs.stat(base);
    if (!st.isDirectory()) {
      return new Response('Not a directory', { status: 400 });
    }
    const names = await fs.readdir(base);
    const entries = await Promise.all<DirectoryEntry | null>(
      names
        .filter((n) => (showHidden ? true : !n.startsWith('.'))) // dotfiles除外（必要ならhidden=true）
        .filter((n) => n !== 'node_modules' && n !== '.git')
        .map(async (name) => {
          const p = path.join(base, name);
          try {
            const s = await fs.stat(p);
            return {
              name,
              type: s.isDirectory() ? 'dir' : 'file',
              size: s.isDirectory() ? undefined : s.size,
              mtimeMs: s.mtimeMs,
            } satisfies DirectoryEntry;
          } catch {
            return null;
          }
        }),
    );
    const sorted = entries.filter((entry): entry is DirectoryEntry => Boolean(entry));
    sorted.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    return Response.json({
      root,
      path: path.relative(root, base) || '.',
      entries: sorted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
