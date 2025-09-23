"use client";
import { useEffect, useMemo, useState } from 'react';

type Entry = { name: string; type: 'dir' | 'file'; size?: number; mtimeMs: number };

// Local (File System Access API)
type LocalEntry = {
  name: string;
  kind: 'directory' | 'file';
  handle: FileSystemDirectoryHandle | FileSystemFileHandle;
};

export default function ExplorerPage() {
  // Server-backed workspace explorer
  const [cwd, setCwd] = useState<string>('.');
  const [root, setRoot] = useState<string>('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [preview, setPreview] = useState<{ path: string; content: string; truncated: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');

  // Local (browser-only) explorer
  const [localRoot, setLocalRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [localStack, setLocalStack] = useState<FileSystemDirectoryHandle[]>([]);
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localPreview, setLocalPreview] = useState<{ path: string; content: string; truncated: boolean } | null>(null);
  const [localEditing, setLocalEditing] = useState(false);
  const [localEditContent, setLocalEditContent] = useState('');
  const [localSaveNote, setLocalSaveNote] = useState('');
  const [localFileHandle, setLocalFileHandle] = useState<FileSystemFileHandle | null>(null);

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

  async function saveEdit() {
    if (!preview) return;
    setSaving(true);
    setSaveNote('');
    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p: preview.path, content: editContent }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveNote('Saved');
      setPreview({ ...preview, content: editContent });
      setEditing(false);
      setTimeout(() => setSaveNote(''), 1500);
    } catch (e: any) {
      setSaveNote(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load('.');
  }, []);

  const crumbs = useMemo(() => {
    const segs = cwd === '.' ? [] : cwd.split('/').filter(Boolean);
    const list: { label: string; path: string }[] = [{ label: 'root', path: '.' }];
    let acc = '';
    for (const s of segs) {
      acc = acc ? `${acc}/${s}` : s;
      list.push({ label: s, path: acc });
    }
    return list;
  }, [cwd]);

  async function openPreview(rel: string) {
    setPreview(null);
    setEditing(false);
    setSaveNote('');
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

  // Local FS helpers
  const localSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  async function localChoose() {
    setLocalError('');
    setLocalPreview(null);
    try {
      if (!localSupported) {
        setLocalError('File System Access API is not supported by this browser.');
        return;
      }
      // @ts-expect-error: showDirectoryPicker exists in supporting browsers
      const dir: FileSystemDirectoryHandle = await window.showDirectoryPicker();
      setLocalRoot(dir);
      setLocalStack([dir]);
      await loadLocal(dir);
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // user canceled
      setLocalError(e?.message ?? 'Failed to open folder');
    }
  }

  async function loadLocal(dir: FileSystemDirectoryHandle) {
    setLocalLoading(true);
    setLocalError('');
    setLocalPreview(null);
    try {
      const items: LocalEntry[] = [];
      // @ts-expect-error entries() async iterator is available
      for await (const [name, handle] of dir.entries()) {
        if (name.startsWith('.')) continue;
        if (name === 'node_modules' || name === '.git') continue;
        const kind = (handle as any).kind as 'directory' | 'file';
        items.push({ name, kind, handle: handle as any });
      }
      items.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1));
      setLocalEntries(items);
    } catch (e: any) {
      setLocalError(e?.message ?? 'Failed to read folder');
    } finally {
      setLocalLoading(false);
    }
  }

  async function openLocal(entry: LocalEntry) {
    if (entry.kind !== 'directory') return;
    const dir = entry.handle as FileSystemDirectoryHandle;
    const next = [...localStack, dir];
    setLocalStack(next);
    await loadLocal(dir);
  }

  async function upLocal() {
    if (localStack.length <= 1) return;
    const next = localStack.slice(0, -1);
    setLocalStack(next);
    await loadLocal(next[next.length - 1]);
  }

  function resetLocal() {
    setLocalRoot(null);
    setLocalStack([]);
    setLocalEntries([]);
    setLocalPreview(null);
    setLocalError('');
  }

  async function openLocalPreviewEntry(entry: LocalEntry) {
    if (entry.kind !== 'file') return;
    try {
      const fh = entry.handle as FileSystemFileHandle;
      setLocalFileHandle(fh);
      const file = await fh.getFile();
      const text = await file.text();
      const MAX = 100 * 1024;
      const content = text.length > MAX ? text.slice(0, MAX) : text;
      const truncated = text.length > MAX;
      const rel = localStack.length > 1 ? localStack.slice(1).map((h: any) => h.name).concat(entry.name).join('/') : entry.name;
      setLocalPreview({ path: `local:/${rel}`, content, truncated });
      setLocalEditing(false);
    } catch (e: any) {
      setLocalPreview({ path: entry.name, content: `Error: ${e?.message ?? 'unknown'}`, truncated: false });
    }
  }

  async function saveLocalEdit() {
    try {
      setLocalSaveNote('');
      if (!localPreview || !localFileHandle) return;
      const writable = await (localFileHandle as any).createWritable();
      await writable.write(localEditContent);
      await writable.close();
      setLocalPreview({ ...localPreview, content: localEditContent });
      setLocalEditing(false);
      setLocalSaveNote('Saved');
      setTimeout(() => setLocalSaveNote(''), 1500);
    } catch (e: any) {
      setLocalSaveNote(e?.message ?? 'Failed to save');
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
            <div className="text-neon">Workspace: {cwd}</div>
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
              {!editing ? (
                <>
                  <pre className="text-xs whitespace-pre-wrap break-words max-h-[60vh] overflow-auto bg-bg/60 p-3 rounded-md border border-neon border-opacity-10">{preview.content}</pre>
                  {preview.truncated && <div className="text-xs text-white/50">(truncated — editing disabled)</div>}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => { setEditing(true); setEditContent(preview.content); }}
                      className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs disabled:opacity-40"
                      disabled={preview.truncated}
                    >Edit</button>
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-xs min-h-[40vh] max-h-[60vh] bg-bg/60 p-3 rounded-md border border-neon border-opacity-10"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={saveEdit} disabled={saving} className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs disabled:opacity-40">Save</button>
                    <button onClick={() => setEditing(false)} className="px-2 py-1 border border-neon border-opacity-20 rounded-md text-white/80 hover:bg-neon hover:bg-opacity-10 text-xs">Cancel</button>
                    <span className="text-xs text-neon text-opacity-70">{saveNote}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-white/50 text-sm">Select a file to preview</div>
          )}
        </div>
      </section>

      {/* Local (browser-only) explorer */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="hud-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-neon">Local Folder: {localRoot ? (localStack.length > 1 ? localStack.slice(1).length : 0) ? `/${localStack.slice(1).map((h: any) => h.name).join('/')}` : '/' : '(not selected)'}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={localChoose}
                className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs"
                disabled={!localSupported}
                title={localSupported ? 'Choose local folder' : 'File System Access API not supported'}
              >Choose Folder</button>
              <button
                onClick={upLocal}
                className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs disabled:opacity-40"
                disabled={!localRoot || localStack.length <= 1}
              >Up</button>
              <button
                onClick={resetLocal}
                className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs disabled:opacity-40"
                disabled={!localRoot}
              >Reset</button>
            </div>
          </div>

          {localLoading ? (
            <div className="text-white/60 text-sm">Loading...</div>
          ) : localError ? (
            <div className="text-red-400 text-sm">{localError}</div>
          ) : !localRoot ? (
            <div className="text-white/50 text-sm">Click "Choose Folder" to explore a local directory (browser-only).</div>
          ) : (
            <ul className="divide-y divide-white/10">
              {localEntries.map((e) => (
                <li key={e.name} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block w-4 text-neon ${e.kind === 'directory' ? '' : 'opacity-70'}`}>{e.kind === 'directory' ? '📁' : '📄'}</span>
                    {e.kind === 'directory' ? (
                      <button className="text-neon hover:underline" onClick={() => openLocal(e)}>
                        {e.name}
                      </button>
                    ) : (
                      <button className="text-white/90 hover:underline" onClick={() => openLocalPreviewEntry(e)}>
                        {e.name}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-white/40">
                    {e.kind}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hud-card p-4">
          <div className="text-neon mb-2">Local Preview</div>
          {localPreview ? (
            <div className="space-y-2">
              <div className="text-xs text-neon text-opacity-70 break-all">{localPreview.path}</div>
              {!localEditing ? (
                <>
                  <pre className="text-xs whitespace-pre-wrap break-words max-h-[60vh] overflow-auto bg-bg/60 p-3 rounded-md border border-neon border-opacity-10">{localPreview.content}</pre>
                  {localPreview.truncated && <div className="text-xs text-white/50">(truncated — editing will overwrite file)</div>}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => { setLocalEditing(true); setLocalEditContent(localPreview.content); }}
                      className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs disabled:opacity-40"
                      disabled={!localFileHandle}
                    >Edit</button>
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    value={localEditContent}
                    onChange={(e) => setLocalEditContent(e.target.value)}
                    className="w-full text-xs min-h-[40vh] max-h-[60vh] bg-bg/60 p-3 rounded-md border border-neon border-opacity-10"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={saveLocalEdit} className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs">Save</button>
                    <button onClick={() => setLocalEditing(false)} className="px-2 py-1 border border-neon border-opacity-20 rounded-md text-white/80 hover:bg-neon hover:bg-opacity-10 text-xs">Cancel</button>
                    <span className="text-xs text-neon text-opacity-70">{localSaveNote}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-white/50 text-sm">Select a file to preview</div>
          )}
        </div>
      </section>
    </main>
  );
}
