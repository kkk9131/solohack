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

// 日本語メモ: 開発中のホットリロードでモジュールが再評価されてもセッションを維持するため、
// globalThis にセッションマップを格納する。
declare global {
  // eslint-disable-next-line no-var
  var __SLH_PTY_SESSIONS__: Map<string, Session> | undefined;
}
const sessions: Map<string, Session> = (globalThis as any).__SLH_PTY_SESSIONS__ || new Map<string, Session>();
(globalThis as any).__SLH_PTY_SESSIONS__ = sessions;

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getRepoRoot() {
  const env = (process.env.SOLOHACK_REPO_ROOT || '').trim();
  return path.resolve(env || path.resolve(process.cwd(), '..'));
}

export function createSession({ cwd, cols = 80, rows = 24 }: { cwd?: string; cols?: number; rows?: number }) {
  const repo = getRepoRoot();
  const defaultShell = process.platform === 'win32' ? 'powershell.exe' : (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
  const shell = process.env.SHELL || defaultShell;
  const id = genId();
  const env = {
    ...process.env,
    TERM: process.env.TERM || 'xterm-256color',
    COLORTERM: process.env.COLORTERM || 'truecolor',
    TERM_PROGRAM: process.env.TERM_PROGRAM || 'solohack',
    TERM_PROGRAM_VERSION: process.env.TERM_PROGRAM_VERSION || 'dev',
    FORCE_COLOR: process.env.FORCE_COLOR || '1',
    // 日本語メモ: カラー有効化/互換性のために最低限の端末系ENVを明示
  } as any;
  // 任意: プロンプト上書き（zsh/bash）
  if (process.env.SOLOHACK_PTY_PROMPT) env.PROMPT = process.env.SOLOHACK_PTY_PROMPT;
  if (process.env.SOLOHACK_PTY_PS1) env.PS1 = process.env.SOLOHACK_PTY_PS1;
  const pty = spawn(shell, [], {
    name: 'xterm-color',
    cols,
    rows,
    cwd: cwd ? path.resolve(repo, cwd) : repo,
    env,
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
