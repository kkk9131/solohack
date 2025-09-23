"use client";
// 日本語メモ: タスク状態と操作をまとめたコントローラーフック。
// Dashboard で呼び出し、HUDProgress と Kanban に配布して同期を保つ。
import { useCallback, useMemo, useState } from 'react';
import type { WebTask } from '@/lib/tasksStorage';

export type Status = 'todo' | 'in-progress' | 'done';

export default function useTasksController() {
  const [tasks, setTasks] = useState<WebTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

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
  }, [refresh]);

  const del = useCallback(async (id: number) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  const setStatus = useCallback(async (id: number, status: Status) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    } finally {
      await refresh();
    }
  }, [refresh]);

  const analyzeDeps = useCallback(async () => {
    setAnalyzing(true);
    try {
      await fetch('/api/tasks/deps', { method: 'POST' });
      await refresh();
    } finally {
      setAnalyzing(false);
    }
  }, [refresh]);

  const completion = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return 0;
    const done = tasks.filter((t) => t.completed).length;
    return Math.round((done / total) * 100);
  }, [tasks]);

  return { tasks, loading, analyzing, refresh, add, del, setStatus, analyzeDeps, completion } as const;
}
