import type { RepoData, StorageProvider } from './provider.js';

// 日本語メモ: プロセス内のみで状態を保持するメモリ実装。
// テストの安定性のため、明示的にリセットできる関数を用意。

let state: RepoData = { tasks: [] };

export class MemoryStorageProvider implements StorageProvider {
  async loadData(): Promise<RepoData> {
    // 浅いコピーで外部からの破壊的変更を防ぐ
    return {
      tasks: [...(state.tasks ?? [])],
      timer: state.timer ? { ...state.timer } : undefined,
    };
  }

  async saveData(data: RepoData): Promise<void> {
    state = {
      tasks: [...(data.tasks ?? [])],
      timer: data.timer ? { ...data.timer } : undefined,
    };
  }
}

export function __resetMemoryProvider() {
  state = { tasks: [] };
}

