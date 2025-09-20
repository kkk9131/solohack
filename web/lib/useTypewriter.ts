"use client";
import { useCallback, useState } from 'react';

export default function useTypewriter({ delayMs = 40 }: { delayMs?: number } = {}) {
  const [text, setText] = useState('');

  // 日本語メモ: 単発メッセージのタイプライター。SSE統合時は appendToken を追加して逐次反映へ拡張可能。
  const start = useCallback(
    async (full: string) => {
      setText('');
      for (const ch of full) {
        setText((t) => t + ch);
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      }
    },
    [delayMs],
  );

  return { text, setText, start } as const;
}

