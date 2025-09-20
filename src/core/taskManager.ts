/**
 * Task: タスク1件の構造。
 * - id: 連番（永続化を跨いでも一意になるよう、保存・復元時に最大値+1で採番）
 * - title: ユーザー入力の見出し（空文字は add 時に拒否）
 * - completed: 完了フラグ（取り消し機能はMVPでは未実装）
 */
export type Task = {
  id: number;
  title: string;
  completed: boolean;
};

/**
 * TaskManager: タスク配列を管理する軽量なドメインサービス。
 * 日本語メモ: 現状はメモリ上でのみ状態管理。CLI 側の pre/postAction で
 * JSON に保存・復元するため、ここでは副作用（I/O）を持たない設計にしている。
 */
export class TaskManager {
  private tasks: Task[] = [];
  private nextId = 1;

  constructor(initialTasks: Task[] = []) {
    this.tasks = [...initialTasks];
    this.nextId = this.tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
  }

  /**
   * タスクを追加し、採番して返す。
   * - 前後空白は除去
   * - 空文字は例外
   */
  addTask(title: string): Task {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error('Task title cannot be empty.');
    }
    const task: Task = { id: this.nextId++, title: trimmed, completed: false };
    this.tasks.push(task);
    return task;
  }

  /**
   * 現在のタスク一覧をイミュータブルに返す（外部から配列を書き換えられないようコピー）。
   */
  listTasks(): Task[] {
    return [...this.tasks];
  }

  /**
   * 指定IDのタスクを完了状態にする。
   * - 見つからなければ例外（CLI層でハンドリング）
   */
  markDone(id: number): Task {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      throw new Error(`Task with id ${id} not found.`);
    }
    task.completed = true;
    return task;
  }

  /**
   * 指定IDのタスクを削除する。
   * - 影響件数が0なら例外
   */
  removeTask(id: number): void {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((task) => task.id !== id);
    if (before === this.tasks.length) {
      throw new Error(`Task with id ${id} not found.`);
    }
  }
}

// 日本語メモ: 将来は「未完了→完了→アーカイブ」のような状態遷移や並び替えも予定。
