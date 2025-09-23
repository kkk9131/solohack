"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  // 日本語メモ: タイプライター + SSE ペーサ + 効果音（ENVを初期値に、/commandで更新）
  const envDefaults = useMemo(() => ({
    fallbackDelay: Number(process.env.NEXT_PUBLIC_SOLOHACK_STREAM_DELAY_MS) || 60,
    ssePace: Number(process.env.NEXT_PUBLIC_SOLOHACK_SSE_PACE_MS) || 0,
    soundEnabled: String(process.env.NEXT_PUBLIC_SOLOHACK_SOUND_ENABLED).toLowerCase() === 'true',
    soundFreq: Number(process.env.NEXT_PUBLIC_SOLOHACK_SOUND_FREQ) || 1200,
    soundVolume: Number(process.env.NEXT_PUBLIC_SOLOHACK_SOUND_VOLUME) || 0.05,
    soundEndVolume: Number(process.env.NEXT_PUBLIC_SOLOHACK_SOUND_END_VOLUME) || 0.01,
    soundDuration: Number(process.env.NEXT_PUBLIC_SOLOHACK_SOUND_DURATION_MS) || 20,
    soundStep: Number(process.env.NEXT_PUBLIC_SOLOHACK_SOUND_STEP) || 2,
  }), []);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(envDefaults.soundEnabled);
  const [ssePace, setSsePace] = useState<number>(envDefaults.ssePace);
  const [fallbackDelay, setFallbackDelay] = useState<number>(envDefaults.fallbackDelay);
  // 日本語メモ: SSR環境では localStorage が無いので初期化はマウント後に実施
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const s = window.localStorage.getItem('slh_sound_enabled');
        if (s != null) setSoundEnabled(s === 'true');
        const sp = window.localStorage.getItem('slh_speed_ms');
        if (sp != null) setSsePace(Number(sp) || 0);
        const fd = window.localStorage.getItem('slh_fallback_delay_ms');
        if (fd != null) setFallbackDelay(Number(fd) || envDefaults.fallbackDelay);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem('slh_sound_enabled', String(soundEnabled)); } catch {}
  }, [soundEnabled]);
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('slh_speed_ms', String(ssePace));
        window.localStorage.setItem('slh_fallback_delay_ms', String(fallbackDelay));
      }
    } catch {}
  }, [ssePace, fallbackDelay]);

  const soundFreq = envDefaults.soundFreq;
  const soundVolume = envDefaults.soundVolume;
  const soundEndVolume = envDefaults.soundEndVolume;
  const soundDuration = envDefaults.soundDuration;
  const soundStep = envDefaults.soundStep;

  const { text: typeText, start, append, finalize, cancel } = useTypewriter({
    delayMs: fallbackDelay,
    paceMs: ssePace,
    sound: { enabled: soundEnabled, freq: soundFreq, volume: soundVolume, endVolume: soundEndVolume, durationMs: soundDuration, step: soundStep },
  });
  const [input, setInput] = useState('');
  const [showCmds, setShowCmds] = useState(false);
  const [cmdIndex, setCmdIndex] = useState(0);
  const [cmdStage, setCmdStage] = useState<'root' | 'sound' | 'speed'>('root');
  const [history, setHistory] = useState<{ role: 'user' | 'ai' | 'system'; content: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [typingFallback, setTypingFallback] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const cmdRef = useRef<HTMLDivElement | null>(null);

  // 自動スクロール（新しいテキスト/履歴/フォールバックの変化時に最下部へ）
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, typeText, typingFallback, streaming]);

  useEffect(() => {
    if (!open) return;
    return () => {
      abortRef.current?.abort();
      cancel();
    };
  }, [open, cancel]);

  function parseCommand(raw: string): string | null {
    const parts = raw.trim().slice(1).split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const arg = (parts[1] || '').toLowerCase();
    const speeds: Record<string, number> = { instant: 0, fast: 40, normal: 60, slow: 100, slower: 140 };
    switch (cmd) {
      case 'help':
      case 'h':
        return 'Commands: /sound on|off, /speed <instant|fast|normal|slow|slower|ms>'; 
      case 'sound': {
        if (arg === 'on' || arg === 'off') {
          setSoundEnabled(arg === 'on');
          return `Sound: ${arg}`;
        }
        return 'Usage: /sound on|off';
      }
      case 'speed': {
        let ms = speeds[arg];
        if (ms == null) ms = Number(arg);
        if (!Number.isFinite(ms) || ms < 0) return 'Usage: /speed <instant|fast|normal|slow|slower|ms>';
        setSsePace(ms);
        setFallbackDelay(Math.max(ms, 0));
        return `Speed: ${ms} ms/char`;
      }
      default:
        return `Unknown command: /${cmd}`;
    }
  }

  type CmdItem = { label: string; cmd: string };
  const suggestions = useMemo<CmdItem[]>(() => {
    if (!showCmds) return [];
    // ルート階層
    if (input === '/' || input === '') {
      return [
        { label: 'sound — タイプ音設定', cmd: '/sound' },
        { label: 'speed — 表示速度', cmd: '/speed' },
        { label: 'help — コマンド一覧', cmd: '/help' },
      ];
    }
    // 入力から階層推定
    if (input.startsWith('/sound') || cmdStage === 'sound') {
      return [
        { label: '← back', cmd: '/back' },
        { label: 'on', cmd: '/sound on' },
        { label: 'off', cmd: '/sound off' },
      ];
    }
    if (input.startsWith('/speed') || cmdStage === 'speed') {
      return [
        { label: '← back', cmd: '/back' },
        { label: 'instant', cmd: '/speed instant' },
        { label: 'fast', cmd: '/speed fast' },
        { label: 'normal', cmd: '/speed normal' },
        { label: 'slow', cmd: '/speed slow' },
        { label: 'slower', cmd: '/speed slower' },
        { label: 'custom…', cmd: '/speed <ms>' },
      ];
    }
    // デフォルトはルート
    return [
      { label: 'sound — タイプ音設定', cmd: '/sound' },
      { label: 'speed — 表示速度', cmd: '/speed' },
      { label: 'help — コマンド一覧', cmd: '/help' },
    ];
  }, [showCmds, input, cmdStage]);

  function executeSuggestion(item: CmdItem) {
    // ルート選択時の分岐
    if (item.cmd === '/sound') { setCmdStage('sound'); setCmdIndex(0); setInput('/sound '); return; }
    if (item.cmd === '/speed') { setCmdStage('speed'); setCmdIndex(0); setInput('/speed '); return; }
    if (item.cmd === '/help') {
      const res = parseCommand('/help');
      if (res) setHistory((h) => [...h, { role: 'system', content: res }]);
      setShowCmds(false); setCmdIndex(0); setInput(''); setCmdStage('root');
      return;
    }
    if (item.cmd === '/back') {
      setCmdStage('root'); setCmdIndex(0); setInput('/');
      return;
    }
    // サブ選択の実行
    if (item.cmd.includes('<ms>')) {
      const val = prompt('表示速度(ms/文字)を入力してください', String(ssePace));
      if (!val) return; const ms = Number(val);
      if (!Number.isFinite(ms) || ms < 0) {
        setHistory((h) => [...h, { role: 'system', content: 'Usage: /speed <ms>' }]);
      } else {
        const res = parseCommand(`/speed ${ms}`);
        if (res) setHistory((h) => [...h, { role: 'system', content: res }]);
      }
    } else {
      const res = parseCommand(item.cmd);
      if (res) setHistory((h) => [...h, { role: 'system', content: res }]);
    }
    setShowCmds(false); setCmdIndex(0); setInput(''); setCmdStage('root');
  }

  async function sendMessage(message: string) {
    if (!message.trim() || streaming) return;
    if (message.trim().startsWith('/')) {
      const res = parseCommand(message.trim());
      if (res) setHistory((h) => [...h, { role: 'system', content: res }]);
      return;
    }
    // ユーザー発言を履歴追加
    setHistory((h) => [...h, { role: 'user', content: message }]);
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
              collected += obj.token;
              append(obj.token);
            }
          } catch {}
        }
      }
      await finalize();
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
          className="fixed inset-y-0 right-0 w-full max-w-md bg-hud bg-opacity-95 border-l border-neon border-opacity-20 shadow-glow p-4 z-50 overflow-y-auto"
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
                  {typeText}
                  <span className="inline-block w-2 h-4 bg-neon bg-opacity-70 align-bottom animate-typeCursor ml-0.5" />
                </div>
              )}
            </div>
            <div className="pt-1">
              <Avatar state={(streaming || typingFallback) ? 'talk' : 'idle'} size={112} />
            </div>
          </div>
          <div ref={bottomRef} />
          {/* 入力欄 */}
          <form
            className="mt-4 flex items-center gap-2 relative"
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
              onChange={(e) => {
                const v = e.target.value;
                setInput(v);
                if (v.startsWith('/')) {
                  setShowCmds(true);
                  setCmdIndex(0);
                  if (v === '/') setCmdStage('root');
                } else {
                  setShowCmds(false);
                }
              }}
              onKeyDown={(e) => {
                if (!showCmds) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setCmdIndex((i) => (i + 1) % Math.max(1, suggestions.length));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setCmdIndex((i) => (i - 1 + Math.max(1, suggestions.length)) % Math.max(1, suggestions.length));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestions.length) executeSuggestion(suggestions[Math.max(0, Math.min(cmdIndex, suggestions.length - 1))]);
                } else if (e.key === 'ArrowLeft') {
                  if (cmdStage !== 'root') { e.preventDefault(); setCmdStage('root'); setCmdIndex(0); setInput('/'); }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowCmds(false); setCmdStage('root'); setCmdIndex(0);
                }
              }}
              disabled={streaming}
            />
            <button
              type="submit"
              className="px-3 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 disabled:opacity-50"
              disabled={streaming}
            >
              Send
            </button>
            {/* Slash commands dropdown */}
            {showCmds && suggestions.length > 0 && (
              <div ref={cmdRef} className="absolute left-0 right-0 -bottom-2 translate-y-full bg-hud bg-opacity-95 border border-neon border-opacity-20 rounded-md shadow-glow z-50">
                {suggestions.map((s, idx) => (
                  <div
                    key={s.label}
                    className={`px-3 py-2 text-sm cursor-pointer ${idx === cmdIndex ? 'bg-neon bg-opacity-10' : ''}`}
                    onMouseEnter={() => setCmdIndex(idx)}
                    onMouseDown={(e) => { e.preventDefault(); executeSuggestion(s); }}
                  >
                    <span className="text-neon text-opacity-80">{s.cmd}</span>
                    <span className="ml-2 text-neon text-opacity-60">— {s.label.split('—')[1]?.trim() || s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
