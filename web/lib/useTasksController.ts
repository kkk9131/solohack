"use client";
// 日本語メモ: タスク状態と操作をまとめたコントローラーフック。
// Dashboard で呼び出し、HUDProgress と Kanban に配布して同期を保つ。
import { useCallback, useMemo, useState } from 'react';
import type { WebTask } from '@/lib/tasksStorage';
import type { PlannerRoadmapStage } from '@/lib/planning';

export type Status = 'todo' | 'in-progress' | 'done';

export type RoadmapStage = PlannerRoadmapStage;

export default function useTasksController() {
  const [tasks, setTasks] = useState<WebTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [roadmap, setRoadmap] = useState<RoadmapStage[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      if (!res.ok) throw new Error(`GET /api/tasks ${res.status}`);
      const data = await res.json().catch(() => ({ tasks: [] }));
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch {
      // 日本語メモ: エラー時は破綻させず空配列で継続
      setTasks((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const add = useCallback(async (title: string) => {
    const t = title.trim();
    if (!t) return;
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t }) });
    await refresh();
    setRoadmap([]);
  }, [refresh]);

  const del = useCallback(async (id: number) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await refresh();
    setRoadmap([]);
  }, [refresh]);

  const setStatus = useCallback(async (id: number, status: Status) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    } finally {
      await refresh();
      setRoadmap([]);
    }
  }, [refresh]);

  const completion = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return 0;
    const done = tasks.filter((t) => t.completed).length;
    return Math.round((done / total) * 100);
  }, [tasks]);

  const generatePlan = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/tasks/generate', { method: 'POST' });
      if (!res.ok) throw new Error(`POST /api/tasks/generate ${res.status}`);
      const data = await res.json().catch(() => ({ tasks: [], roadmap: [] }));
      const generatedTasks = Array.isArray(data.tasks) ? data.tasks : [];
      const generatedRoadmap = normalizeRoadmap(data.roadmap);
      setTasks(generatedTasks);
      setRoadmap(generatedRoadmap);
    } catch {
      // 日本語メモ: 失敗時は最新タスクを取り直してUIを戻す。
      await refresh();
    } finally {
      setGenerating(false);
    }
  }, [refresh]);

  return {
    tasks,
    loading,
    generating,
    roadmap,
    refresh,
    add,
    del,
    setStatus,
    generatePlan,
    completion,
  } as const;
}

function normalizeRoadmap(value: unknown): RoadmapStage[] {
  if (!Array.isArray(value)) return [];
  const allowedNodes = new Set(['start', 'front', 'back', 'infra', 'release']);
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return undefined;
      const record = entry as Record<string, unknown>;
      const orderRaw = record.order ?? record.stage ?? record.sequence;
      const order = typeof orderRaw === 'number' && Number.isFinite(orderRaw)
        ? Math.max(1, Math.floor(orderRaw))
        : undefined;
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      const summary = typeof record.summary === 'string' ? record.summary.trim() : '';
      const tasks = Array.isArray(record.tasks)
        ? record.tasks
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0)
        : [];
      const mapNodeRaw = typeof record.mapNode === 'string' ? record.mapNode.trim().toLowerCase() : undefined;
      const mapNode = mapNodeRaw && allowedNodes.has(mapNodeRaw)
        ? (mapNodeRaw as RoadmapStage['mapNode'])
        : undefined;
      if (!order) return undefined;
      if (!title && !summary && tasks.length === 0) return undefined;
      const stage: RoadmapStage = {
        order,
        title,
        summary,
        tasks,
        mapNode,
      };
      return stage;
    })
    .filter((stage): stage is RoadmapStage => Boolean(stage))
    .sort((a, b) => a.order - b.order);
}
