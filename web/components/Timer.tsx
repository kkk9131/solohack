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
  const [presets, setPresets] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem('slh_timer_presets_v1');
      if (raw) {
        const arr = JSON.parse(raw) as number[];
        if (Array.isArray(arr) && arr.every((n) => typeof n === 'number' && n > 0)) {
          return Array.from(new Set(arr.map((n) => Math.round(n))));
        }
      }
    } catch {}
    return [25, 50, 5];
  });
  const [customStart, setCustomStart] = useState('');
  const [newPreset, setNewPreset] = useState('');

  // 永続化
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem('slh_timer_presets_v1', JSON.stringify(presets));
    } catch {}
  }, [presets]);

  const startWith = useCallback((sec: number) => {
    setState({ duration: sec, remain: sec, running: true });
  }, []);

  const pause = useCallback(() => {
    setState((s) => ({ ...s, running: false }));
  }, []);

  const resume = useCallback(() => {
    setState((s) => (s.remain > 0 ? { ...s, running: true } : s));
  }, []);

  function parseToSeconds(input: string): number | null {
    const v = input.trim();
    if (!v) return null;
    // mm:ss 形式
    if (/^\d{1,3}:\d{2}$/.test(v)) {
      const [mm, ss] = v.split(':').map((n) => Number(n));
      if (Number.isFinite(mm) && Number.isFinite(ss)) return mm * 60 + ss;
      return null;
    }
    // 分（数字 or 末尾に m / min / 分）
    const mMatch = v.match(/^(\d{1,4})(?:\s*(m|min|分))?$/i);
    const m = mMatch ? Number(mMatch[1]) : Number.NaN;
    if (Number.isFinite(m) && m > 0) return Math.round(m) * 60;
    return null;
  }

  const removePreset = useCallback((target: number) => {
    setPresets((p) => p.filter((x) => x !== target));
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
          try { playCelebrateSE(); } catch {}
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

  // 簡易祝福SE（短い上昇メロディ）
  function playCelebrateSE() {
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const notes = [880, 1047, 1319];
    const now = ac.currentTime;
    notes.forEach((f, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'triangle';
      const t0 = now + i * 0.12; const dur = 0.18;
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.08, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.start(t0); osc.stop(t0 + dur + 0.01);
    });
    setTimeout(() => ac.close().catch(() => {}), 800);
  }

  return (
    <div className="space-y-4">
      {/* プリセット */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {presets.map((m) => (
          <span key={m} className="inline-flex items-center">
            <button
              className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10"
              onClick={() => startWith(m * 60)}
              title={`${m} minutes`}
              type="button"
            >
              {m}m
            </button>
            <button
              type="button"
              aria-label={`remove ${m}m`}
              className="ml-1 px-1 pb-0.5 border border-neon border-opacity-20 rounded text-neon hover:bg-neon hover:bg-opacity-10"
              onClick={() => removePreset(m)}
              title="remove"
            >
              ×
            </button>
          </span>
        ))}
        {/* 追加 */}
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const sec = parseToSeconds(newPreset);
            if (sec && sec > 0) {
              const m = Math.round(sec / 60);
              setPresets((p) => Array.from(new Set([...p, m])).sort((a, b) => a - b));
              setNewPreset('');
            }
          }}
        >
          <input
            value={newPreset}
            onChange={(e) => setNewPreset(e.target.value)}
            placeholder="Add m or mm:ss"
            className="w-28 px-2 py-1 bg-bg text-white/80 border border-neon border-opacity-30 rounded-md placeholder:text-white/30 focus:outline-none"
          />
          <button className="px-2 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10" type="submit">
            Add
          </button>
        </form>
      </div>

      {/* 円形リング + 時間表示 */}
      <div className="flex items-center gap-4">
        <svg width="76" height="76" viewBox="0 0 44 44" className="drop-shadow">
          <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
          <circle
            cx="22"
            cy="22"
            r="20"
            fill="none"
            stroke="var(--neon)"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: '22px 22px',
              strokeDasharray: `${2 * Math.PI * 20}`,
              strokeDashoffset: `${(1 - ratio) * 2 * Math.PI * 20}`,
              transition: 'stroke-dashoffset .3s ease',
              filter: 'drop-shadow(0 0 8px var(--glow))',
            }}
          />
        </svg>
        <div className="text-5xl md:text-6xl font-bold tracking-wider text-neon drop-shadow" aria-live="polite">
          {mmss}
        </div>
      </div>

      {/* 水平進捗バーは削除（リング表示に統一） */}
      <div className="text-right text-neon text-opacity-70 text-xs">{percent}%</div>

      {/* コントロール */}
      <div className="flex items-center gap-2 text-sm">
        {/* 手動開始 */}
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const sec = parseToSeconds(customStart);
            if (sec && sec > 0) {
              startWith(sec);
              setCustomStart('');
            }
          }}
        >
          <input
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            placeholder="Start m or mm:ss"
            className="w-36 px-2 py-1 bg-bg text-white/80 border border-neon border-opacity-30 rounded-md placeholder:text-white/30 focus:outline-none"
          />
          <button className="px-3 py-1 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10" type="submit">
            Start
          </button>
        </form>

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
