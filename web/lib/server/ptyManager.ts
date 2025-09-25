// 日本語メモ: PTY セッションを管理するサーバー専用の薄いマネージャ。
// Next.js route の nodejs runtime からのみ参照されることを想定。

// 日本語メモ: node-pty はネイティブ拡張を含むため、ビルド環境での読み込みを避ける。
// 動的importで実行時にのみ読み込む。
type IDisposable = { dispose: () => void };
type IPty = {
  onData: (cb: (d: string) => void) => IDisposable;
  onExit: (cb: (ev: { exitCode?: number; signal?: number }) => void) => IDisposable;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};
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

const globalWithSessions = globalThis as typeof globalThis & {
  __SLH_PTY_SESSIONS__?: Map<string, Session>;
};

const sessions: Map<string, Session> =
  globalWithSessions.__SLH_PTY_SESSIONS__ ?? new Map<string, Session>();

globalWithSessions.__SLH_PTY_SESSIONS__ = sessions;

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getRepoRoot() {
  const env = (process.env.SOLOHACK_REPO_ROOT || '').trim();
  return path.resolve(env || path.resolve(process.cwd(), '..'));
}

export async function createSession({
  cwd,
  cols = 80,
  rows = 24,
  shell: customShell,
  prompt: customPrompt
}: {
  cwd?: string;
  cols?: number;
  rows?: number;
  shell?: string;
  prompt?: string;
}) {
  const repo = getRepoRoot();
  // シェル選択（UI設定 > 環境変数 > デフォルト）
  const defaultShell = process.platform === 'win32' ? 'powershell.exe' : (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
  const shell = customShell || process.env.SOLOHACK_PTY_SHELL || process.env.SHELL || defaultShell;
  const id = genId();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'solohack',
    TERM_PROGRAM_VERSION: 'dev',
    FORCE_COLOR: '1',
    // zsh設定: プロンプトを簡潔に、行末記号を削除
    PROMPT_EOL_MARK: '',
    // カスタムプロンプト（UI設定 > 環境変数 > デフォルト）
    PS1: customPrompt || process.env.SOLOHACK_PTY_PS1 || (shell.includes('zsh') ? '%~ $ ' : '\\w$ '),
  };
  // 任意: プロンプト上書き（zsh/bash）
  if (process.env.SOLOHACK_PTY_PROMPT) env.PROMPT = process.env.SOLOHACK_PTY_PROMPT;
  if (process.env.SOLOHACK_PTY_PS1) env.PS1 = process.env.SOLOHACK_PTY_PS1;
  const { spawn } = await import('node-pty');
  const pty = spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: cwd ? path.resolve(repo, cwd) : repo,
    env,
    // 出力フォーマットを改善
    useConpty: false,
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
