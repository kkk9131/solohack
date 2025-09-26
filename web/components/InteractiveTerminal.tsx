"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import type { IDisposable } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import TerminalStartupScreen from './TerminalStartupScreen';

type CommandMemo = {
  id: string;
  title: string;
  command: string;
  description?: string;
};

type CommandMemoSession = {
  id: string;
  name: string;
  commands: CommandMemo[];
};

const COMMAND_MEMO_STORAGE_KEY = 'solohack-terminal-command-memos';

const SHELL_OPTIONS = [
  { value: 'default', label: 'Default Shell' },
  { value: '/bin/zsh', label: 'Zsh' },
  { value: '/bin/bash', label: 'Bash' },
  { value: '/bin/fish', label: 'Fish (if available)' },
] as const;

const PROMPT_PRESETS = [
  { value: 'default', label: 'Default', prompt: '' },
  { value: 'simple', label: 'Simple ($)', prompt: '$ ' },
  { value: 'arrow', label: 'Arrow (>)', prompt: '> ' },
  { value: 'lambda', label: 'Lambda (λ)', prompt: 'λ ' },
  { value: 'dir-bash', label: 'Directory (Bash)', prompt: '\\w$ ' },
  { value: 'dir-zsh', label: 'Directory (Zsh)', prompt: '%~ $ ' },
  { value: 'user-bash', label: 'User@Host (Bash)', prompt: '\\u@\\h:\\w$ ' },
  { value: 'user-zsh', label: 'User@Host (Zsh)', prompt: '%n@%m:%~ $ ' },
  { value: 'time-bash', label: 'Time + Dir (Bash)', prompt: '[\\t] \\w$ ' },
  { value: 'time-zsh', label: 'Time + Dir (Zsh)', prompt: '[%T] %~ $ ' },
  { value: 'custom', label: 'Custom', prompt: '' },
] as const;

const DEFAULT_COMMAND_MEMO_SESSIONS: CommandMemoSession[] = [
  {
    id: 'memo-session-git',
    name: 'Git Basics',
    commands: [
      {
        id: 'memo-git-status',
        title: 'Git Status',
        command: 'git status',
        description: 'Check the current working tree status.',
      },
      {
        id: 'memo-git-pull',
        title: 'Git Pull',
        command: 'git pull',
        description: 'Fetch and merge latest changes from the default remote.',
      },
      {
        id: 'memo-git-add',
        title: 'Git Add All',
        command: 'git add .',
        description: 'Stage all changes in the current repository.',
      },
      {
        id: 'memo-git-commit',
        title: 'Git Commit',
        command: "git commit -m 'message'",
        description: 'Commit staged changes with a message placeholder.',
      },
      {
        id: 'memo-git-push',
        title: 'Git Push',
        command: 'git push',
        description: 'Push local commits to the default remote branch.',
      },
    ],
  },
];

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function InteractiveTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const inputDisposableRef = useRef<IDisposable | null>(null);

  const [sessionId, setSessionId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string>('');
  const [showStartupScreen, setShowStartupScreen] = useState(false);
  const [showCommandMemo, setShowCommandMemo] = useState(false);

  // ターミナル設定
  const [selectedShell, setSelectedShell] = useState<string>('default');
  const [selectedPromptType, setSelectedPromptType] = useState<string>('default');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  // コマンドメモ管理
  const [commandMemoSessions, setCommandMemoSessions] = useState<CommandMemoSession[]>(DEFAULT_COMMAND_MEMO_SESSIONS);
  const [activeMemoSessionId, setActiveMemoSessionId] = useState<string>(
    DEFAULT_COMMAND_MEMO_SESSIONS[0]?.id ?? ''
  );
  const [newSessionName, setNewSessionName] = useState('');
  const [newCommandTitle, setNewCommandTitle] = useState('');
  const [newCommandValue, setNewCommandValue] = useState('');
  const [newCommandDescription, setNewCommandDescription] = useState('');

  // プロンプト選択時の処理
  const handlePromptTypeChange = useCallback((value: string) => {
    setSelectedPromptType(value);
    const preset = PROMPT_PRESETS.find((presetOption) => presetOption.value === value);
    if (preset && value !== 'custom') {
      setCustomPrompt(preset.prompt);
    }
  }, []);

  // 実際に使用するプロンプト
  const getActivePrompt = useCallback(() => {
    if (selectedPromptType === 'custom') {
      return customPrompt;
    }
    const preset = PROMPT_PRESETS.find((presetOption) => presetOption.value === selectedPromptType);
    return preset?.prompt || '';
  }, [selectedPromptType, customPrompt]);

  // コマンドメモ操作
  const handleAddSession = useCallback(() => {
    setCommandMemoSessions((prev) => {
      const trimmed = newSessionName.trim();
      const sessionId = createId('memo-session');
      const sessionName = trimmed || `Session ${prev.length + 1}`;
      const nextSessions = [
        ...prev,
        {
          id: sessionId,
          name: sessionName,
          commands: [],
        },
      ];
      setActiveMemoSessionId(sessionId);
      return nextSessions;
    });
    setNewSessionName('');
  }, [newSessionName]);

  const handleDeleteSession = useCallback((sessionIdToRemove: string) => {
    if (!sessionIdToRemove) {
      return;
    }
    setCommandMemoSessions((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      const filtered = prev.filter((session) => session.id !== sessionIdToRemove);
      if (filtered.length === prev.length) {
        return prev;
      }
      if (activeMemoSessionId === sessionIdToRemove) {
        setActiveMemoSessionId(filtered[0]?.id ?? '');
      }
      return filtered;
    });
  }, [activeMemoSessionId]);

  const handleAddCommand = useCallback(() => {
    const trimmedCommand = newCommandValue.trim();
    if (!activeMemoSessionId || !trimmedCommand) {
      return;
    }
    const trimmedTitle = newCommandTitle.trim();
    const trimmedDescription = newCommandDescription.trim();
    setCommandMemoSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeMemoSessionId) {
          return session;
        }
        const newMemo: CommandMemo = {
          id: createId('memo'),
          title: trimmedTitle || trimmedCommand,
          command: trimmedCommand,
          description: trimmedDescription || undefined,
        };
        return {
          ...session,
          commands: [...session.commands, newMemo],
        };
      })
    );
    setNewCommandTitle('');
    setNewCommandValue('');
    setNewCommandDescription('');
  }, [activeMemoSessionId, newCommandTitle, newCommandValue, newCommandDescription]);

  const handleDeleteCommand = useCallback((commandId: string) => {
    if (!activeMemoSessionId) {
      return;
    }
    setCommandMemoSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeMemoSessionId) {
          return session;
        }
        return {
          ...session,
          commands: session.commands.filter((command) => command.id !== commandId),
        };
      })
    );
  }, [activeMemoSessionId]);

  // 日本語メモ: クリックしたメモコマンドを現在のPTYセッションへ送信する
  const sendCommandToTerminal = useCallback(async (command: string) => {
    if (!isRunning || !sessionId) {
      setError('Start the terminal before running a command memo.');
      return;
    }
    try {
      await fetch('/api/pty/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, data: `${command}\n` }),
      });
      terminalRef.current?.focus();
    } catch (err) {
      console.error('Failed to send memo command:', err);
      setError('Failed to send command. Please check the console for details.');
    }
  }, [isRunning, sessionId]);

  const handleRunMemoCommand = useCallback((command: string) => {
    void sendCommandToTerminal(command);
  }, [sendCommandToTerminal]);

  useEffect(() => {
    const savedShell = localStorage.getItem('solohack-terminal-shell');
    const savedPromptType = localStorage.getItem('solohack-terminal-prompt-type');
    const savedCustomPrompt = localStorage.getItem('solohack-terminal-custom-prompt');

    if (savedShell) setSelectedShell(savedShell);
    if (savedPromptType) setSelectedPromptType(savedPromptType);
    if (savedCustomPrompt) setCustomPrompt(savedCustomPrompt);
  }, []);

  useEffect(() => {
    localStorage.setItem('solohack-terminal-shell', selectedShell);
  }, [selectedShell]);

  useEffect(() => {
    localStorage.setItem('solohack-terminal-prompt-type', selectedPromptType);
  }, [selectedPromptType]);

  useEffect(() => {
    localStorage.setItem('solohack-terminal-custom-prompt', customPrompt);
  }, [customPrompt]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const storedSessions = localStorage.getItem(COMMAND_MEMO_STORAGE_KEY);
      if (storedSessions) {
        const parsed = JSON.parse(storedSessions) as CommandMemoSession[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCommandMemoSessions(parsed);
          setActiveMemoSessionId((current) => current || parsed[0]?.id || '');
        }
      }
    } catch (err) {
      console.error('Failed to load command memos:', err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // 日本語メモ: コマンドメモをローカルストレージへ保存して次回以降に復元できるようにする
    localStorage.setItem(COMMAND_MEMO_STORAGE_KEY, JSON.stringify(commandMemoSessions));
  }, [commandMemoSessions]);

  useEffect(() => {
    if (!commandMemoSessions.length) {
      setActiveMemoSessionId('');
      return;
    }
    if (!commandMemoSessions.some((session) => session.id === activeMemoSessionId)) {
      setActiveMemoSessionId(commandMemoSessions[0].id);
    }
  }, [commandMemoSessions, activeMemoSessionId]);

  // ターミナルの初期化
  useEffect(() => {
    if (!containerRef.current) return;

    // xterm.jsのインスタンス作成
    const terminal = new Terminal({
      cols: 100,
      rows: 30,
      fontSize: 13,
      fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, monospace',
      theme: {
        background: '#0b0f14',
        foreground: '#e5e7eb',
        cursor: '#00d8ff',
        cursorAccent: '#0b0f14',
        selectionBackground: 'rgba(0, 216, 255, 0.3)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#00d8ff',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e67',
        brightGreen: '#5af78e',
        brightYellow: '#f4f99d',
        brightBlue: '#00d8ff',
        brightMagenta: '#ff92d0',
        brightCyan: '#9aedfe',
        brightWhite: '#e6e6e6',
      },
      cursorBlink: true,
      // 改行コードの変換を有効に（テキスト表示改善のため）
      convertEol: true,
      // 行の折り返し設定
      wordWrap: true,
      // スクロール設定
      smoothScrollDuration: 0, // 即座にスクロール
      scrollSensitivity: 3,
      fastScrollSensitivity: 10,
      // スクロールバック設定
      scrollback: 10000,
    });

    // FitAddonを追加
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // ターミナルをDOMに接続
    terminal.open(containerRef.current);

    // 初期フィット
    setTimeout(() => {
      try {
        fitAddon.fit();
        terminal.focus();
      } catch (e) {
        console.error('Failed to fit terminal:', e);
      }
    }, 0);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // ウィンドウリサイズ対応
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.error('Failed to fit on resize:', e);
      }
    };
    window.addEventListener('resize', handleResize);

    // クリーンアップ
    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, []);

  // PTYセッション停止
  const stopSession = useCallback(async () => {
    if (!isRunning && !sessionId) {
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (inputDisposableRef.current) {
      inputDisposableRef.current.dispose();
      inputDisposableRef.current = null;
    }

    const terminal = terminalRef.current;

    if (sessionId) {
      try {
        await fetch('/api/pty/kill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sessionId }),
        });
      } catch (err) {
        console.error('Failed to kill PTY session:', err);
      }
      setSessionId('');
    }

    setIsRunning(false);

    if (terminal) {
      terminal.writeln('\r\n\x1b[33m[Session stopped]\x1b[0m');
    }
  }, [isRunning, sessionId]);

  // PTYセッション開始
  const startSession = useCallback(async () => {
    if (isRunning || !terminalRef.current || !fitAddonRef.current) {
      return;
    }

    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    setError('');
    await stopSession();

    terminal.reset();
    terminal.clear();

    try {
      fitAddon.fit();

      const activePrompt = getActivePrompt();
      const sessionConfig = {
        cols: terminal.cols,
        rows: terminal.rows,
        shell: selectedShell !== 'default' ? selectedShell : undefined,
        prompt: activePrompt || undefined,
      };

      const response = await fetch('/api/pty/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to start PTY: ${response.statusText}`);
      }

      const { id } = await response.json();
      setSessionId(id);

      const eventSource = new EventSource(`/api/pty/stream?id=${id}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('out', (event: MessageEvent<string>) => {
        const data = event.data;
        if (data) {
          terminal.write(data);
          setTimeout(() => {
            terminal.scrollToBottom();
          }, 10);
        }
      });

      eventSource.addEventListener('exit', (event: MessageEvent<string>) => {
        terminal.writeln(`\r\n\x1b[33m[Process exited with code ${event.data}]\x1b[0m`);
        setTimeout(() => {
          terminal.scrollToBottom();
        }, 10);
        setIsRunning(false);
      });

      eventSource.onerror = () => {
        terminal.writeln('\r\n\x1b[31m[Connection lost]\x1b[0m');
        setTimeout(() => {
          terminal.scrollToBottom();
        }, 10);
        setIsRunning(false);
        eventSource.close();
      };

      const disposable = terminal.onData((data) => {
        if (!id) {
          return;
        }

        fetch('/api/pty/input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, data }),
        }).catch((err) => {
          console.error('Failed to send input:', err);
        });
      });
      inputDisposableRef.current = disposable;

      setIsRunning(true);
      terminal.focus();

      setTimeout(() => {
        terminal.scrollToBottom();
      }, 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      terminal.writeln(`\r\n\x1b[31m[Error: ${message}]\x1b[0m`);
      setTimeout(() => {
        terminal.scrollToBottom();
      }, 10);
      setIsRunning(false);
    }
  }, [getActivePrompt, isRunning, selectedShell, stopSession]);

  // ターミナルクリア
  const clearTerminal = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.clear();
    }
  }, []);

  // リサイズ処理
  const handleResize = useCallback(async () => {
    if (!terminalRef.current || !fitAddonRef.current || !sessionId) return;

    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    try {
      fitAddon.fit();

      // PTYにリサイズを通知
      await fetch('/api/pty/resize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          cols: terminal.cols,
          rows: terminal.rows,
        }),
      });
    } catch (err) {
      console.error('Failed to resize:', err);
    }
  }, [sessionId]);

  // リサイズイベント監視
  useEffect(() => {
    if (!sessionId) return;

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [sessionId, handleResize]);

  // Handle Start button click - show startup screen first
  const handleStartClick = useCallback(() => {
    if (isRunning) {
      stopSession();
    } else {
      setShowStartupScreen(true);
    }
  }, [isRunning, stopSession]);

  // Handle continuing from startup screen to actual terminal
  const handleStartupContinue = useCallback(() => {
    setShowStartupScreen(false);
    startSession();
  }, [startSession]);

  const activeMemoSession = commandMemoSessions.find((session) => session.id === activeMemoSessionId);

  return (
    <div className="hud-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-neon text-lg">Terminal</h3>
          {error && (
            <p className="text-red-500 text-sm mt-1">{error}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleStartClick}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isRunning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-neon hover:bg-neon/80 text-black'
            }`}
          >
            {isRunning ? 'Stop' : 'Start'}
          </button>

          <button
            onClick={clearTerminal}
            className="px-4 py-2 rounded-md text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            Clear
          </button>

          <button
            onClick={() => setShowCommandMemo((prev) => !prev)}
            className="px-4 py-2 rounded-md text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            Command
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 rounded-md text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            Settings
          </button>
        </div>
      </div>

      {/* 設定パネル */}
      {showSettings && (
        <div className="bg-gray-800 rounded-lg p-4 border border-neon/20 space-y-4">
          <h4 className="text-white font-medium">Terminal Settings</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Shell
              </label>
              <select
                value={selectedShell}
                onChange={(e) => setSelectedShell(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-neon focus:border-transparent"
              >
                {SHELL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prompt Style
              </label>
              <select
                value={selectedPromptType}
                onChange={(e) => handlePromptTypeChange(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-neon focus:border-transparent"
              >
                {PROMPT_PRESETS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* カスタムプロンプト入力（Customが選択された場合のみ表示） */}
          {selectedPromptType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Custom Prompt String
              </label>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., $ or \\w$ or %~ $ "
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-neon focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Bash: \\u (user), \\h (host), \\w (dir) | Zsh: %n (user), %m (host), %~ (dir)
              </p>
              </div>
          )}

          <div className="text-xs text-gray-400">
            <p>• Changes take effect when starting a new session</p>
            <p>• Select appropriate prompt style for your shell (Bash/Zsh)</p>
            <p>• Settings are saved in browser localStorage</p>
          </div>
        </div>
      )}

      <div
        className="bg-black rounded-lg p-2 border border-neon/20 relative overflow-hidden"
        style={{ height: '600px' }}
      >
        <div
          ref={containerRef}
          className="h-full w-full overflow-auto"
        />
        {showCommandMemo && (
          <div className="pointer-events-none absolute inset-0 flex justify-end p-4">
            <div className="pointer-events-auto flex w-80 flex-col overflow-hidden rounded-lg border border-neon/30 bg-gray-900/95 text-sm text-gray-200 shadow-lg backdrop-blur">
              <div className="flex items-start justify-between gap-3 border-b border-neon/20 px-4 py-3">
                <div>
                  <p className="font-medium text-white">Command Memo</p>
                  <p className="text-xs text-gray-400">Click command to send it to terminal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCommandMemo(false)}
                  className="text-sm text-gray-400 transition hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Session
                  </label>
                  <select
                    value={activeMemoSessionId}
                    onChange={(event) => setActiveMemoSessionId(event.target.value)}
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon"
                  >
                    {commandMemoSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSessionName}
                      onChange={(event) => setNewSessionName(event.target.value)}
                      placeholder="New session name"
                      className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon"
                    />
                    <button
                      type="button"
                      onClick={handleAddSession}
                      className="rounded-md bg-neon px-3 py-2 text-sm font-medium text-black transition hover:bg-neon/80"
                    >
                      Add
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(activeMemoSessionId)}
                    disabled={commandMemoSessions.length <= 1}
                    className="text-left text-xs text-gray-400 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete current session
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Saved Commands
                  </p>
                  {activeMemoSession && activeMemoSession.commands.length > 0 ? (
                    activeMemoSession.commands.map((command) => (
                      <div
                        key={command.id}
                        className="group relative rounded-md border border-gray-700 bg-gray-800/80 transition hover:border-neon/60"
                      >
                        <button
                          type="button"
                          onClick={() => handleRunMemoCommand(command.command)}
                          className="w-full rounded-md px-3 py-2 text-left pr-12"
                        >
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">
                              {command.title || command.command}
                            </p>
                            <span className="rounded-full bg-neon/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neon">
                              Run
                            </span>
                          </div>
                          <p className="mt-1 break-words font-mono text-xs text-neon/90">
                            {command.command}
                          </p>
                          {command.description && (
                            <p className="mt-1 text-xs text-gray-400">
                              {command.description}
                            </p>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteCommand(command.id);
                          }}
                          className="absolute right-2 top-2 text-xs text-gray-500 transition hover:text-red-400"
                          aria-label="Delete command"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-gray-700 bg-gray-800/60 px-3 py-2 text-xs text-gray-400">
                      No commands saved yet. Add one below to get started.
                    </p>
                  )}
                </div>

                <div className="space-y-2 border-t border-neon/10 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Add Command
                  </p>
                  <input
                    type="text"
                    value={newCommandTitle}
                    onChange={(event) => setNewCommandTitle(event.target.value)}
                    placeholder="Optional title (e.g., Git Status)"
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon"
                  />
                  <textarea
                    value={newCommandValue}
                    onChange={(event) => setNewCommandValue(event.target.value)}
                    placeholder="Command to run (e.g., git status)"
                    rows={2}
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon"
                  />
                  <input
                    type="text"
                    value={newCommandDescription}
                    onChange={(event) => setNewCommandDescription(event.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neon"
                  />
                  <button
                    type="button"
                    onClick={handleAddCommand}
                    disabled={!activeMemoSessionId || !newCommandValue.trim()}
                    className="w-full rounded-md bg-neon px-3 py-2 text-sm font-medium text-black transition hover:bg-neon/80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Command
                  </button>
                </div>
              </div>
              <div className="border-t border-neon/20 px-4 py-2 text-xs text-gray-400">
                Terminal session is {isRunning ? 'running' : 'stopped'}.
              </div>
            </div>
          </div>
        )}
        {showStartupScreen && (
          <TerminalStartupScreen onContinue={handleStartupContinue} />
        )}
      </div>
    </div>
  );
}
