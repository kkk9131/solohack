"use client";
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '@/components/Avatar';
import ChatPanel from '@/components/ChatPanel';
import Timer from '@/components/Timer';
import HUDProgress from '@/components/HUDProgress';
import TasksBoard from '@/components/TasksBoard';
import useTasksController from '@/lib/useTasksController';

export default function DashboardPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [avatarState, setAvatarState] = useState<'idle' | 'talk' | 'celebrate'>('idle');
  const [flash, setFlash] = useState(false);
  const tasksCtl = useTasksController();

  // 初期ロード
  // 日本語メモ: 初回マウントでタスク取得。以降は操作時に refresh される。
  useEffect(() => { tasksCtl.refresh(); }, [tasksCtl.refresh]);

  return (
    <main className="min-h-dvh p-6 md:p-10 space-y-8">
      <header className="flex items-center justify-between">
        <h2 className="font-pixel pixel-title text-neon text-2xl">Dashboard</h2>
        <button
          onClick={() => setChatOpen(true)}
          className="px-4 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 transition"
        >
          Open Chat
        </button>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="hud-card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar state={avatarState} size={112} />
            <div>
              <div className="text-neon font-semibold">AI Partner</div>
              <div className="text-xs text-neon text-opacity-70">Idle/Talk/Celebrate</div>
            </div>
          </div>
          <HUDProgress value={tasksCtl.completion} />
        </div>

        <div className="hud-card p-4 space-y-4 lg:col-span-2">
          <motion.h3 className="text-neon">Timer</motion.h3>
          <Timer
            minutes={25}
            onFinish={() => {
              setAvatarState('celebrate');
              setFlash(true);
              setTimeout(() => setAvatarState('idle'), 1600);
              setTimeout(() => setFlash(false), 1000);
            }}
          />
        </div>
      </section>

      <section className="hud-card p-4">
        <motion.h3 className="text-neon mb-4">Tasks</motion.h3>
        <TasksBoard
          tasks={tasksCtl.tasks}
          loading={tasksCtl.loading}
          analyzing={tasksCtl.analyzing}
          add={tasksCtl.add}
          del={tasksCtl.del}
          setStatus={tasksCtl.setStatus}
          analyzeDeps={tasksCtl.analyzeDeps}
        />
      </section>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onStreamingChange={(streaming) => setAvatarState(streaming ? 'talk' : 'idle')}
      />

      {/* 祝福フラッシュ演出（簡易） */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none fixed inset-0 bg-neon"
            style={{ mixBlendMode: 'screen' }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
