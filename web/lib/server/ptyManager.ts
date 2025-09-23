// 日本語メモ: PTY セッションを管理するサーバー専用の薄いマネージャ。
// Next.js route の nodejs runtime からのみ参照されることを想定。

import type { IPty } from 'node-pty';
import { spawn } from 'node-pty';
import path from 'node:path';

type Session = {
  id: string;
  pty: IPty;
  createdAt: number;
  cwd: string;
};

const sessions = new Map<string, Session>();

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getRepoRoot() {
  const env = (process.env.SOLOHACK_REPO_ROOT || '').trim();
  return path.resolve(env || path.resolve(process.cwd(), '..'));
}

export function createSession({ cwd, cols = 80, rows = 24 }: { cwd?: string; cols?: number; rows?: number }) {
  const repo = getRepoRoot();
  const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash');
  const id = genId();
  const pty = spawn(shell, [], {
    name: 'xterm-color',
    cols,
    rows,
    cwd: cwd ? path.resolve(repo, cwd) : repo,
    env: process.env as any,
  });
  const sess: Session = { id, pty, createdAt: Date.now(), cwd: cwd ? path.resolve(repo, cwd) : repo };
  sessions.set(id, sess);
  pty.onExit(() => {
    sessions.delete(id);
  });
  return sess;
}

export function getSession(id: string) {
  return sessions.get(id) || null;
}

export function killSession(id: string) {
  const s = sessions.get(id);
  if (!s) return false;
  try { s.pty.kill(); } catch {}
  sessions.delete(id);
  return true;
}

export function listSessions() {
  return Array.from(sessions.values()).map((s) => ({ id: s.id, cwd: s.cwd, createdAt: s.createdAt }));
}

