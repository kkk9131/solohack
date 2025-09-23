"use client";
import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// 日本語メモ: WebSocket ではなく SSE + REST で双方向を実現（入力はPOST、出力はSSE）。

export default function InteractiveTerminal() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const dataListenerRef = useRef<{ dispose: () => void } | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // エディタ背景（--bg）とネオン色（--neon）をCSS変数から取得
    let bg = '#0b0f14';
    let neon = '#00d8ff';
    try {
      const cs = getComputedStyle(document.documentElement);
      bg = (cs.getPropertyValue('--bg').trim() || bg);
      neon = (cs.getPropertyValue('--neon').trim() || neon);
    } catch {}

    const term = new Terminal({
      fontSize: 13,
      convertEol: true,
      cursorBlink: true,
      scrollback: 10000,
      allowTransparency: false,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      drawBoldTextInBrightColors: true as any,
      theme: {
        background: bg,
        foreground: '#e5e7eb',
        cursor: neon,
        cursorAccent: bg,
        selectionBackground: 'rgba(0, 216, 255, 0.25)',
        // ANSI colors tuned for dark background visibility
        black: '#9ca3af',
        red: '#ff616e',
        green: '#a3ff00',
        yellow: '#f59e0b',
        blue: neon,
        magenta: '#ff00d8',
        cyan: '#34d399',
        white: '#e5e7eb',
        brightBlack: '#cbd5e1',
        brightWhite: '#ffffff',
      },
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
        opened = true;
        // 初回は明示リサイズせず、描画安定後にfitは start() 側で実行
      } catch {
        requestAnimationFrame(tryOpen);
      }
    };
    requestAnimationFrame(tryOpen);

    const onResize = () => {
      // セッション中のみfit（未起動時は何もしない）
      if (!sessionId) return;
      try { fit.fit(); } catch {}
      void sendResize();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      try { term.dispose(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // フィットしてから出力
    try { const fit = fitRef.current; fit && fit.fit(); } catch {}
    try {
      const res = await fetch('/api/pty/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cols: term.cols, rows: term.rows }) });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      setSessionId(id);
      // 既存のSSEを閉じてから新規接続
      try { sseRef.current?.close(); } catch {}
      const es = new EventSource(`/api/pty/stream?id=${encodeURIComponent(id)}`);
      sseRef.current = es;
      let opened = false;
      es.onopen = () => { opened = true; setRunning(true); };
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
          }
        } catch {}
        setRunning(false);
      });
      term.focus();
      // 既存の onData をクリア（多重ハンドラで二重入力になるのを防止）
      try { dataListenerRef.current?.dispose(); } catch {}
      dataListenerRef.current = term.onData((d) => {
        // NOTE: 状態の非同期更新に依存せず、確定した id を使用
        fetch('/api/pty/input', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, data: d }) }).catch(() => {});
      });
      setRunning(true);
    } catch (e: any) {
      setError(e?.message ?? 'failed to start');
      term.writeln(`\r\n\x1b[31m${e?.message ?? 'failed to start'}\x1b[0m`);
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
        </div>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="bg-bg border border-neon border-opacity-20 rounded-md p-1 min-h-[240px] max-h-[50vh] overflow-hidden">
        <div ref={containerRef} className="h-[50vh]" />
      </div>
    </div>
  );
}
