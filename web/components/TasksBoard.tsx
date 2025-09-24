"use client";
import { useMemo, useRef, useState, type DragEvent } from 'react';
import type { WebTask } from '@/lib/tasksStorage';
import type { Status } from '@/lib/useTasksController';
import { motion } from 'framer-motion';

function statusOf(t: WebTask): Status {
  if (t.completed) return 'done';
  return t.inProgress ? 'in-progress' : 'todo';
}

function groupByStatus(tasks: WebTask[]) {
  const groups: Record<Status, WebTask[]> = { 'todo': [], 'in-progress': [], 'done': [] };
  for (const t of tasks) groups[statusOf(t)].push(t);
  return groups;
}

function topoGroups(tasks: WebTask[]): WebTask[][] {
  // 日本語メモ: 依存関係の層（ステージ）に分割。循環は最後の層に押し出し。
  const byId = new Map<number, WebTask>(tasks.map((t) => [t.id, t]));
  const incoming = new Map<number, Set<number>>();
  const outgoing = new Map<number, Set<number>>();
  for (const t of tasks) {
    const deps = (t.deps ?? []).filter((d) => byId.has(d) && d !== t.id);
    incoming.set(t.id, new Set(deps));
    for (const d of deps) {
      if (!outgoing.has(d)) outgoing.set(d, new Set());
      outgoing.get(d)!.add(t.id);
    }
  }
  const layers: WebTask[][] = [];
  const remaining = new Set(tasks.map((t) => t.id));
  while (remaining.size > 0) {
    const layer: number[] = [];
    for (const id of Array.from(remaining)) {
      if ((incoming.get(id)?.size ?? 0) === 0) layer.push(id);
    }
    if (layer.length === 0) {
      // 循環 or 残り: まとめて最後の層
      const rest = Array.from(remaining);
      layers.push(rest.map((id) => byId.get(id)!).filter(Boolean));
      break;
    }
    layers.push(layer.map((id) => byId.get(id)!).filter(Boolean));
    for (const id of layer) {
      remaining.delete(id);
      for (const to of Array.from(outgoing.get(id) ?? [])) {
        const inc = incoming.get(to);
        if (inc) inc.delete(id);
      }
    }
  }
  return layers;
}

export default function TasksBoard({
  tasks,
  loading,
  analyzing,
  add,
  del,
  setStatus,
  analyzeDeps,
}: {
  tasks: WebTask[];
  loading: boolean;
  analyzing: boolean;
  add: (title: string) => Promise<void> | void;
  del: (id: number) => Promise<void> | void;
  setStatus: (id: number, status: Status) => Promise<void> | void;
  analyzeDeps: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const groups = useMemo(() => groupByStatus(tasks), [tasks]);
  const layers = useMemo(() => topoGroups(tasks), [tasks]);

  // DnD: ドラッグ中のIDと見た目ハイライト制御
  const draggingIdRef = useRef<number | null>(null);
  const [hoverCol, setHoverCol] = useState<Status | null>(null);

  const handleDragStart = (event: DragEvent<HTMLDivElement>, id: number) => {
    draggingIdRef.current = id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(id));
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingIdRef.current = null;
    setHoverCol(null);
  };

  function onDropTo(status: Status) {
    const id = draggingIdRef.current;
    draggingIdRef.current = null;
    setHoverCol(null);
    if (id == null) return;
    setStatus(id, status);
  }

  return (
    <div className="space-y-4">
      {/* 追加フォーム */}
      <div className="flex items-center gap-2">
        <input
          className="flex-1 bg-bg text-white/90 placeholder:text-white/40 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40"
          placeholder="Add a task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={async (e) => { if (e.key === 'Enter') { const t = title; setTitle(''); await add(t); } }}
        />
        <button className="px-3 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10" onClick={async () => { const t = title; setTitle(''); await add(t); }}>Add</button>
        <button
          className="px-3 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 disabled:opacity-50"
          onClick={analyzeDeps}
          disabled={analyzing || loading || tasks.length === 0}
          title="AIで依存関係を推定して保存"
        >Analyze Dependencies</button>
      </div>

      {/* カンバン */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['todo','in-progress','done'] as Status[]).map((s) => (
          <div
            key={s}
            className={`bg-hud bg-opacity-60 border rounded-md p-3 transition-colors ${hoverCol===s ? 'border-neon border-opacity-40' : 'border-neon border-opacity-10'}`}
            onDragOver={(e: DragEvent<HTMLDivElement>) => { handleDragOver(e); setHoverCol(s); }}
            onDragLeave={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setHoverCol((cur) => (cur === s ? null : cur)); }}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              const text = e.dataTransfer.getData('text/plain');
              const id = Number(text);
              if (Number.isFinite(id)) draggingIdRef.current = id;
              onDropTo(s);
            }}
          >
            <div className="text-neon text-sm font-semibold mb-2">
              {s === 'todo' ? '未着手' : s === 'in-progress' ? '実行中' : '完了'} ({groups[s].length})
            </div>
            <div className="space-y-2">
              {(loading ? [] : groups[s]).map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-bg border border-neon border-opacity-10 rounded p-2 text-sm flex items-center justify-between gap-2"
                  draggable
                  onDragStart={(e) => handleDragStart(e, t.id)}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <div className="min-w-0">
                    <div className="truncate text-white/90">{t.title}</div>
                    {Array.isArray(t.deps) && t.deps.length > 0 && (
                      <div className="text-[11px] text-neon text-opacity-70">deps: {t.deps.join(', ')}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {s !== 'todo' && (
                      <button className="px-2 py-1 text-xs border border-neon border-opacity-30 rounded hover:bg-neon/10" onClick={() => setStatus(t.id, 'todo')}>ToDo</button>
                    )}
                    {s !== 'in-progress' && (
                      <button className="px-2 py-1 text-xs border border-neon border-opacity-30 rounded hover:bg-neon/10" onClick={() => setStatus(t.id, 'in-progress')}>Start</button>
                    )}
                    {s !== 'done' && (
                      <button className="px-2 py-1 text-xs border border-green-400/40 text-green-300 rounded hover:bg-green-400/10" onClick={() => setStatus(t.id, 'done')}>Done</button>
                    )}
                    <button className="px-2 py-1 text-xs border border-red-400/40 text-red-300 rounded hover:bg-red-400/10" onClick={() => del(t.id)}>Delete</button>
                  </div>
                </motion.div>
              ))}
              {!loading && groups[s].length === 0 && (
                <div className="text-xs text-neon text-opacity-60">No tasks</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 依存グループ可視化 */}
      <div className="mt-2">
        <div className="text-neon text-sm font-semibold mb-2">依存関係の段階表示</div>
        {layers.length === 0 ? (
          <div className="text-xs text-neon text-opacity-60">No tasks</div>
        ) : (
          <div className="flex items-start gap-3 overflow-x-auto">
            {layers.map((layer, i) => (
              <div key={i} className="min-w-[220px] bg-hud bg-opacity-60 border border-neon border-opacity-10 rounded-md p-2">
                <div className="text-neon text-xs mb-1">Stage {i + 1}</div>
                <div className="space-y-1">
                  {layer.map((t) => (
                    <div key={t.id} className="bg-bg border border-neon/10 rounded px-2 py-1 text-xs text-white/90 truncate">{t.title}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
