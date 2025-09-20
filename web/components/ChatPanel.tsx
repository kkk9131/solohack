"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import useTypewriter from '@/lib/useTypewriter';

export default function ChatPanel({
  open,
  onClose,
  onStreamingChange,
}: {
  open: boolean;
  onClose: () => void;
  onStreamingChange?: (streaming: boolean) => void;
}) {
  // 日本語メモ: MVP では固定メッセージをタイプライター表示。SSE統合時に置換。
  const { text, start } = useTypewriter({ delayMs: 40 });

  useEffect(() => {
    if (!open) return;
    onStreamingChange?.(true);
    start("Hello, I'm your AI partner. Let's hack it! ").finally(() => onStreamingChange?.(false));
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
          <div className="min-h-40 whitespace-pre-wrap text-sm">
            {text}
            <span className="inline-block w-2 h-4 bg-neon bg-opacity-70 align-bottom animate-typeCursor ml-0.5" />
          </div>
          <div className="text-neon text-opacity-60 text-xs mt-4">Streaming mock. SSE統合で置換予定。</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
