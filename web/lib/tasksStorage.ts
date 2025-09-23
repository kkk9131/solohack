// 日本語メモ: Web版（Next.js）用の軽量ストレージヘルパー。
// - 既存CLIの JSON ストレージ `storage/solohack.json` をそのまま利用
// - 環境変数 `SOLOHACK_STORAGE_DIR` があれば優先、無ければ `../storage`
// - 追加フィールド（inProgress, deps など）はそのまま保存し、CLI 側は無視できる

import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type WebTask = {
  id: number;
  title: string;
  completed: boolean;
  // 追加拡張（CLI非依存）：進行中フラグと依存関係
  inProgress?: boolean;
  deps?: number[]; // 依存するタスクID配列
};

export type RepoData = {
  tasks: WebTask[];
  timer?: { startedAt: number; durationSeconds: number };
};

function getStoragePaths() {
  const dir = process.env.SOLOHACK_STORAGE_DIR
    ? path.resolve(process.env.SOLOHACK_STORAGE_DIR)
    : path.resolve(process.cwd(), '..', 'storage');
  const file = path.join(dir, 'solohack.json');
  return { dir, file };
}

export async function loadData(): Promise<RepoData> {
  const { file } = getStoragePaths();
  try {
    if (!existsSync(file)) return { tasks: [] };
    const raw = await fs.readFile(file, 'utf8');
    if (!raw.trim()) return { tasks: [] };
    const data = JSON.parse(raw) as RepoData;
    // NOTE: 想定外プロパティはそのまま維持（前方互換）
    return { tasks: Array.isArray(data.tasks) ? data.tasks : [], timer: data.timer };
  } catch {
    return { tasks: [] };
  }
}

export async function saveData(data: RepoData): Promise<void> {
  const { dir, file } = getStoragePaths();
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
  const payload = JSON.stringify({ tasks: data.tasks ?? [], timer: data.timer }, null, 2);
  await fs.writeFile(file, payload, 'utf8');
}

export async function listTasks(): Promise<WebTask[]> {
  const d = await loadData();
  return d.tasks ?? [];
}

export async function addTask(title: string): Promise<WebTask> {
  const d = await loadData();
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Task title cannot be empty.');
  const nextId = (d.tasks ?? []).reduce((m, t) => Math.max(m, t.id), 0) + 1;
  const task: WebTask = { id: nextId, title: trimmed, completed: false, inProgress: false };
  d.tasks = [...(d.tasks ?? []), task];
  await saveData(d);
  return task;
}

export async function updateTask(id: number, patch: Partial<WebTask>): Promise<WebTask> {
  const d = await loadData();
  const idx = (d.tasks ?? []).findIndex((t) => t.id === id);
  if (idx < 0) throw new Error(`Task with id ${id} not found.`);
  const prev = d.tasks[idx];
  const next: WebTask = { ...prev, ...patch };
  d.tasks[idx] = next;
  await saveData(d);
  return next;
}

export async function removeTask(id: number): Promise<void> {
  const d = await loadData();
  const before = (d.tasks ?? []).length;
  d.tasks = (d.tasks ?? []).filter((t) => t.id !== id);
  if ((d.tasks ?? []).length === before) throw new Error(`Task with id ${id} not found.`);
  await saveData(d);
}

export async function upsertDependencies(depsMap: Record<number, number[]>) {
  // 日本語メモ: 依存関係の一括適用。存在しないIDは無視。
  const d = await loadData();
  const byId = new Map<number, WebTask>((d.tasks ?? []).map((t) => [t.id, t]));
  for (const [idStr, deps] of Object.entries(depsMap)) {
    const id = Number(idStr);
    const t = byId.get(id);
    if (!t) continue;
    t.deps = Array.isArray(deps) ? deps.filter((v) => byId.has(v) && v !== id) : [];
  }
  d.tasks = Array.from(byId.values());
  await saveData(d);
  return d.tasks;
}

