"use client";
import { useCallback, useRef, useState } from 'react';
type SoundOptions = {
  enabled?: boolean;
  freq?: number; // Hz
  volume?: number; // 0..1
  endVolume?: number; // 0..1
  durationMs?: number; // ms
  step?: number; // 何文字に1回鳴らすか（1で毎文字）
  skipSpaces?: boolean; // 空白・改行では鳴らさない
};

export default function useTypewriter({
  delayMs = 40, // 非SSEで start(full) するときの速度
  paceMs = 0, // SSEで append(token) するときの速度（0は即時）
  sound,
}: {
  delayMs?: number;
  paceMs?: number;
  sound?: SoundOptions;
} = {}) {
  const [text, setText] = useState('');
  const runIdRef = useRef(0);

  // SSE向けのキューとランナー
  const queueRef = useRef('');
  const runnerActiveRef = useRef(false);

  // サウンド
  const audioRef = useRef<AudioContext | null>(null);
  const tickCountRef = useRef(0);
  const soundOpt: Required<SoundOptions> = {
    enabled: !!sound?.enabled,
    freq: sound?.freq ?? 1200,
    volume: sound?.volume ?? 0.05,
    endVolume: sound?.endVolume ?? 0.01,
    durationMs: sound?.durationMs ?? 20,
    step: Math.max(1, sound?.step ?? 2),
    skipSpaces: sound?.skipSpaces ?? true,
  };

  const playTick = useCallback(() => {
    if (!soundOpt.enabled) return;
    try {
      // 初回にAudioContextを作成
      if (!audioRef.current) {
        const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return; // 未対応環境
        audioRef.current = new AC();
      }
      const ac = audioRef.current!;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = 'square';
      const now = ac.currentTime;
      osc.frequency.setValueAtTime(soundOpt.freq, now);
      gain.gain.setValueAtTime(soundOpt.volume, now);
      const durSec = soundOpt.durationMs / 1000;
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, soundOpt.endVolume), now + durSec);
      osc.start(now);
      osc.stop(now + durSec);
    } catch {
      // 失敗は無視
    }
  }, [soundOpt.enabled, soundOpt.freq, soundOpt.volume, soundOpt.endVolume, soundOpt.durationMs]);

  const maybeTick = useCallback((ch: string) => {
    if (!soundOpt.enabled) return;
    if (soundOpt.skipSpaces && /\s/.test(ch)) return;
    tickCountRef.current += 1;
    if (tickCountRef.current % soundOpt.step !== 0) return;
    playTick();
  }, [soundOpt.enabled, soundOpt.skipSpaces, soundOpt.step, playTick]);

  // 非SSE: 一括タイプ
  const start = useCallback(
    async (full: string) => {
      const myRun = ++runIdRef.current;
      tickCountRef.current = 0;
      setText('');
      for (let i = 0; i < full.length; i++) {
        if (myRun !== runIdRef.current) return; // 中断
        const next = full.slice(0, i + 1);
        setText(next);
        maybeTick(full[i]);
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      }
    },
    [delayMs, maybeTick],
  );

  // SSE: 文字列をキューに積み、ペースに従い1文字ずつ吐き出す
  const runPacer = useCallback(async () => {
    if (runnerActiveRef.current) return;
    runnerActiveRef.current = true;
    const myRun = runIdRef.current;
    while (queueRef.current.length && myRun === runIdRef.current) {
      const ch = queueRef.current[0];
      queueRef.current = queueRef.current.slice(1);
      setText((t) => t + ch);
      maybeTick(ch);
      if (paceMs > 0) await new Promise((r) => setTimeout(r, paceMs));
    }
    runnerActiveRef.current = false;
  }, [paceMs, maybeTick]);

  const append = useCallback((chunk: string) => {
    if (!chunk) return;
    if (paceMs > 0) {
      queueRef.current += chunk;
      void runPacer();
    } else {
      setText((t) => t + chunk);
      // まとめて来たときは最後の1文字だけtick判定
      maybeTick(chunk[chunk.length - 1]);
    }
  }, [paceMs, runPacer, maybeTick]);

  const finalize = useCallback(async () => {
    if (paceMs <= 0) return;
    // ランナーが止まるまで待機
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (runnerActiveRef.current || queueRef.current.length) setTimeout(tick, 16);
        else resolve();
      };
      tick();
    });
  }, [paceMs]);

  const cancel = useCallback(() => {
    runIdRef.current += 1; // ランナー停止
    queueRef.current = '';
    runnerActiveRef.current = false;
  }, []);

  return { text, setText, start, append, finalize, cancel } as const;
}
