import type { Task } from './taskManager.js';
import type { RepoData, StorageProvider, TimerPersisted } from './storage/provider.js';
import { JsonStorageProvider } from './storage/jsonProvider.js';

export type { RepoData, TimerPersisted } from './storage/provider.js';

// 日本語メモ: 今後の差し替え用プロバイダー取得（現状は JSON のみ）
function getProvider(): StorageProvider {
  const provider = process.env.SOLOHACK_STORAGE_PROVIDER ?? 'json';
  switch (provider) {
    case 'json':
    default:
      return new JsonStorageProvider();
  }
}

/**
 * loadTasks: タスク一覧を JSON から読み込み。
 * - ファイルが無ければ空配列
 * - JSON が壊れていれば空配列（CLI側で必要なら警告を出す）
 */
export async function loadData(): Promise<RepoData> {
  return getProvider().loadData();
}

/**
 * saveTasks: タスク一覧を JSON に保存（フォルダが無ければ作成）。
 */
export async function saveData(data: RepoData): Promise<void> {
  return getProvider().saveData(data);
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
