import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { RepoData, StorageProvider } from './provider.js';

const STORAGE_DIR = process.env.SOLOHACK_STORAGE_DIR
  ? path.resolve(process.env.SOLOHACK_STORAGE_DIR)
  : path.resolve(process.cwd(), 'storage');
const STORAGE_FILE = path.join(STORAGE_DIR, 'solohack.json');

export class JsonStorageProvider implements StorageProvider {
  async loadData(): Promise<RepoData> {
    try {
      if (!existsSync(STORAGE_FILE)) return { tasks: [] };
      const raw = await fs.readFile(STORAGE_FILE, 'utf8');
      if (!raw.trim()) return { tasks: [] };
      const data = JSON.parse(raw) as RepoData;
      return { tasks: data.tasks ?? [], timer: data.timer };
    } catch {
      return { tasks: [] };
    }
  }

  async saveData(data: RepoData): Promise<void> {
    if (!existsSync(STORAGE_DIR)) {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
    const payload = JSON.stringify({ tasks: data.tasks ?? [], timer: data.timer }, null, 2);
    await fs.writeFile(STORAGE_FILE, payload, 'utf8');
  }
}

