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
  const fallbackDelay = Number(process.env.NEXT_PUBLIC_SOLOHACK_STREAM_DELAY_MS) || 60;
  const { text: fallbackText, start, cancel } = useTypewriter({ delayMs: fallbackDelay });
  const [text, setText] = useState(''); // ストリーム中のAIテキスト
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [typingFallback, setTypingFallback] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const ssePace = Number(process.env.NEXT_PUBLIC_SOLOHACK_SSE_PACE_MS) || 0; // ms/char, 0=即時

  useEffect(() => {
    if (!open) return;
    return () => {
      abortRef.current?.abort();
      cancel();
    };
  }, [open, cancel]);

  async function sendMessage(message: string) {
    if (!message.trim() || streaming) return;
    // ユーザー発言を履歴追加
    setHistory((h) => [...h, { role: 'user', content: message }]);
    setText('');
    setStreaming(true);
    onStreamingChange?.(true);
    let useFallback = false;
    let collected = '';
    try {
      const ac = new AbortController();
      abortRef.current = ac;
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: message }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error('SSE not available');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      // ペーサ: SSEトークンを文字単位で一定間隔表示
      let runnerActive = false;
      let queue = '';
      const runPacer = async () => {
        if (runnerActive) return; // 既に動作中
        runnerActive = true;
        while (queue.length) {
          const ch = queue[0];
          queue = queue.slice(1);
          collected += ch;
          setText(collected);
          if (ssePace > 0) await new Promise((r) => setTimeout(r, ssePace));
        }
        runnerActive = false;
      };
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
            if (obj.token) {
              if (ssePace > 0) {
                queue += obj.token;
                // 非同期に処理（awaitしない）
                void runPacer();
              } else {
                collected += obj.token;
                setText(collected);
              }
            }
          } catch {}
        }
      }
      // 残りのキューをフラッシュ
      if (ssePace > 0) {
        // ランナーが止まるまで待機
        await new Promise<void>((resolve) => {
          const tick = () => {
            if (runnerActive || queue.length) setTimeout(tick, 16);
            else resolve();
          };
          tick();
        });
      }
    } catch {
      useFallback = true;
    } finally {
      setStreaming(false);
      onStreamingChange?.(false);
      abortRef.current = null;
      if (useFallback) {
        const fallbackMessage = "Sorry, streaming is unavailable. Here's a fallback response.";
        setTypingFallback(true);
        onStreamingChange?.(true);
        try {
          await start(fallbackMessage);
        } finally {
          setTypingFallback(false);
          onStreamingChange?.(false);
          setHistory((h) => [...h, { role: 'ai', content: fallbackMessage }]);
        }
      } else {
        setHistory((h) => [...h, { role: 'ai', content: collected }]);
      }
      setText('');
    }
  }

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
            <div className="min-h-[10rem] whitespace-pre-wrap text-sm space-y-3">
              {history.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-neon text-opacity-80' : ''}>
                  <span className={m.role === 'user' ? 'text-neon' : 'text-neon text-opacity-70'}>
                    {m.role === 'user' ? 'YOU>' : 'AI>'}
                  </span>{' '}
                  {m.content}
                </div>
              ))}
              {(streaming || typingFallback) && (
                <div>
                  <span className="text-neon text-opacity-70">AI&gt;</span>{' '}
                  {streaming ? text : fallbackText}
                  <span className="inline-block w-2 h-4 bg-neon bg-opacity-70 align-bottom animate-typeCursor ml-0.5" />
                </div>
              )}
            </div>
            <div className="pt-1">
              <Avatar state={(streaming || typingFallback) ? 'talk' : 'idle'} size={112} />
            </div>
          </div>
          {/* 入力欄 */}
          <form
            className="mt-4 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const msg = input.trim();
              if (!msg) return;
              setInput('');
              sendMessage(msg);
            }}
          >
            <input
              type="text"
              className="flex-1 bg-bg text-white/90 placeholder:text-white/40 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40"
              placeholder="Type a message and press Enter"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming}
            />
            <button
              type="submit"
              className="px-3 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 disabled:opacity-50"
              disabled={streaming}
            >
              Send
            </button>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
