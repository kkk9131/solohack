import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('memory storage provider', () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.SOLOHACK_STORAGE_PROVIDER = 'memory';
    const { __resetMemoryProvider } = await import('../core/storage/memoryProvider.js');
    __resetMemoryProvider();
  });

  it('persists tasks in-process without touching filesystem', async () => {
    const { loadTasks, saveTasks } = await import('../core/storage.js');
    let tasks = await loadTasks();
    expect(tasks).toEqual([]);

    await saveTasks([
      { id: 1, title: 'A', completed: false },
      { id: 2, title: 'B', completed: true },
    ]);

    tasks = await loadTasks();
    expect(tasks.length).toBe(2);
    expect(tasks[0].title).toBe('A');
  });

  it('saves and clears timer', async () => {
    const { loadTimer, saveTimer } = await import('../core/storage.js');
    expect(await loadTimer()).toBeUndefined();
    await saveTimer({ startedAt: 1000, durationSeconds: 60 });
    const t = await loadTimer();
    expect(t?.startedAt).toBe(1000);
    await saveTimer(undefined);
    expect(await loadTimer()).toBeUndefined();
  });
});

