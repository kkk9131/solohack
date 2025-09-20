import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// 日本語メモ: storage.ts は import 時に process.cwd() を参照して保存先を決める。
// そのため、テストでは一時ディレクトリに cwd を差し替えてから動的 import する。

const tmpRoot = path.resolve('tmp_storage_tests');
const storageDir = path.join(tmpRoot, 'storage');
const storageFile = path.join(storageDir, 'solohack.json');

async function importStorage() {
  const mod = await import('../core/storage.js');
  return mod;
}

beforeEach(async () => {
  vi.resetModules();
  // cwd を差し替え
  vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
  await fs.mkdir(tmpRoot, { recursive: true });
  // クリーンアップ
  await fs.rm(storageDir, { recursive: true, force: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
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
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(storageFile, '{ invalid json', 'utf8');
    const { loadTasks } = await importStorage();
    const tasks = await loadTasks();
    expect(tasks).toEqual([]);
  });
});

