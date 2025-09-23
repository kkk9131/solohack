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

async function walk(dir: string, acc: string[], root: string, max: number) {
  if (acc.length >= max) return;
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.startsWith('.')) continue;
    if (name === 'node_modules' || name === '.git' || name === '.next' || name === 'dist' || name === 'coverage') continue;
    const p = path.join(dir, name);
    let st;
    try { st = await fs.stat(p); } catch { continue; }
    const rel = path.relative(root, p);
    if (!isInside(root, p)) continue;
    if (st.isDirectory()) {
      await walk(p, acc, root, max);
      if (acc.length >= max) return;
    } else {
      acc.push(rel);
      if (acc.length >= max) return;
    }
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(1000, Number(searchParams.get('limit') || 200)));
    const root = getRoot();
    const base = root;
    const files: string[] = [];
    await walk(base, files, root, limit);
    const filtered = q ? files.filter((f) => f.toLowerCase().includes(q)).slice(0, limit) : files.slice(0, limit);
    return Response.json({ root, files: filtered, total: files.length });
  } catch (e: any) {
    return new Response(`Error: ${e?.message ?? 'unknown'}`, { status: 500 });
  }
}

