"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import TerminalStartupScreen from './TerminalStartupScreen';

export default function InteractiveTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [sessionId, setSessionId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string>('');
  const [showStartupScreen, setShowStartupScreen] = useState(false);

  // ターミナル設定
  const [selectedShell, setSelectedShell] = useState<string>('default');
  const [selectedPromptType, setSelectedPromptType] = useState<string>('default');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  // 利用可能なシェルオプション
  const shellOptions = [
    { value: 'default', label: 'Default Shell' },
    { value: '/bin/zsh', label: 'Zsh' },
    { value: '/bin/bash', label: 'Bash' },
    { value: '/bin/fish', label: 'Fish (if available)' },
  ];

  // プロンプトプリセット
  const promptPresets = [
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
  ];

  // プロンプト選択時の処理
  const handlePromptTypeChange = (value: string) => {
    setSelectedPromptType(value);
    const preset = promptPresets.find(p => p.value === value);
    if (preset && value !== 'custom') {
      setCustomPrompt(preset.prompt);
    }
  };

  // 実際に使用するプロンプト
  const getActivePrompt = () => {
    if (selectedPromptType === 'custom') {
      return customPrompt;
    }
    const preset = promptPresets.find(p => p.value === selectedPromptType);
    return preset?.prompt || '';
  };

  // 設定の永続化
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

  // PTYセッション開始
  const startSession = useCallback(async () => {
    if (isRunning || !terminalRef.current || !fitAddonRef.current) return;

    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    setError('');
    // セッション停止時の処理を先に実行
    await stopSession();

    // ターミナルを完全にリセット
    terminal.reset();
    terminal.clear();

    try {
      // フィットしてから cols/rows を取得
      fitAddon.fit();

      // PTYセッション作成（設定を含む）
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

      // SSE接続
      const eventSource = new EventSource(`/api/pty/stream?id=${id}`);
      eventSourceRef.current = eventSource;

      // SSE: 出力データ受信
      eventSource.addEventListener('out', (event) => {
        const data = event.data;
        // データが空でない場合のみ書き込み
        if (data) {
          terminal.write(data);
          // 新しいデータが来たら最下部にスクロール
          setTimeout(() => {
            terminal.scrollToBottom();
          }, 10);
        }
      });

      // SSE: プロセス終了
      eventSource.addEventListener('exit', (event) => {
        terminal.writeln(`\r\n\x1b[33m[Process exited with code ${event.data}]\x1b[0m`);
        setTimeout(() => {
          terminal.scrollToBottom();
        }, 10);
        setIsRunning(false);
      });

      // SSE: エラー処理
      eventSource.onerror = () => {
        terminal.writeln('\r\n\x1b[31m[Connection lost]\x1b[0m');
        setTimeout(() => {
          terminal.scrollToBottom();
        }, 10);
        setIsRunning(false);
        eventSource.close();
      };

      // 入力処理: ターミナルへの入力をPTYに送信
      const disposable = terminal.onData((data) => {
        if (!id) return;

        fetch('/api/pty/input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, data }),
        }).catch((err) => {
          console.error('Failed to send input:', err);
        });
      });

      // セッション開始時にdisposableを保存
      (terminal as any)._inputDisposable = disposable;

      setIsRunning(true);
      terminal.focus();

      // 初期化後に最下部にスクロール
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
  }, [isRunning]);

  // PTYセッション停止
  const stopSession = useCallback(async () => {
    if (!isRunning && !sessionId) return;

    // SSE接続を閉じる
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // 入力ハンドラを削除
    const terminal = terminalRef.current;
    if (terminal && (terminal as any)._inputDisposable) {
      (terminal as any)._inputDisposable.dispose();
      (terminal as any)._inputDisposable = null;
    }

    // PTYセッションを終了
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
                {shellOptions.map((option) => (
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
                {promptPresets.map((option) => (
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
        {showStartupScreen && (
          <TerminalStartupScreen onContinue={handleStartupContinue} />
        )}
      </div>
    </div>
  );
}