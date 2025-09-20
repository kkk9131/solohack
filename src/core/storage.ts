import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Task } from './taskManager.js';

// 日本語メモ: ストレージのルートデータ型。今後プロパティ追加して拡張する前提。
export type TimerPersisted = {
  startedAt: number; // epoch millis
  durationSeconds: number;
};

export type RepoData = {
  tasks: Task[];
  timer?: TimerPersisted;
};

/**
 * ストレージ層（JSON）
 * - 開発時はリポジトリ直下 `storage/solohack.json` に保存。
 * - 将来的に XDG ベースやホームディレクトリ配下への移動を検討可能。
 * - 失敗時は「空配列を返す」ことで CLI が落ちないようにしている（堅牢性優先）。
 */
const STORAGE_DIR = process.env.SOLOHACK_STORAGE_DIR
  ? path.resolve(process.env.SOLOHACK_STORAGE_DIR)
  : path.resolve(process.cwd(), 'storage');
const STORAGE_FILE = path.join(STORAGE_DIR, 'solohack.json');

/**
 * loadTasks: タスク一覧を JSON から読み込み。
 * - ファイルが無ければ空配列
 * - JSON が壊れていれば空配列（CLI側で必要なら警告を出す）
 */
export async function loadData(): Promise<RepoData> {
  try {
    if (!existsSync(STORAGE_FILE)) {
      return { tasks: [] };
    }
    const raw = await fs.readFile(STORAGE_FILE, 'utf8');
    if (!raw.trim()) return { tasks: [] };
    const data = JSON.parse(raw) as RepoData;
    return { tasks: data.tasks ?? [], timer: data.timer };
  } catch {
    // 壊れたJSON等は空扱い（ログはCLI側で必要に応じて対応）。
    return { tasks: [] };
  }
}

/**
 * saveTasks: タスク一覧を JSON に保存（フォルダが無ければ作成）。
 */
export async function saveData(data: RepoData): Promise<void> {
  if (!existsSync(STORAGE_DIR)) {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
  const payload = JSON.stringify({ tasks: data.tasks ?? [], timer: data.timer }, null, 2);
  await fs.writeFile(STORAGE_FILE, payload, 'utf8');
}

export async function loadTasks(): Promise<Task[]> {
  const d = await loadData();
  return d.tasks ?? [];
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  const d = await loadData();
  d.tasks = tasks ?? [];
  await saveData(d);
}

export async function loadTimer(): Promise<TimerPersisted | undefined> {
  const d = await loadData();
  return d.timer;
}

export async function saveTimer(timer?: TimerPersisted): Promise<void> {
  const d = await loadData();
  d.timer = timer;
  await saveData(d);
}
