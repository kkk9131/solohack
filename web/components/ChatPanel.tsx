"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import useTypewriter from '@/lib/useTypewriter';
import Avatar from '@/components/Avatar';

export default function ChatPanel({
  open,
  onClose,
  onStreamingChange,
}: {
  open: boolean;
  onClose: () => void;
  onStreamingChange?: (streaming: boolean) => void;
}) {
  // 日本語メモ: SSEが使えない場合のフォールバックとしてタイプライターを保持。
  const { text: fallbackText, start, cancel } = useTypewriter({ delayMs: 40 });
  const [text, setText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (!open) return;
    let useFallback = false;
    const run = async () => {
      try {
        setText('');
        setStreaming(true);
        onStreamingChange?.(true);
        const ac = new AbortController();
        abortRef.current = ac;
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: '短く自己紹介をしてください。' }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error('SSE not available');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split('\n\n');
          buf = events.pop() ?? '';
          for (const ev of events) {
            const line = ev.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            const payload = line.slice(6);
            if (payload === '[DONE]') {
              reader.cancel();
              break;
            }
            try {
              const obj = JSON.parse(payload) as { token?: string };
              if (obj.token) setText((t) => t + obj.token);
            } catch {}
          }
        }
      } catch (e) {
        useFallback = true;
      } finally {
        setStreaming(false);
        onStreamingChange?.(false);
        abortRef.current = null;
        if (useFallback) {
          // フォールバック：固定文をタイプライターで表示
          start("Hello, I'm your AI partner. Let's hack it! ");
        }
      }
    };
    run();
    return () => {
      abortRef.current?.abort();
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          className="fixed inset-y-0 right-0 w-full max-w-md bg-hud bg-opacity-95 border-l border-neon border-opacity-20 shadow-glow p-4 z-50"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-pixel pixel-title text-neon text-base">AI Chat</h3>
            <button onClick={onClose} className="px-3 py-1 text-sm border border-neon border-opacity-40 rounded-md hover:bg-neon hover:bg-opacity-10">
              Close
            </button>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
            <div className="min-h-[10rem] whitespace-pre-wrap text-sm">
              {text || fallbackText}
              <span className="inline-block w-2 h-4 bg-neon bg-opacity-70 align-bottom animate-typeCursor ml-0.5" />
            </div>
            <div className="pt-1">
              <Avatar state={streaming ? 'talk' : 'idle'} size={80} />
            </div>
          </div>
          <div className="text-neon text-opacity-60 text-xs mt-4">Streaming mock. SSE統合で置換予定。</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
