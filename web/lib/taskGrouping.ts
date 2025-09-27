import type { WebTask } from '@/lib/tasksStorage';
import type { Status } from '@/lib/useTasksController';

// 日本語メモ: タスクの状態推論と依存関係レイヤー分割を共通化するヘルパー。
export function inferStatus(task: WebTask): Status {
  if (task.completed) return 'done';
  return task.inProgress ? 'in-progress' : 'todo';
}

export function groupByStatus(tasks: WebTask[]): Record<Status, WebTask[]> {
  const groups: Record<Status, WebTask[]> = { 'todo': [], 'in-progress': [], 'done': [] };
  for (const task of tasks) {
    const status = inferStatus(task);
    groups[status].push(task);
  }
  return groups;
}

export function dependencyLayers(tasks: WebTask[]): WebTask[][] {
  // 日本語メモ: Kahnのアルゴリズム風に依存グラフを層に分割。循環は最終層にまとめる。
  if (tasks.length === 0) return [];
  const byId = new Map<number, WebTask>(tasks.map((task) => [task.id, task]));
  const incoming = new Map<number, Set<number>>();
  const outgoing = new Map<number, Set<number>>();

  for (const task of tasks) {
    const deps = (task.deps ?? []).filter((dep) => byId.has(dep) && dep !== task.id);
    incoming.set(task.id, new Set(deps));
    for (const dep of deps) {
      if (!outgoing.has(dep)) outgoing.set(dep, new Set());
      outgoing.get(dep)!.add(task.id);
    }
  }

  const remaining = new Set<number>(tasks.map((task) => task.id));
  const layers: WebTask[][] = [];

  while (remaining.size > 0) {
    const layerIds: number[] = [];
    for (const id of Array.from(remaining)) {
      if ((incoming.get(id)?.size ?? 0) === 0) layerIds.push(id);
    }

    if (layerIds.length === 0) {
      // NOTE: 循環や孤立ノードは最後の層でまとめて可視化。
      const rest = Array.from(remaining);
      layers.push(rest.map((id) => byId.get(id)!).filter(Boolean));
      break;
    }

    layers.push(layerIds.map((id) => byId.get(id)!).filter(Boolean));
    for (const id of layerIds) {
      remaining.delete(id);
      for (const to of Array.from(outgoing.get(id) ?? [])) {
        incoming.get(to)?.delete(id);
      }
    }
  }

  return layers;
}
