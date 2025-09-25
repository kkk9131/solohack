"use client";
import { useEffect, useRef, useState } from 'react';
import { Terminal, type IDisposable, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// 日本語メモ: WebSocket ではなく SSE + REST で双方向を実現（入力はPOST、出力はSSE）。

type TerminalScheme = 'neon' | 'one-dark' | 'solarized-dark' | 'monokai' | 'vscode-dark';

const DEFAULT_COLORS = { bg: '#0b0f14', neon: '#00d8ff' } as const;

function readCssColors(): { bg: string; neon: string } {
  if (typeof document === 'undefined') return { ...DEFAULT_COLORS };
  let bg: string = DEFAULT_COLORS.bg;
  let neon: string = DEFAULT_COLORS.neon;
  try {
    const cs = getComputedStyle(document.documentElement);
    bg = (cs.getPropertyValue('--bg').trim() || bg);
    neon = (cs.getPropertyValue('--neon').trim() || neon);
  } catch {}
  return { bg, neon };
}

export default function InteractiveTerminal() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const dataListenerRef = useRef<IDisposable | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  // 日本語メモ: VSCode風操作向上（Clearボタン/ResizeObserver/詳細エラー）
  const [scheme, setScheme] = useState<TerminalScheme>('neon');
  const [cssColors, setCssColors] = useState<{ bg: string; neon: string }>(() => readCssColors());

  useEffect(() => {
    const initialColors = readCssColors();
    setCssColors((prev) => (prev.bg === initialColors.bg && prev.neon === initialColors.neon ? prev : initialColors));
    const theme = getTheme(scheme, initialColors);
    const term = new Terminal({
      fontSize: 13,
      convertEol: true,
      cursorBlink: true,
      scrollback: 10000,
      allowTransparency: false,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 7,
      theme,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;
    let opened = false;
    const tryOpen = () => {
      if (opened) return;
      const el = containerRef.current;
      if (!el) { requestAnimationFrame(tryOpen); return; }
      const { clientWidth, clientHeight } = el;
      if (clientWidth <= 0 || clientHeight <= 0) { requestAnimationFrame(tryOpen); return; }
      try {
        term.open(el);
        // 日本語メモ: 一部ブラウザで初期描画が遅れるためオープン直後にもテーマとフィットを補正。
        try { Object.assign(term.options, { theme }); } catch {}
        try { fit.fit(); } catch {}
        try { term.focus(); } catch {}
        opened = true;
      } catch {
        requestAnimationFrame(tryOpen);
      }
    };
    requestAnimationFrame(tryOpen);

    // CSS変数の変更を監視し、端末テーマも追随させる
    let mo: MutationObserver | null = null;
    try {
      mo = new MutationObserver(() => {
        const next = readCssColors();
        setCssColors((prev) => (prev.bg === next.bg && prev.neon === next.neon ? prev : next));
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    } catch {}

    // コンテナのサイズ変化に応じて自動フィット（VSCodeのように追従）
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => {
        if (!sessionId) return; // 未起動時は無視
        try { fit.fit(); } catch {}
        void sendResize();
      });
      if (containerRef.current) ro.observe(containerRef.current);
    } catch {}

    const onResize = () => {
      if (!sessionId) return;
      try { fit.fit(); } catch {}
      void sendResize();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      try { ro?.disconnect(); } catch {}
      try { mo?.disconnect(); } catch {}
      try { term.dispose(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getTheme(name: TerminalScheme, base: { bg: string; neon: string }): ITheme {
    switch (name) {
      case 'one-dark':
        return {
          background: '#1e2127', foreground: '#abb2bf', cursor: '#528bff', cursorAccent: '#1e2127',
          selectionBackground: 'rgba(82, 139, 255, 0.25)', black: '#5c6370', red: '#e06c75', green: '#98c379', yellow: '#d19a66', blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#e6efff', brightBlack: '#7f848e', brightWhite: '#ffffff',
        } satisfies ITheme;
      case 'solarized-dark':
        return {
          background: '#002b36', foreground: '#93a1a1', cursor: '#b58900', cursorAccent: '#002b36',
          selectionBackground: 'rgba(181, 137, 0, 0.25)', black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5', brightBlack: '#586e75', brightWhite: '#fdf6e3',
        } satisfies ITheme;
      case 'monokai':
        return {
          background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0', cursorAccent: '#272822',
          selectionBackground: 'rgba(248, 248, 242, 0.25)', black: '#75715e', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75', blue: '#66d9ef', magenta: '#ae81ff', cyan: '#2AA198', white: '#f8f8f2', brightBlack: '#a1a08e', brightWhite: '#ffffff',
        } satisfies ITheme;
      case 'vscode-dark':
        return {
          background: '#1f1f1f', foreground: '#d4d4d4', cursor: '#aeafad', cursorAccent: '#1f1f1f',
          selectionBackground: 'rgba(173, 214, 255, 0.25)', black: '#808080', red: '#f48771', green: '#50fa7b', yellow: '#f1fa8c', blue: '#61afef', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2', brightBlack: '#a9a9a9', brightWhite: '#ffffff',
        } satisfies ITheme;
      case 'neon':
      default:
        return {
          background: base.bg, foreground: '#e5e7eb', cursor: base.neon, cursorAccent: base.bg,
          selectionBackground: 'rgba(0, 216, 255, 0.25)', black: '#9ca3af', red: '#ff616e', green: '#a3ff00', yellow: '#f59e0b', blue: base.neon, magenta: '#ff00d8', cyan: '#34d399', white: '#e5e7eb', brightBlack: '#cbd5e1', brightWhite: '#ffffff',
        } satisfies ITheme;
    }
  }

  // 日本語メモ: テーマ/スキーム変更後は xterm テーマを即時再適用
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const theme = getTheme(scheme, cssColors);
    try {
      Object.assign(term.options, { theme });
      term.refresh(0, term.rows - 1);
    } catch {}
  }, [scheme, cssColors]);
  async function sendResize() {
    const term = termRef.current; const fit = fitRef.current;
    if (!term || !fit || !sessionId) return;
    try {
      await fetch('/api/pty/resize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, cols: term.cols, rows: term.rows }),
      });
    } catch {}
  }

  async function start() {
    if (running) return;
    setError('');
    // 既存の接続があれば安全に停止
    try { await stop(); } catch {}
    const term = termRef.current!;
    term.reset();
    try { term.writeln('\x1b[37m[terminal ready]\x1b[0m'); } catch {}
    // フィットしてから出力
    
    try {
      const fit = fitRef.current;
      if (fit) fit.fit();
    } catch {}
    try {
      const res = await fetch('/api/pty/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols: term.cols, rows: term.rows }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      setSessionId(id);
      // 既存のSSEを閉じてから新規接続
      try { sseRef.current?.close(); } catch {}
      const es = new EventSource(`/api/pty/stream?id=${encodeURIComponent(id)}`);
      sseRef.current = es;
      es.onopen = () => { setRunning(true); };
      es.addEventListener('out', (e: MessageEvent) => {
        term.write(e.data as string);
      });
      es.addEventListener('exit', (e: MessageEvent) => {
        term.writeln(`\r\n\x1b[33m[process exited ${e.data}]\x1b[0m`);
      });
      es.addEventListener('error', async () => {
        term.writeln('\r\n\x1b[31m[connection error]\x1b[0m');
        try {
          const r = await fetch(`/api/pty/status?id=${encodeURIComponent(id)}`);
          if (!r.ok) {
            term.writeln(`\r\nstatus: ${r.status} ${r.statusText}`);
            // 日本語メモ: 代表的な失敗理由をヒント表示
            if (r.status === 403) {
              term.writeln('\r\n\x1b[33mHint: PTYが無効です。web/.env.local に SOLOHACK_PTY_ENABLED=true を設定してサーバーを再起動してください。\x1b[0m');
            } else if (r.status === 404) {
              term.writeln('\r\n\x1b[33mHint: セッションが見つかりません。サーバーの再起動/ホットリロードでセッションが失われた可能性があります。Startを押して再接続してください。\x1b[0m');
            }
          }
        } catch {}
        setRunning(false);
      });
      term.focus();
      // 既存の onData をクリア（多重ハンドラで二重入力になるのを防止）
      try { dataListenerRef.current?.dispose(); } catch {}
      dataListenerRef.current = term.onData(async (d: string) => {
        // NOTE: 状態の非同期更新に依存せず、確定した id を使用
        try {
          await fetch('/api/pty/input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, data: d }),
          });
        } catch {}
      });
      setRunning(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'failed to start';
      setError(message);
      term.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
    }
  }

  async function stop() {
    try {
      const id = sessionId;
      setSessionId('');
      sseRef.current?.close();
      sseRef.current = null;
      try { dataListenerRef.current?.dispose(); } catch {}
      dataListenerRef.current = null;
      if (id) await fetch('/api/pty/kill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    } catch {}
    setRunning(false);
  }

  function clear() {
    const term = termRef.current;
    try { term?.clear(); } catch {}
  }
  return (
    <div className="hud-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-neon">Terminal (interactive)</div>
          <div className="text-xs text-white/60">Chromium 推奨。開発時は既定で有効。本番は SOLOHACK_PTY_ENABLED=true が必要。</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={running ? stop : start}
            className="px-3 py-1.5 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-sm"
          >{running ? 'Stop' : 'Start'}</button>
          <button
            onClick={clear}
            className="px-3 py-1.5 border border-neon border-opacity-20 rounded-md text-white/80 hover:bg-neon hover:bg-opacity-10 text-sm"
          >Clear</button>
          <select
            value={scheme}
            onChange={(e) => setScheme(e.target.value as TerminalScheme)}
            className="bg-bg border border-neon border-opacity-30 rounded-md text-xs px-2 py-1 text-white/80"
            title="Color Theme"
          >
            <option value="neon">Neon</option>
            <option value="vscode-dark">VSCode Dark</option>
            <option value="one-dark">One Dark</option>
            <option value="monokai">Monokai</option>
            <option value="solarized-dark">Solarized Dark</option>
          </select>
        </div>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="bg-bg border border-neon border-opacity-20 rounded-md p-1 min-h-[240px] max-h-[50vh] overflow-hidden">
        <div ref={containerRef} className="h-[50vh]" />
      </div>
    </div>
  );
}
