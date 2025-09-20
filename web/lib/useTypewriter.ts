"use client";
import { useCallback, useRef, useState } from 'react';

export default function useTypewriter({ delayMs = 40 }: { delayMs?: number } = {}) {
  const [text, setText] = useState('');
  const runIdRef = useRef(0);

  // 日本語メモ: 単発メッセージのタイプライター。
  // - 逐次追加ではなく slice(0, i) で決定論的に更新（並行実行でも破綻しにくい）
  // - runId で並行実行を打ち切り、StrictMode の二重実行でも2本目のみが有効になる。
  const start = useCallback(
    async (full: string) => {
      const myRun = ++runIdRef.current;
      setText('');
      for (let i = 1; i <= full.length; i++) {
        if (myRun !== runIdRef.current) return; // 中断
        setText(full.slice(0, i));
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      }
    },
    [delayMs],
  );

  const cancel = useCallback(() => {
    runIdRef.current++;
  }, []);

  return { text, setText, start, cancel } as const;
}
