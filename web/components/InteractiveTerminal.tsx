"use client";
import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// 日本語メモ: WebSocket ではなく SSE + REST で双方向を実現（入力はPOST、出力はSSE）。

export default function InteractiveTerminal() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = new Terminal({
      fontSize: 13,
      convertEol: true,
      cursorBlink: true,
      theme: { background: '#000000' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;
    if (containerRef.current) term.open(containerRef.current);
    setTimeout(() => fit.fit(), 0);
    const onResize = () => {
      fit.fit();
      if (sessionId) sendResize();
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
    const term = termRef.current!;
    term.reset();
    term.writeln('\x1b[36mStarting shell...\x1b[0m');
    try {
      const res = await fetch('/api/pty/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cols: term.cols, rows: term.rows }) });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      setSessionId(id);
      const es = new EventSource(`/api/pty/stream?id=${encodeURIComponent(id)}`);
      sseRef.current = es;
      es.addEventListener('out', (e: MessageEvent) => {
        term.write(e.data as string);
      });
      es.addEventListener('exit', (e: MessageEvent) => {
        term.writeln(`\r\n\x1b[33m[process exited ${e.data}]\x1b[0m`);
      });
      es.addEventListener('error', () => {
        term.writeln('\r\n\x1b[31m[connection error]\x1b[0m');
      });
      term.focus();
      term.onData((d) => {
        if (!sessionId) return;
        // NOTE: セッション確立直後に onData が走る可能性対策で最新 id を読む
        const idNow = id;
        fetch('/api/pty/input', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: idNow, data: d }) }).catch(() => {});
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
      <div className="bg-black/80 border border-neon border-opacity-20 rounded-md p-1 min-h-[240px] max-h-[50vh] overflow-hidden">
        <div ref={containerRef} className="h-[50vh]" />
      </div>
    </div>
  );
}

