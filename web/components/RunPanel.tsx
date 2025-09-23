"use client";
import { useRef, useState } from 'react';

export default function RunPanel() {
  const [logs, setLogs] = useState<string>("Ready. Click a command to run.\n");
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  function append(line: string) {
    setLogs((l) => l + line + "\n");
  }

  function mockRun(kind: 'test' | 'typecheck' | 'build') {
    if (running) return;
    setRunning(true);
    setLogs("");
    append(`> ${kind.toUpperCase()} started...`);
    let t = 0;
    const lines: string[] =
      kind === 'test'
        ? [
            'vitest v1.6.0 running...',
            '✓ core/taskManager — add/remove/update',
            '✓ core/timer — tick/pause/resume',
            '✓ chat — command palette parsing',
            'All tests passed',
          ]
        : kind === 'typecheck'
        ? ['tsc — noEmit', '0 errors, 0 warnings']
        : ['next build — analyzing...', 'Optimizing chunks...', 'Compiling...', 'Build successful'];
    timerRef.current = window.setInterval(() => {
      if (t < lines.length) {
        append(lines[t]);
        t++;
      } else {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        append('> done.');
        setRunning(false);
      }
    }, 400);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 pb-2 border-b border-neon/20">
        <button
          onClick={() => mockRun('test')}
          disabled={running}
          className="px-3 py-1.5 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon/10 disabled:opacity-50"
        >
          Run Tests
        </button>
        <button
          onClick={() => mockRun('typecheck')}
          disabled={running}
          className="px-3 py-1.5 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon/10 disabled:opacity-50"
        >
          Type Check
        </button>
        <button
          onClick={() => mockRun('build')}
          disabled={running}
          className="px-3 py-1.5 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon/10 disabled:opacity-50"
        >
          Build
        </button>
      </div>
      <pre className="flex-1 mt-2 bg-bg/60 rounded-md border border-neon/20 p-3 text-xs overflow-auto whitespace-pre-wrap">
        {logs}
      </pre>
    </div>
  );
}

