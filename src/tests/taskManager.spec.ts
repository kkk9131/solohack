import { describe, expect, it } from 'vitest';
import { TaskManager } from '../core/taskManager.js';

// 日本語メモ: ドメイン層はI/Oを持たないため、ユニットテストが書きやすい。
describe('TaskManager', () => {
  it('adds a task and assigns incremental ids', () => {
    const manager = new TaskManager();
    const first = manager.addTask('First task');
    const second = manager.addTask('Second task');

    // 日本語メモ: 追加順にIDが増えることをテストで担保。
    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
  });

  it('marks a task as completed', () => {
    const manager = new TaskManager();
    const task = manager.addTask('Study TypeScript');

    const completed = manager.markDone(task.id);

    expect(completed.completed).toBe(true);
    expect(manager.listTasks()[0].completed).toBe(true);
  });

  it('throws when removing unknown id', () => {
    const manager = new TaskManager();

    expect(() => manager.removeTask(999)).toThrowError();
  });
});
