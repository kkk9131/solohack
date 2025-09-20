import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// 日本語メモ: SOLOHACK_STORAGE_DIR 環境変数を使って保存先を切り替える。

let tmpRoot: string;
let storageFile: string;

async function importStorage() {
  const mod = await import('../core/storage.js');
  return mod;
}

beforeEach(async () => {
  vi.resetModules();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'solohack-'));
  process.env.SOLOHACK_STORAGE_DIR = tmpRoot;
  storageFile = path.join(tmpRoot, 'solohack.json');
  await fs.rm(storageFile, { force: true });
});

afterEach(async () => {
  delete process.env.SOLOHACK_STORAGE_DIR;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('storage JSON persistence', () => {
  it('returns empty when file does not exist', async () => {
    const { loadTasks } = await importStorage();
    const tasks = await loadTasks();
    expect(tasks).toEqual([]);
  });

  it('saves and loads tasks from JSON', async () => {
    const { loadTasks, saveTasks } = await importStorage();
    const input = [
      { id: 1, title: 'A', completed: false },
      { id: 2, title: 'B', completed: true },
    ];
    await saveTasks(input);
    const loaded = await loadTasks();
    expect(loaded).toEqual(input);
    const raw = await fs.readFile(storageFile, 'utf8');
    expect(raw).toContain('"tasks"');
  });

  it('returns empty when JSON is malformed', async () => {
    await fs.mkdir(path.dirname(storageFile), { recursive: true });
    await fs.writeFile(storageFile, '{ invalid json', 'utf8');
    const { loadTasks } = await importStorage();
    const tasks = await loadTasks();
    expect(tasks).toEqual([]);
  });

  it('saves and loads timer, and preserves across saveTasks', async () => {
    const { saveTimer, loadTimer, saveTasks, loadTasks } = await importStorage();
    const now = Date.now();
    await saveTimer({ startedAt: now, durationSeconds: 120 });
    await saveTasks([{ id: 1, title: 'X', completed: false }]);
    const timer = await loadTimer();
    const tasks = await loadTasks();
    expect(timer).toEqual({ startedAt: now, durationSeconds: 120 });
    expect(tasks.length).toBe(1);
  });

  it('clears timer when undefined is passed', async () => {
    const { saveTimer, loadTimer } = await importStorage();
    await saveTimer({ startedAt: Date.now(), durationSeconds: 30 });
    await saveTimer(undefined);
    const t = await loadTimer();
    expect(t).toBeUndefined();
  });

  it('uses default storage dir when env is not set', async () => {
    // 日本語メモ: env を消して再importすると、デフォルトの ./storage を使用する。
    delete process.env.SOLOHACK_STORAGE_DIR;
    vi.resetModules();
    const { saveTasks } = await import('../core/storage.js');
    await saveTasks([]);
    const defaultFile = path.join(process.cwd(), 'storage', 'solohack.json');
    const exists = await fs
      .access(defaultFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
    // 後始末: ファイル削除（ディレクトリは残しても可）
    await fs.rm(defaultFile, { force: true });
  });
});
