"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function HUDProgress({ value = 0 }: { value?: number }) {
  // NOTE: 簡易HUD進捗。100%到達時に一度だけ祝福の発光バーストを表示。
  const clamped = Math.max(0, Math.min(100, value));
  const prev = useRef(clamped);
  const [burst, setBurst] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    // 日本語メモ: 直前<100 → 現在100 で一度だけ発火（prevを先に更新して多重発火を回避）
    if (prev.current < 100 && clamped === 100) {
      prev.current = 100;
      setBurst(true);
      setBurstKey((k) => k + 1);
      const t = setTimeout(() => setBurst(false), 1600);
      return () => clearTimeout(t);
    }
    prev.current = clamped;
  }, [clamped]);

  // コンフェッティ生成（burstKeyでリシード）
  const confetti = useMemo(() => {
    const COLORS = ['#00d8ff', '#8ef7ff', '#a78bfa', '#f472b6', '#34d399', '#fde68a'];
    const pieces = 90;
    const rnd = (min: number, max: number) => min + Math.random() * (max - min);
    return Array.from({ length: pieces }).map((_, i) => {
      const angle = rnd(-60, 60); // 横方向の拡散
      const dist = rnd(80, 180);
      const x = Math.cos((angle * Math.PI) / 180) * dist;
      const y = Math.sin((angle * Math.PI) / 180) * dist + rnd(80, 160);
      const rot = rnd(180, 720);
      const size = rnd(6, 12);
      const color = COLORS[i % COLORS.length];
      const delay = rnd(0, 0.15);
      return { id: i, x, y, rot, size, color, delay };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstKey]);

  return (
    <div className="space-y-2 relative">
      <div className="flex items-center justify-between text-xs text-neon text-opacity-70">
        <span>Progress</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded relative overflow-hidden">
        {/* ベースバー */}
        <div className="h-2 bg-neon rounded shadow-glow" style={{ width: `${clamped}%`, transition: 'width .3s ease' }} />

        {/* シマー（達成時にバーを横切るハイライト） */}
        <AnimatePresence>
          {burst && (
            <motion.div
              key={`shimmer-${burstKey}`}
              className="absolute top-0 bottom-0 left-[-40%] w-[40%] pointer-events-none"
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: '200%', opacity: 0.9 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              style={{
                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.85) 50%, rgba(255,255,255,0) 100%)',
                filter: 'blur(1px)',
                mixBlendMode: 'screen',
              }}
            />
          )}
        </AnimatePresence>

        {/* バー内の演出はここまで */}
      </div>

      {/* 100%達成時のフルスクリーン祝福（ネオンフラッシュ + コンフェッティ） */}
      <AnimatePresence>
        {burst && (
          <>
            {/* フルスクリーン・ネオンフラッシュ */}
            <motion.div
              key={`flash-screen-${burstKey}`}
              className="fixed inset-0 pointer-events-none z-[60]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.35 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              style={{ background: 'radial-gradient(160% 160% at 50% 45%, var(--glow) 0%, rgba(0,0,0,0) 60%)', mixBlendMode: 'screen' }}
            />

            {/* フルスクリーン・コンフェッティ */}
            <div className="fixed inset-0 pointer-events-none z-[61] overflow-visible" aria-hidden>
              <div className="relative w-full h-full">
                {confetti.map((p) => (
                  <motion.span
                    key={`cf-${burstKey}-${p.id}`}
                    className="absolute rounded-sm"
                    style={{
                      left: '50%',
                      top: '16%',
                      width: p.size,
                      height: p.size * 0.6,
                      background: p.color,
                      boxShadow: '0 0 6px rgba(255,255,255,.25)',
                      mixBlendMode: 'screen',
                    }}
                    initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
                    animate={{ x: p.x, y: p.y + 120, rotate: p.rot, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.4 + p.delay, ease: 'easeOut', delay: p.delay }}
                  />
                ))}
              </div>
            </div>

            {/* CONGRATULATIONS テキスト */}
            <div className="fixed inset-0 z-[62] pointer-events-none flex items-center justify-center">
              <motion.div
                key={`congrats-${burstKey}`}
                initial={{ opacity: 0, scale: 0.85, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="text-center"
              >
                <div className="font-pixel pixel-title text-neon drop-shadow text-2xl sm:text-3xl md:text-5xl tracking-widest">
                  CONGRATULATIONS!
                </div>
                <div className="mt-2 text-neon text-opacity-80 text-xs sm:text-sm md:text-base">
                  All tasks completed
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
