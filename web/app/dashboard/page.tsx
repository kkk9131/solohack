"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "@/components/Avatar";
import ChatPanel from "@/components/ChatPanel";
import Timer from "@/components/Timer";
import HUDProgress from "@/components/HUDProgress";
import TasksBoard from "@/components/TasksBoard";
import DQMapMock from "@/components/DQMapMock";
import useTasksController from "@/lib/useTasksController";

export default function DashboardPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [avatarState, setAvatarState] = useState<"idle" | "talk" | "celebrate">(
    "idle",
  );
  const [flash, setFlash] = useState(false);
  const tasksCtl = useTasksController();
  const { refresh } = tasksCtl;

  // 日本語メモ: 初回マウントでタスクを読み込み、以降は各操作で都度更新する。
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <main className="min-h-dvh p-6 md:p-10 flex flex-col gap-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="font-pixel pixel-title text-neon text-2xl">Dashboard</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/editor"
            className="px-4 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 transition"
          >
            Editor
          </Link>
          <Link
            href="/explorer"
            className="px-4 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 transition"
          >
            Explorer
          </Link>
          <Link
            href="/settings"
            className="px-4 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 transition"
          >
            Settings
          </Link>
          <button
            onClick={() => setChatOpen(true)}
            className="px-4 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 transition"
          >
            Open Chat
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="hud-card p-4 space-y-4 overflow-hidden">
          <motion.h3 className="text-neon text-lg font-semibold">Tasks</motion.h3>
          <div className="max-h-[28rem] overflow-y-auto pr-2">
            <TasksBoard
              tasks={tasksCtl.tasks}
              loading={tasksCtl.loading}
              generating={tasksCtl.generating}
              add={tasksCtl.add}
              del={tasksCtl.del}
              setStatus={tasksCtl.setStatus}
              generatePlan={tasksCtl.generatePlan}
              roadmap={tasksCtl.roadmap}
            />
          </div>
        </div>

        <div className="hud-card p-4 space-y-5">
          <div className="flex items-center justify-between">
            <motion.h3 className="text-neon text-lg font-semibold">
              Pomodoro
            </motion.h3>
            <div className="flex items-center gap-3">
              <Avatar state={avatarState} size={96} />
              <div className="text-right text-neon text-xs">
                <div className="font-semibold text-sm">AI Partner</div>
                <div className="text-neon text-opacity-70">Idle/Talk/Celebrate</div>
              </div>
            </div>
          </div>

          <Timer
            minutes={25}
            onFinish={() => {
              setAvatarState("celebrate");
              setFlash(true);
              setTimeout(() => setAvatarState("idle"), 1600);
              setTimeout(() => setFlash(false), 1000);
            }}
          />

          <HUDProgress value={tasksCtl.completion} />
        </div>
      </section>

      <DQMapMock
        tasks={tasksCtl.tasks}
        loading={tasksCtl.loading}
        completion={tasksCtl.completion}
      />

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onStreamingChange={(streaming) => setAvatarState(streaming ? "talk" : "idle")}
      />

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none fixed inset-0 bg-neon"
            style={{ mixBlendMode: "screen" }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
