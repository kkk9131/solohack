"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import EditorPane from '@/components/EditorPane';
import Timer from '@/components/Timer';
import TasksBoard from '@/components/TasksBoard';
import HUDProgress from '@/components/HUDProgress';
import ChatPanel from '@/components/ChatPanel';
import RunPanel from '@/components/RunPanel';
import useTasksController from '@/lib/useTasksController';

export default function StudioPage() {
  // 左ペイン（タスク/タイマー）
  const tasksCtl = useTasksController();
  useEffect(() => { tasksCtl.refresh(); }, [tasksCtl.refresh]);
  const completion = tasksCtl.completion;

  // 右ペイン（チャット）
  const [chatOpen, setChatOpen] = useState(false);

  // 中央（Monaco）
  const [path, setPath] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
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

  return (
    <main className="min-h-dvh p-3 md:p-4">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: '280px 1fr 380px',
          gridTemplateRows: 'auto 1fr 240px',
          gridTemplateAreas: `
            'left toolbar right'
            'left editor  right'
            'bottom bottom bottom'
          `,
        }}
      >
        {/* 左: タスク/タイマー */}
        <section className="hud-card p-3 space-y-3 min-h-0" style={{ gridArea: 'left' }}>
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
        <header className="hud-card p-2 flex items-center gap-2" style={{ gridArea: 'toolbar' }}>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="workspace 相対パス（例: web/app/page.tsx）"
            className="flex-1 bg-bg text-white/90 placeholder:text-white/40 border border-neon/20 rounded-md px-3 py-1.5 focus:outline-none focus:border-neon/40"
          />
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
          >Save</button>
          <span className="text-xs text-neon text-opacity-70">{note}</span>
          <div className="flex-1" />
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="px-3 py-1.5 border border-neon/40 rounded-md text-neon hover:bg-neon/10"
          >{chatOpen ? 'Hide Chat' : 'Show Chat'}</button>
        </header>

        {/* 中央: Monaco */}
        <section className="hud-card p-0 min-h-0 overflow-hidden" style={{ gridArea: 'editor' }}>
          <div className="h-full" style={{ height: '100%' }}>
            <EditorPane path={path} value={content} onChange={setContent} />
          </div>
        </section>

        {/* 右: チャット（オーバーレイの既存パネルを利用） */}
        <aside className="hud-card p-3 min-h-0" style={{ gridArea: 'right' }}>
          <div className="text-neon mb-2">AI Coach</div>
          <div className="text-xs text-white/60 mb-3">コード選択→質問/改善は右のチャットを開いて実行</div>
          <div className="text-white/50 text-xs">Chat is {chatOpen ? 'visible' : 'hidden'}.</div>
          <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        </aside>

        {/* 下: 実行ログ */}
        <section className="hud-card p-3 min-h-0" style={{ gridArea: 'bottom' }}>
          <div className="text-neon mb-2">Run Panel</div>
          <div className="h-[180px]"><RunPanel /></div>
        </section>
      </div>
    </main>
  );
}
