"use client";
import { useEffect, useMemo, useRef, useState } from 'react';

type Preset = 'build-web' | 'lint-web' | 'test-repo' | 'echo';

export default function TerminalPanel() {
  // 日本語メモ: 単純な実行ログビュー（擬似ターミナル）。SSEでサーバーのspawn出力を受け取る。
  const [running, setRunning] = useState(false);
  const [preset, setPreset] = useState<Preset>('echo');
  const [message, setMessage] = useState('Hello from SoloHack');
  const [log, setLog] = useState('');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log, running]);

  function append(text: string) {
    setLog((s) => (s ? s + text : text));
  }

  async function run() {
    if (running) return;
    setLog('');
    setExitCode(null);
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch('/api/run/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset, message }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() ?? '';
        for (const ev of events) {
          const lines = ev.split('\n');
          const eventType = lines.find((l) => l.startsWith('event: '))?.slice(7) || '';
          const dataLine = lines.find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          const payload = dataLine.slice(6);
          if (payload === '[DONE]') { reader.cancel(); break; }
          switch (eventType) {
            case 'out':
              append(payload);
              break;
            case 'err':
              append(payload);
              break;
            case 'exit':
              setExitCode(Number(payload));
              break;
            default:
              append(payload + '\n');
          }
        }
      }
    } catch (e: any) {
      append(`\n[error] ${e?.message ?? 'unknown'}`);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  const desc = useMemo(() => {
    switch (preset) {
      case 'build-web':
        return 'web/ で next build を実行（型チェック含む）';
      case 'lint-web':
        return 'web/ で next lint を実行';
      case 'test-repo':
        return 'リポジトリルートで npm test を実行';
      case 'echo':
        return 'メッセージを出力（デモ）';
    }
  }, [preset]);

  return (
    <div className="hud-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-neon">Run</div>
          <div className="text-xs text-white/60">{desc}</div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-bg border border-neon border-opacity-30 rounded-md text-sm px-2 py-1"
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
          >
            <option value="echo">Echo</option>
            <option value="build-web">Build (web)</option>
            <option value="lint-web">Lint (web)</option>
            <option value="test-repo">Test (repo)</option>
          </select>
          {preset === 'echo' && (
            <input
              className="bg-bg border border-neon border-opacity-30 rounded-md text-sm px-2 py-1 w-56"
              placeholder="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          )}
          <button
            onClick={running ? stop : run}
            className="px-3 py-1.5 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 text-sm"
          >
            {running ? 'Stop' : 'Run'}
          </button>
        </div>
      </div>
      <div className="bg-black/70 border border-neon border-opacity-20 rounded-md p-2 font-mono text-xs overflow-auto max-h-[35vh]">
        <pre className="whitespace-pre-wrap break-words">{log}</pre>
        <div ref={bottomRef} />
      </div>
      {exitCode != null && (
        <div className="text-xs text-white/60">exit code: {exitCode}</div>
      )}
    </div>
  );
}

