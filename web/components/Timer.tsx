"use client";
import { useEffect, useMemo, useState } from 'react';

export default function Timer({ minutes = 25, onFinish }: { minutes?: number; onFinish?: () => void }) {
  // 日本語メモ: 簡易カウントダウン。MVPではブラウザだけで完結。後でSupabase/Server連携へ拡張。
  const total = minutes * 60;
  const [remain, setRemain] = useState(total);

  useEffect(() => {
    setRemain(total);
    const id = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(id);
          queueMicrotask(() => onFinish?.());
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [total, onFinish]);

  const mmss = useMemo(() => {
    const mm = Math.floor(remain / 60)
      .toString()
      .padStart(2, '0');
    const ss = (remain % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }, [remain]);

  const ratio = 1 - remain / total;
  const percent = Math.round(ratio * 100);

  return (
    <div className="space-y-4">
      <div className="text-6xl font-bold tracking-wider text-neon drop-shadow" aria-live="polite">
        {mmss}
      </div>
      <div className="h-2 bg-white/5 rounded">
        <div
          className="h-2 bg-neon rounded shadow-glow"
          style={{ width: `${percent}%`, transition: 'width 0.3s ease' }}
        />
      </div>
      <div className="text-right text-neon/70 text-xs">{percent}%</div>
    </div>
  );
}

