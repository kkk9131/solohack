"use client";
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  // 日本語メモ: Enter キーでダッシュボードへ遷移。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') router.push('/dashboard');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <main className="grid place-items-center min-h-dvh p-6 md:p-10">
      {/* ウィンドウ風コンテナ */}
      <div className="w-full max-w-5xl bg-hud bg-opacity-80 border border-neon border-opacity-20 rounded-md overflow-hidden">
        {/* タイトルバー */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neon border-opacity-20">
          <div className="text-neon text-opacity-80 text-sm">Welcome to Solo Hack</div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500/80" />
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-400/80" />
            <span className="inline-block w-3 h-3 rounded-full bg-green-400/80" />
          </div>
        </div>
        {/* 本文（単一ペイン） */}
        <div className="p-8 md:p-12 flex flex-col items-center justify-center gap-6 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-pixel pixel-title text-neon text-[56px] md:text-[76px] leading-none tracking-[0.25em]"
            >
              SOLO
              <br />
              HACK
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-neon text-opacity-70 text-sm"
            >
              Press Enter to continue
            </motion.div>
            <div className="pt-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 transition"
              >
                Continue
              </button>
            </div>
        </div>
      </div>
    </main>
  );
}
