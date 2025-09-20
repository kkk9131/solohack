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
    <main className="grid place-items-center min-h-dvh p-8">
      <div className="text-center space-y-8">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-6xl md:text-7xl font-extrabold neon-text tracking-wide"
        >
          SOLO HACK
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-neon/80"
        >
          Welcome to SoloHack
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm text-neon/70"
        >
          Press Enter to continue
        </motion.div>
        <div className="pt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 border border-neon/40 rounded-md text-neon hover:bg-neon/10 transition shadow-glow"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );
}

