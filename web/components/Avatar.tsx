"use client";
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

type AvatarState = 'idle' | 'talk' | 'celebrate';

export default function Avatar({
  state,
  size = 96,
  images = { idle: '/avatars/default/idle.png', talk: '/avatars/default/talk.png' },
  fps = 6,
}: {
  state: AvatarState;
  size?: number;
  images?: { idle: string; talk: string };
  fps?: number;
}) {
  // 日本語メモ: talk 中は idle/talk 画像を交互に切替。assets は後で差し替え。
  const [frame, setFrame] = useState<'idle' | 'talk'>('idle');
  const [talkAvailable, setTalkAvailable] = useState(true);
  useEffect(() => {
    if (state !== 'talk') {
      setFrame('idle');
      return;
    }
    const ms = Math.max(60, Math.round(1000 / fps));
    const id = setInterval(() => setFrame((f) => (f === 'idle' ? 'talk' : 'idle')), ms);
    return () => clearInterval(id);
  }, [state, fps]);

  const src = useMemo(() => {
    if (frame === 'talk' && talkAvailable) return images.talk;
    return images.idle;
  }, [frame, images, talkAvailable]);

  return (
    <motion.div
      className="rounded-md border border-neon border-opacity-30 bg-hud bg-opacity-60 p-1"
      animate={state === 'celebrate' ? { scale: [1, 1.08, 1] } : undefined}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
      style={{ width: size + 8, height: size + 8 }}
      title={`Avatar: ${state}`}
    >
      {/* NOTE: 画像が未配置の場合に備えて背景グラデのプレースホルダ */}
      <div className="grid place-items-center bg-gradient-to-br from-hud to-bg" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="avatar"
          width={size}
          height={size}
          className="object-contain pixelated"
          onError={() => setTalkAvailable(false)}
        />
      </div>
    </motion.div>
  );
}
