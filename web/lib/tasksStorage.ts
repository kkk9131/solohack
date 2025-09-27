// 日本語メモ: Web版（Next.js）用の軽量ストレージヘルパー。
// - 既存CLIの JSON ストレージ `storage/solohack.json` をそのまま利用
// - 環境変数 `SOLOHACK_STORAGE_DIR` があれば優先、無ければ `../storage`
// - 追加フィールド（inProgress, deps など）はそのまま保存し、CLI 側は無視できる

import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const MAP_NODE_KEYS = ['start', 'front', 'back', 'infra', 'release'] as const;
export type MapNodeKey = (typeof MAP_NODE_KEYS)[number];

export type WebTask = {
  id: number;
  title: string;
  completed: boolean;
  // 追加拡張（CLI非依存）：進行中フラグと依存関係
  inProgress?: boolean;
  deps?: number[]; // 依存するタスクID配列
  mapNode?: MapNodeKey;
};

export type RequirementsMessage = { role: 'user' | 'ai' | 'system'; content: string };

export type RequirementsSession = {
  summary: string;
  conversation: RequirementsMessage[];
  updatedAt: string; // ISO8601
};

export type TaskMergeSummary = {
  added: number;
  updated: number;
  unchanged: number;
  totalSeeds: number;
};

export type RepoData = {
  tasks: WebTask[];
  timer?: { startedAt: number; durationSeconds: number };
  requirements?: RequirementsSession;
};

function getStoragePaths() {
  const dir = process.env.SOLOHACK_STORAGE_DIR
    ? path.resolve(process.env.SOLOHACK_STORAGE_DIR)
    : path.resolve(process.cwd(), '..', 'storage');
  const file = path.join(dir, 'solohack.json');
  return { dir, file };
}

function normalizeMessages(value: unknown): RequirementsMessage[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<RequirementsMessage['role']>(['user', 'ai', 'system']);
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return undefined;
      const record = entry as Record<string, unknown>;
      const roleRaw = record.role;
      const contentRaw = record.content;
      const role = typeof roleRaw === 'string' && allowed.has(roleRaw as RequirementsMessage['role'])
        ? (roleRaw as RequirementsMessage['role'])
        : undefined;
      const content = typeof contentRaw === 'string' ? contentRaw : '';
      if (!role) return undefined;
      const trimmed = content.trim();
      if (!trimmed) return undefined;
      return { role, content: content };
    })
    .filter((m): m is RequirementsMessage => Boolean(m));
}

function sanitizeRequirements(value: unknown): RequirementsSession | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const rawSummary = typeof record.summary === 'string' ? record.summary : '';
  const summary = rawSummary.trim().length > 0 ? rawSummary : '';
  const conversation = normalizeMessages(record.conversation);
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString();
  if (!summary && conversation.length === 0) return undefined;
  return { summary, conversation, updatedAt };
}

export async function loadData(): Promise<RepoData> {
  const { file } = getStoragePaths();
  try {
    if (!existsSync(file)) return { tasks: [] };
    const raw = await fs.readFile(file, 'utf8');
    if (!raw.trim()) return { tasks: [] };
    const data = JSON.parse(raw) as RepoData;
    // NOTE: 想定外プロパティはそのまま維持（前方互換）
    return {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      timer: data.timer,
      requirements: sanitizeRequirements(data.requirements),
    };
  } catch {
    return { tasks: [] };
  }
}

export async function saveData(data: RepoData): Promise<void> {
  const { dir, file } = getStoragePaths();
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
  const payload = JSON.stringify({ tasks: data.tasks ?? [], timer: data.timer, requirements: data.requirements }, null, 2);
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
  if (Object.prototype.hasOwnProperty.call(patch, 'mapNode')) {
    const normalized = normalizeMapNode((patch as Record<string, unknown>).mapNode);
    if (normalized) {
      next.mapNode = normalized;
    } else {
      delete next.mapNode;
    }
  }
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

export type GeneratedTaskSeed = {
  title: string;
  mapNode?: unknown;
};

function normalizeMapNode(value: unknown): MapNodeKey | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return MAP_NODE_KEYS.find((key) => key === normalized);
}

function sanitizeGeneratedSeeds(seeds: GeneratedTaskSeed[]): Array<{ title: string; mapNode?: MapNodeKey }> {
  return seeds
    .map((seed) => {
      const title = typeof seed.title === 'string' ? seed.title.trim() : '';
      if (!title) return undefined;
      const mapNode = normalizeMapNode(seed.mapNode) ?? undefined;
      return { title, mapNode };
    })
    .filter((item): item is { title: string; mapNode?: MapNodeKey } => Boolean(item));
}

export async function replaceTasksWithGenerated(
  seeds: GeneratedTaskSeed[],
): Promise<{ tasks: WebTask[]; summary: TaskMergeSummary }> {
  const sanitized = sanitizeGeneratedSeeds(seeds);
  if (sanitized.length === 0) {
    throw new Error('No valid tasks to save');
  }

  // 日本語メモ: AI提案はタイトル単位で重複を排除し、キー一致した既存タスクへ差分マージする。
  const deduped: Array<{ key: string; title: string; mapNode?: MapNodeKey }> = [];
  const seen = new Set<string>();
  for (const item of sanitized) {
    const key = item.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({ key, title: item.title, mapNode: item.mapNode });
  }

  if (deduped.length === 0) {
    throw new Error('No valid tasks to save');
  }

  const data = await loadData();
  const existing = Array.isArray(data.tasks) ? data.tasks : [];

  const seedsByKey = new Map<string, { title: string; mapNode?: MapNodeKey }>();
  for (const item of deduped) {
    seedsByKey.set(item.key, { title: item.title, mapNode: item.mapNode });
  }

  let updatedCount = 0;
  let matchedCount = 0;
  const updatedTasks = existing.map((task) => {
    const key = task.title.trim().toLowerCase();
    const seed = seedsByKey.get(key);
    if (!seed) return task;
    seedsByKey.delete(key);
    matchedCount += 1;

    let changed = false;
    const next: WebTask = { ...task };

    if (seed.title !== task.title) {
      next.title = seed.title;
      changed = true;
    }

    if (seed.mapNode && seed.mapNode !== task.mapNode) {
      next.mapNode = seed.mapNode;
      changed = true;
    }

    if (changed) {
      updatedCount += 1;
    }

    return next;
  });

  let addedCount = 0;
  let nextId = existing.reduce((max, task) => Math.max(max, task.id), 0) + 1;

  for (const item of deduped) {
    if (!seedsByKey.has(item.key)) continue;
    seedsByKey.delete(item.key);
    const newTask: WebTask = {
      id: nextId,
      title: item.title,
      completed: false,
      inProgress: false,
      deps: [],
    };
    if (item.mapNode) {
      newTask.mapNode = item.mapNode;
    } else if (MAP_NODE_KEYS.length > 0) {
      newTask.mapNode = MAP_NODE_KEYS[0];
    }
    updatedTasks.push(newTask);
    addedCount += 1;
    nextId += 1;
  }

  data.tasks = updatedTasks;
  await saveData(data);

  const unchanged = Math.max(0, matchedCount - updatedCount);

  return {
    tasks: updatedTasks,
    summary: {
      added: addedCount,
      updated: updatedCount,
      unchanged,
      totalSeeds: deduped.length,
    },
  };
}

export async function getRequirements(): Promise<RequirementsSession | null> {
  const d = await loadData();
  return d.requirements ?? null;
}

export async function saveRequirementsSession(input: {
  summary: string;
  conversation: RequirementsMessage[];
}): Promise<RequirementsSession> {
  const summary = typeof input.summary === 'string' ? input.summary : '';
  if (!summary.trim()) {
    throw new Error('Requirements summary is required.');
  }
  const conversation = normalizeMessages(input.conversation);
  if (conversation.length === 0) {
    throw new Error('Conversation log is required.');
  }
  const session: RequirementsSession = {
    summary,
    conversation,
    updatedAt: new Date().toISOString(),
  };
  const data = await loadData();
  data.requirements = session;
  await saveData(data);
  return session;
}
