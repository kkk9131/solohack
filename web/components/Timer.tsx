"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type TimerState = {
  duration: number; // seconds
  remain: number; // seconds
  running: boolean;
};

const STORAGE_KEY = 'slh_timer_state_v1';

export default function Timer({
  minutes = 25,
  onFinish,
}: {
  minutes?: number;
  onFinish?: () => void;
}) {
  // 初期値は props または保存値から復元
  const initialDuration = minutes * 60;
  const [state, setState] = useState<TimerState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const obj = JSON.parse(saved) as TimerState;
        if (
          typeof obj?.duration === 'number' &&
          typeof obj?.remain === 'number' &&
          typeof obj?.running === 'boolean'
        ) {
          return obj;
        }
      }
    } catch {}
    return { duration: initialDuration, remain: initialDuration, running: false };
  });

  const intervalRef = useRef<number | null>(null);

  // 永続化
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const startWith = useCallback((sec: number) => {
    setState({ duration: sec, remain: sec, running: true });
  }, []);

  const pause = useCallback(() => {
    setState((s) => ({ ...s, running: false }));
  }, []);

  const resume = useCallback(() => {
    setState((s) => (s.remain > 0 ? { ...s, running: true } : s));
  }, []);

  const reset = useCallback(() => {
    setState((s) => ({ ...s, remain: s.duration, running: false }));
  }, []);

  // タイマー駆動
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!state.running) return;
    intervalRef.current = window.setInterval(() => {
      setState((s) => {
        if (!s.running) return s;
        if (s.remain <= 1) {
          // 完了
          queueMicrotask(() => onFinish?.());
          return { ...s, remain: 0, running: false };
        }
        return { ...s, remain: s.remain - 1 };
      });
    }, 1000) as unknown as number;
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.running, onFinish]);

  // 進捗・表示
  const mmss = useMemo(() => {
    const mm = Math.floor(state.remain / 60)
      .toString()
      .padStart(2, '0');
    const ss = (state.remain % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }, [state.remain]);

  const ratio = state.duration === 0 ? 1 : 1 - state.remain / state.duration;
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));

  return (
    <div className="space-y-4">
      {/* プリセット */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10"
          onClick={() => startWith(25 * 60)}
        >
          25m
        </button>
        <button
          className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10"
          onClick={() => startWith(50 * 60)}
        >
          50m
        </button>
        <button
          className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10"
          onClick={() => startWith(5 * 60)}
        >
          5m
        </button>
      </div>

      {/* 時間表示 */}
      <div className="text-6xl font-bold tracking-wider text-neon drop-shadow" aria-live="polite">
        {mmss}
      </div>

      {/* 進捗バー */}
      <div className="h-2 bg-white/5 rounded">
        <div className="h-2 bg-neon rounded shadow-glow" style={{ width: `${percent}%`, transition: 'width 0.3s ease' }} />
      </div>
      <div className="text-right text-neon text-opacity-70 text-xs">{percent}%</div>

      {/* コントロール */}
      <div className="flex items-center gap-2 text-sm">
        {state.running ? (
          <button
            className="px-3 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10"
            onClick={pause}
          >
            Pause
          </button>
        ) : (
          <button
            className="px-3 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10"
            onClick={resume}
            disabled={state.remain <= 0}
          >
            Resume
          </button>
        )}
        <button
          className="px-3 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10"
          onClick={reset}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
