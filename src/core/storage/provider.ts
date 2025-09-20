import type { Task } from '../taskManager.js';

export type TimerPersisted = {
  startedAt: number;
  durationSeconds: number;
};

export type RepoData = {
  tasks: Task[];
  timer?: TimerPersisted;
};

export interface StorageProvider {
  loadData(): Promise<RepoData>;
  saveData(data: RepoData): Promise<void>;
}

