"use client";
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function HUDProgress({ value = 0 }: { value?: number }) {
  // NOTE: 簡易HUD進捗。100%到達時に一度だけ祝福の発光バーストを表示。
  const clamped = Math.max(0, Math.min(100, value));
  const prev = useRef(clamped);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    // 日本語メモ: 直前が100未満で現在が100ならバースト演出を1秒表示
    if (prev.current < 100 && clamped === 100) {
      setBurst(true);
      const t = setTimeout(() => setBurst(false), 1000);
      return () => clearTimeout(t);
    }
    prev.current = clamped;
  }, [clamped]);

  return (
    <div className="space-y-2 relative">
      <div className="flex items-center justify-between text-xs text-neon text-opacity-70">
        <span>Progress</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded relative overflow-hidden">
        <div className="h-2 bg-neon rounded shadow-glow" style={{ width: `${clamped}%`, transition: 'width .3s ease' }} />
        {/* 100%達成時のワンショット発光 */}
        <AnimatePresence>
          {burst && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{ background: 'radial-gradient(120% 120% at 50% 50%, var(--glow) 0%, rgba(0,0,0,0) 60%)', mixBlendMode: 'screen' }}
            />)
          }
        </AnimatePresence>
      </div>
    </div>
  );
}
