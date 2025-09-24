"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import CodeEditor from '@/components/CodeEditor';
import ChatPanel from '@/components/ChatPanel';
import Avatar from '@/components/Avatar';
// NOTE: Deprecated simple terminal panel removed in favor of InteractiveTerminal
import dynamic from 'next/dynamic';
const InteractiveTerminal = dynamic(() => import('@/components/InteractiveTerminal'), { ssr: false });

type Entry = { name: string; type: 'dir' | 'file'; size?: number; mtimeMs: number };
type LocalEntry = { name: string; kind: 'directory' | 'file'; handle: any };

export default function EditorPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [avatarState, setAvatarState] = useState<'idle' | 'talk' | 'celebrate'>('idle');
  const [mode, setMode] = useState<'workspace' | 'local'>('workspace');
  const [source, setSource] = useState<'workspace' | 'local' | null>(null); // 現在の編集中ソース
  // Explorer（ワークスペース側）
  const [cwd, setCwd] = useState<string>('.');
  const [root, setRoot] = useState<string>('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Editor（単一タブの最小実装）
  const [path, setPath] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [original, setOriginal] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');

  const dirty = content !== original;

  useEffect(() => {
    load('.');
  }, []);

  // 日本語メモ: 離脱時に未保存警告を出す（基本対策）。
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty]);

  async function load(dir: string) {
    setLoading(true);
    setError('');
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

  async function openFile(rel: string) {
    try {
      const p = cwd === '.' ? rel : `${cwd}/${rel}`;
      const res = await fetch(`/api/fs/read?p=${encodeURIComponent(p)}`);
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      setPath(p);
      setContent(text);
      setOriginal(text);
      setSaveNote('');
      setSource('workspace');
    } catch (e: any) {
      setPath(rel);
      setContent(`Error: ${e?.message ?? 'unknown'}`);
      setOriginal(`Error: ${e?.message ?? 'unknown'}`);
    }
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaveNote('');
    try {
      if (source === 'workspace') {
        const res = await fetch('/api/fs/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ p: path, content }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else if (source === 'local' && localFileHandle) {
        const writable = await (localFileHandle as any).createWritable();
        await writable.write(content);
        await writable.close();
      }
      setOriginal(content);
      setSaveNote('Saved');
      setTimeout(() => setSaveNote(''), 1500);
    } catch (e: any) {
      setSaveNote(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    setContent(original);
  }

  // ---- Local (File System Access API) ----
  // 日本語メモ: SSRとクライアントの判定差によるHydration警告を避けるため、
  // 初期値はfalseに固定し、マウント後に実際の対応可否を反映する
  const [localSupported, setLocalSupported] = useState(false);
  useEffect(() => {
    try {
      setLocalSupported(typeof window !== 'undefined' && 'showDirectoryPicker' in window);
    } catch {
      setLocalSupported(false);
    }
  }, []);
  const [localRoot, setLocalRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [localStack, setLocalStack] = useState<FileSystemDirectoryHandle[]>([]);
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localFileHandle, setLocalFileHandle] = useState<FileSystemFileHandle | null>(null);
  const canSave = dirty && !saving && ((source === 'workspace' && !!path) || (source === 'local' && !!localFileHandle));

  async function localChoose() {
    setLocalError('');
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
    setLocalError('');
  }

  async function openLocalFileEntry(entry: LocalEntry) {
    if (entry.kind !== 'file') return;
    try {
      const fh = entry.handle as FileSystemFileHandle;
      setLocalFileHandle(fh);
      const file = await fh.getFile();
      const text = await file.text();
      const rel = localStack.length > 1 ? localStack.slice(1).map((h: any) => h.name).concat(entry.name).join('/') : entry.name;
      setPath(`local:/${rel}`);
      setContent(text);
      setOriginal(text);
      setSaveNote('');
      setSource('local');
    } catch (e: any) {
      setLocalError(e?.message ?? 'Failed to open file');
    }
  }

  return (
    <main className="min-h-dvh p-6 md:p-10 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-pixel pixel-title text-neon text-2xl">Editor</h2>
          <Avatar state={avatarState} size={72} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-sm"
          >Dashboard</Link>
          <Link
            href="/explorer"
            className="px-3 py-1.5 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-sm"
          >Explorer</Link>
          <button
            onClick={() => setChatOpen(true)}
            className="px-3 py-1.5 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-sm"
          >Open Chat</button>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左: Explorer（Workspace / Local 切替） */}
        <div className="hud-card p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-neon">Source</div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setMode('workspace')}
                className={`px-2 py-1 border rounded-md ${mode === 'workspace' ? 'border-neon text-neon' : 'border-neon border-opacity-20 text-white/70 hover:bg-neon hover:bg-opacity-10'}`}
              >Workspace</button>
              <button
                onClick={() => setMode('local')}
                className={`px-2 py-1 border rounded-md ${mode === 'local' ? 'border-neon text-neon' : 'border-neon border-opacity-20 text-white/70 hover:bg-neon hover:bg-opacity-10'}`}
                title={localSupported ? '' : 'File System Access API not supported'}
              >Local</button>
            </div>
          </div>

          {mode === 'workspace' ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-neon text-xs">Workspace</div>
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
              <nav className="flex items-center gap-2 flex-wrap text-xs mb-2">
                {crumbs.map((c, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <button className="text-neon hover:underline" onClick={() => load(c.path)}>{c.label}</button>
                    {i < crumbs.length - 1 && <span className="text-white/40">/</span>}
                  </span>
                ))}
              </nav>
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
                          <button className="text-white/90 hover:underline" onClick={() => openFile(e.name)}>
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
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-neon text-xs">Local</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={localChoose}
                    className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs"
                    title={localSupported ? 'Choose local folder' : 'File System Access API not supported'}
                  >Choose</button>
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
                <div className="text-white/50 text-sm">Click "Choose" to select a local folder.</div>
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
                          <button className="text-white/90 hover:underline" onClick={() => openLocalFileEntry(e)}>
                            {e.name}
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-white/40">{e.kind}</div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* 中央: エディタ + 実行ログ */}
        <div className="lg:col-span-9 space-y-3">
          <div className="hud-card p-3 flex items-center justify-between">
            <div className="text-xs text-neon text-opacity-80 break-all">
              {path || 'No file opened'} {dirty && <span className="text-amber-400">(unsaved)</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={!canSave}
                className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-xs disabled:opacity-40"
              >Save</button>
              <button
                onClick={revert}
                disabled={!dirty}
                className="px-2 py-1 border border-neon border-opacity-20 rounded-md text-white/80 hover:bg-neon hover:bg-opacity-10 text-xs disabled:opacity-40"
              >Revert</button>
              <span className="text-xs text-neon text-opacity-70">{saveNote}</span>
            </div>
          </div>
          <CodeEditor
            path={path}
            value={content}
            onChange={setContent}
            height="70vh"
          />
          {/* Interactive terminal only */}
          <InteractiveTerminal />
        </div>
      </section>
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onStreamingChange={(streaming) => setAvatarState(streaming ? 'talk' : 'idle')}
      />
    </main>
  );
}

// NOTE: 追加のPageエクスポートは禁止のため、補助的なコンポーネントはここに置かない
