"use client";
import { useMemo, useRef, useState, type DragEvent } from 'react';
import type { WebTask } from '@/lib/tasksStorage';
import type { RoadmapStage, Status } from '@/lib/useTasksController';
import { motion } from 'framer-motion';
import { dependencyLayers, groupByStatus } from '@/lib/taskGrouping';

export default function TasksBoard({
  tasks,
  loading,
  generating,
  add,
  del,
  setStatus,
  generatePlan,
  roadmap,
}: {
  tasks: WebTask[];
  loading: boolean;
  generating: boolean;
  add: (title: string) => Promise<void> | void;
  del: (id: number) => Promise<void> | void;
  setStatus: (id: number, status: Status) => Promise<void> | void;
  generatePlan: () => Promise<void> | void;
  roadmap: RoadmapStage[];
}) {
  const [title, setTitle] = useState('');
  const groups = useMemo(() => groupByStatus(tasks), [tasks]);
  const layers = useMemo(() => dependencyLayers(tasks), [tasks]);

  // DnD: ドラッグ中のIDと見た目ハイライト制御
  const draggingIdRef = useRef<number | null>(null);
  const [hoverCol, setHoverCol] = useState<Status | null>(null);
  const roadmapLabels: Record<string, string> = {
    start: 'はじまり',
    front: 'フロント',
    back: 'バックエンド',
    infra: 'インフラ',
    release: 'リリース',
  };

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
      <div className="flex flex-wrap items-center gap-2">
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
          onClick={generatePlan}
          disabled={generating || loading}
          title="要件サマリーからタスクとロードマップを再生成"
        >Generate Plan</button>
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
                  onDragStart={(e) => handleDragStart(e as unknown as DragEvent<HTMLDivElement>, t.id)}
                  onDragOver={(e) => handleDragOver(e as unknown as DragEvent<HTMLDivElement>)}
                  onDragEnd={(e) => handleDragEnd(e as unknown as DragEvent<HTMLDivElement>)}
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

      <div className="mt-4">
        <div className="text-neon text-sm font-semibold mb-2">ロードマップ候補</div>
        {generating ? (
          <div className="text-xs text-neon text-opacity-60">AIがロードマップを生成中...</div>
        ) : roadmap.length === 0 ? (
          <div className="text-xs text-neon text-opacity-60">生成済みのロードマップがありません。</div>
        ) : (
          <div className="space-y-2">
            {roadmap.map((stage) => (
              <div key={`roadmap-${stage.order}-${stage.title}`} className="bg-hud bg-opacity-60 border border-neon border-opacity-10 rounded-md p-3 text-xs text-white/90">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-neon font-semibold">Stage {stage.order}: {stage.title || 'Untitled'}</div>
                  {stage.mapNode && (
                    <span className="text-[10px] uppercase tracking-wide text-neon text-opacity-70">
                      Node: {roadmapLabels[stage.mapNode] ?? stage.mapNode}
                    </span>
                  )}
                </div>
                {stage.summary && (
                  <div className="mt-1 text-white/70 leading-relaxed">{stage.summary}</div>
                )}
                {stage.tasks.length > 0 && (
                  <ul className="mt-2 list-disc list-inside space-y-1 text-[11px] text-neon text-opacity-80">
                    {stage.tasks.map((taskTitle) => (
                      <li key={`${stage.order}-${taskTitle}`}>{taskTitle}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
