"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import EditorPane from '@/components/EditorPane';
import Timer from '@/components/Timer';
import TasksBoard from '@/components/TasksBoard';
import HUDProgress from '@/components/HUDProgress';
import ChatPanel from '@/components/ChatPanel';
import RunPanel from '@/components/RunPanel';
import QuickOpen from '@/components/QuickOpen';
import useTasksController from '@/lib/useTasksController';

export default function StudioPage() {
  // 左ペイン（タスク/タイマー）
  const tasksCtl = useTasksController();
  useEffect(() => { tasksCtl.refresh(); }, [tasksCtl.refresh]);
  const completion = tasksCtl.completion;

  // 右ペイン（チャット）
  const [chatOpen, setChatOpen] = useState(false);
  const [qopen, setQopen] = useState(false);
  const [focusMode, setFocusMode] = useState(false); // 左右/下のペインを隠してエディタ集中

  // 中央（Monaco）
  const [path, setPath] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState('');
  const truncated = useMemo(() => false, []);

  const canSave = !!path && !truncated;

  const openFromWorkspace = useCallback(async () => {
    if (!path.trim()) return;
    setLoading(true);
    setNote('');
    try {
      const res = await fetch(`/api/fs/read?p=${encodeURIComponent(path.trim())}`);
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      setContent(text);
      setLoaded(text);
      setDirty(false);
    } catch (e: any) {
      setContent(`// Failed to open: ${e?.message ?? 'unknown'}`);
    } finally {
      setLoading(false);
    }
  }, [path]);

  const saveToWorkspace = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setNote('');
    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p: path.trim(), content }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNote('Saved');
      setLoaded(content);
      setDirty(false);
      setTimeout(() => setNote(''), 1500);
    } catch (e: any) {
      setNote(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [canSave, content, path]);

  // 初期メッセージ
  useEffect(() => {
    if (!content) setContent('// Select a file from workspace and start editing.');
  }, [content]);

  // 変更フラグと離脱ガード
  useEffect(() => { setDirty(loaded !== '' && content !== loaded); }, [content, loaded]);
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ショートカット: Cmd/Ctrl+S 保存, Cmd/Ctrl+P クイックオープン
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveToWorkspace(); }
      if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); setQopen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveToWorkspace]);

  return (
    <main className="min-h-dvh p-3 md:p-4">
      <div className={`studio-grid ${focusMode ? 'focus' : ''}`}>
        {/* 左: タスク/タイマー */}
        <section className="hidden lg:block hud-card p-3 space-y-3 min-h-0 overflow-auto" style={{ gridArea: 'left' }}>
          <div className="text-neon font-semibold">Quests</div>
          <HUDProgress value={completion} />
          <div className="border-t border-neon/20 pt-3">
            <div className="text-neon mb-1">Timer</div>
            <Timer minutes={25} onFinish={() => { /* NOTE: 祝福演出はDashboardに任せる */ }} />
          </div>
          <div className="border-t border-neon/20 pt-3">
            <TasksBoard
              tasks={tasksCtl.tasks}
              loading={tasksCtl.loading}
              analyzing={tasksCtl.analyzing}
              add={tasksCtl.add}
              del={tasksCtl.del}
              setStatus={tasksCtl.setStatus}
              analyzeDeps={tasksCtl.analyzeDeps}
            />
          </div>
        </section>

        {/* ツールバー（中央上） */}
        <header className="hud-card p-2 flex items-center gap-2 sticky top-0 z-10" style={{ gridArea: 'toolbar' }}>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="workspace 相対パス（例: web/app/page.tsx）"
            className="flex-1 bg-bg text-white/90 placeholder:text-white/40 border border-neon/20 rounded-md px-3 py-1.5 focus:outline-none focus:border-neon/40"
          />
          <button
            onClick={() => setQopen(true)}
            className="px-3 py-1.5 border border-neon/40 rounded-md text-neon hover:bg-neon/10"
            title="Quick Open (⌘/Ctrl+P)"
          >Quick Open</button>
          <div className="relative">
            <details className="group">
              <summary className="px-3 py-1.5 border border-neon/40 rounded-md text-neon hover:bg-neon/10 cursor-pointer list-none">Examples</summary>
              <div className="absolute right-0 mt-1 w-64 bg-hud bg-opacity-95 border border-neon/20 rounded-md shadow-glow p-2 z-20">
                {['web/app/page.tsx','web/app/dashboard/page.tsx','web/app/explorer/page.tsx','web/components/ChatPanel.tsx'].map((ex)=> (
                  <button
                    key={ex}
                    onClick={() => { setPath(ex); }}
                    className="block w-full text-left px-2 py-1 text-sm text-white/90 hover:bg-neon/10 rounded"
                  >{ex}</button>
                ))}
              </div>
            </details>
          </div>
          <button
            onClick={openFromWorkspace}
            disabled={!path.trim() || loading}
            className="px-3 py-1.5 border border-neon/40 rounded-md text-neon hover:bg-neon/10 disabled:opacity-50"
          >Open</button>
          <button
            onClick={saveToWorkspace}
            disabled={!canSave || saving}
            className="px-3 py-1.5 border border-neon/40 rounded-md text-neon hover:bg-neon/10 disabled:opacity-50"
            title={canSave ? 'Save to workspace' : 'Truncated or no file'}
          >{dirty ? 'Save*' : 'Save'}</button>
          <span className="text-xs text-neon text-opacity-70">{note}</span>
          <div className="flex-1" />
          <button
            onClick={() => setFocusMode((v) => !v)}
            className="px-3 py-1.5 border border-neon/40 rounded-md text-neon hover:bg-neon/10"
            title="Focus mode (toggle side/bottom)"
          >{focusMode ? 'Exit Focus' : 'Focus'}</button>
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="px-3 py-1.5 border border-neon/40 rounded-md text-neon hover:bg-neon/10"
          >{chatOpen ? 'Hide Chat' : 'Show Chat'}</button>
        </header>

        {/* 中央: Monaco */}
        <section className="hud-card p-0 min-h-0 overflow-hidden min-h-[50vh]" style={{ gridArea: 'editor' }}>
          <div className="h-full" style={{ height: '100%' }}>
            <EditorPane path={path} value={content} onChange={setContent} />
          </div>
        </section>

        {/* 右: チャット（オーバーレイの既存パネルを利用） */}
        <aside className="hidden lg:block hud-card p-3 min-h-0 overflow-auto" style={{ gridArea: 'right' }}>
          <div className="text-neon mb-2">AI Coach</div>
          <div className="text-xs text-white/60 mb-3">コード選択→質問/改善は右のチャットを開いて実行</div>
          <div className="text-white/50 text-xs">Chat is {chatOpen ? 'visible' : 'hidden'}.</div>
          <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        </aside>

        {/* 下: 実行ログ */}
        <section className="hud-card p-3 min-h-0 overflow-auto" style={{ gridArea: 'bottom' }}>
          <div className="text-neon mb-2">Run Panel</div>
          <div className="h-[180px]"><RunPanel /></div>
        </section>
      </div>
      <QuickOpen open={qopen} onClose={() => setQopen(false)} onPick={(rel) => { setPath(rel); setTimeout(() => openFromWorkspace(), 0); }} />
      {/* レイアウトCSS（レスポンシブでグリッド切替） */}
      <style jsx>{`
        .studio-grid {
          display: grid;
          gap: 0.75rem; /* 12px */
          grid-template-columns: 1fr;
          grid-template-rows: auto 1fr auto;
          grid-template-areas:
            'toolbar'
            'editor'
            'bottom';
          min-height: 80dvh;
        }
        .studio-grid.focus {
          grid-template-rows: auto 1fr;
          grid-template-areas:
            'toolbar'
            'editor';
        }
        @media (min-width: 1024px) {
          .studio-grid {
            grid-template-columns: 280px 1fr 360px;
            grid-template-rows: auto 1fr 220px;
            grid-template-areas:
              'left toolbar right'
              'left editor  right'
              'bottom bottom bottom';
            min-height: calc(100dvh - 2rem);
          }
          .studio-grid.focus {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
            grid-template-areas:
              'toolbar'
              'editor';
          }
        }
        @media (min-width: 1280px) {
          .studio-grid {
            grid-template-columns: 300px 1fr 400px;
          }
        }
      `}</style>
    </main>
  );
}
