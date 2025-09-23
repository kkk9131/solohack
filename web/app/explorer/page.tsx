"use client";
import { useEffect, useMemo, useState } from 'react';

type Entry = { name: string; type: 'dir' | 'file'; size?: number; mtimeMs: number };

export default function ExplorerPage() {
  const [cwd, setCwd] = useState<string>('.');
  const [root, setRoot] = useState<string>('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [preview, setPreview] = useState<{ path: string; content: string; truncated: boolean } | null>(null);

  async function load(dir: string) {
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const res = await fetch(`/api/fs/list?p=${encodeURIComponent(dir)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { root: string; path: string; entries: Entry[] };
      setRoot(data.root);
      setCwd(data.path || '.');
      setEntries(data.entries);
    } catch (e: any) {
      setError(e?.message ?? 'failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('.');
  }, []);

  const crumbs = useMemo(() => {
    const segs = cwd === '.' ? [] : cwd.split('/').filter(Boolean);
    const list = [{ label: 'root', path: '.' } as const];
    let acc = '';
    for (const s of segs) {
      acc = acc ? `${acc}/${s}` : s;
      list.push({ label: s, path: acc } as const);
    }
    return list;
  }, [cwd]);

  async function openPreview(rel: string) {
    setPreview(null);
    try {
      const p = cwd === '.' ? rel : `${cwd}/${rel}`;
      const res = await fetch(`/api/fs/read?p=${encodeURIComponent(p)}`);
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      const truncated = res.headers.get('X-Truncated') === 'true';
      setPreview({ path: p, content: text, truncated });
    } catch (e: any) {
      setPreview({ path: rel, content: `Error: ${e?.message ?? 'unknown'}`, truncated: false });
    }
  }

  return (
    <main className="min-h-dvh p-6 md:p-10 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="font-pixel pixel-title text-neon text-2xl">Explorer</h2>
        <div className="text-xs text-neon text-opacity-70">{root}</div>
      </header>

      <nav className="flex items-center gap-2 text-sm">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            <button
              className="text-neon hover:underline"
              onClick={() => load(c.path)}
            >
              {c.label}
            </button>
            {i < crumbs.length - 1 && <span className="text-white/40">/</span>}
          </span>
        ))}
      </nav>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="hud-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-neon">{cwd}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load('.')}
                className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs"
              >Root</button>
              <button
                onClick={() => {
                  if (cwd === '.' || !cwd) return;
                  const parent = cwd.split('/').slice(0, -1).join('/') || '.';
                  load(parent);
                }}
                className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs"
              >Up</button>
            </div>
          </div>

          {loading ? (
            <div className="text-white/60 text-sm">Loading...</div>
          ) : error ? (
            <div className="text-red-400 text-sm">{error}</div>
          ) : (
            <ul className="divide-y divide-white/10">
              {entries.map((e) => (
                <li key={e.name} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block w-4 text-neon ${e.type === 'dir' ? '' : 'opacity-70'}`}>{e.type === 'dir' ? '📁' : '📄'}</span>
                    {e.type === 'dir' ? (
                      <button className="text-neon hover:underline" onClick={() => load(cwd === '.' ? e.name : `${cwd}/${e.name}`)}>
                        {e.name}
                      </button>
                    ) : (
                      <button className="text-white/90 hover:underline" onClick={() => openPreview(e.name)}>
                        {e.name}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-white/40">
                    {e.type === 'dir' ? 'dir' : `${e.size ?? 0} B`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hud-card p-4">
          <div className="text-neon mb-2">Preview</div>
          {preview ? (
            <div className="space-y-2">
              <div className="text-xs text-neon text-opacity-70 break-all">{preview.path}</div>
              <pre className="text-xs whitespace-pre-wrap break-words max-h-[60vh] overflow-auto bg-bg/60 p-3 rounded-md border border-neon border-opacity-10">{preview.content}</pre>
              {preview.truncated && <div className="text-xs text-white/50">(truncated)</div>}
            </div>
          ) : (
            <div className="text-white/50 text-sm">Select a file to preview</div>
          )}
        </div>
      </section>
    </main>
  );
}

