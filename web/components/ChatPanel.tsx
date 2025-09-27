"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import useTypewriter from '@/lib/useTypewriter';
import Avatar from '@/components/Avatar';
import { getSettings } from '@/lib/settings';

type Mode = 'chat' | 'requirements';
type HistoryEntry = { role: 'user' | 'ai' | 'system'; content: string };
type HistoriesState = Record<Mode, HistoryEntry[]>;

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

  const { text: typeText, setText, start, append, finalize, cancel } = useTypewriter({
    delayMs: fallbackDelay,
    paceMs: ssePace,
    sound: { enabled: soundEnabled, freq: soundFreq, volume: soundVolume, endVolume: soundEndVolume, durationMs: soundDuration, step: soundStep },
  });
  const [input, setInput] = useState('');
  const [showCmds, setShowCmds] = useState(false);
  const [cmdIndex, setCmdIndex] = useState(0);
  const [cmdStage, setCmdStage] = useState<'root' | 'sound' | 'speed'>('root');
  const [mode, setMode] = useState<Mode>('chat');
  const [histories, setHistories] = useState<HistoriesState>({ chat: [], requirements: [] });
  const history = histories[mode];
  const [requirementDraft, setRequirementDraft] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveFeedback, setSaveFeedback] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const [typingFallback, setTypingFallback] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const cmdRef = useRef<HTMLDivElement | null>(null);
  const [noStreamPref, setNoStreamPref] = useState<boolean>(false);

  function updateHistory(target: Mode, updater: (prev: HistoryEntry[]) => HistoryEntry[]) {
    setHistories((prev) => {
      const next: HistoriesState = { ...prev, [target]: updater(prev[target]) };
      return next;
    });
  }

  function pushHistory(entry: HistoryEntry, target: Mode = mode) {
    updateHistory(target, (prev) => [...prev, entry]);
  }

  function clearHistory(target: Mode = mode) {
    updateHistory(target, () => []);
  }

  const requirementsHistory = histories.requirements;
  const inputPlaceholder = mode === 'requirements'
    ? '要件を入力して Enter (AI がブラッシュアップを支援)'
    : 'Type a message and press Enter';
  const lastAiMessage = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].role === 'ai') {
        return history[i].content;
      }
    }
    return '';
  }, [history]);
  const canFinalize = requirementDraft.trim().length > 0 && requirementsHistory.length > 0;
  const isSavingRequirements = saveStatus === 'saving';

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

  // 日本語メモ: パネルを閉じたら次回のために履歴をクリア
  useEffect(() => {
    if (!open) {
      setHistories({ chat: [], requirements: [] });
      setRequirementDraft('');
      setSaveStatus('idle');
      setSaveFeedback('');
    }
  }, [open]);

  useEffect(() => {
    setShowCmds(false);
    setCmdStage('root');
    setCmdIndex(0);
    setInput('');
  }, [mode]);

  // 日本語メモ: 要件モードに切り替えたとき、下書きが空であれば直近のAI応答で初期化。
  useEffect(() => {
    if (mode !== 'requirements') return;
    if (!requirementDraft.trim()) {
      for (let i = requirementsHistory.length - 1; i >= 0; i -= 1) {
        const item = requirementsHistory[i];
        if (item.role === 'ai') {
          setRequirementDraft(item.content);
          break;
        }
      }
    }
    setSaveStatus('idle');
    setSaveFeedback('');
  }, [mode, requirementsHistory, requirementDraft]);

  // 日本語メモ: 設定（AI名/口調、ストリーム既定、遅延ms）を読込み、チャットの初期値に反映
  useEffect(() => {
    try {
      const s = getSettings();
      setNoStreamPref(s.streamDefault === 'no-stream');
      setSsePace(s.streamDelayMs);
      setFallbackDelay(s.streamDelayMs);
    } catch {}
  }, []);

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

  function formatConversation(conversation: HistoryEntry[]): string {
    const aiTurns = conversation.filter((entry) => entry.role === 'ai').length;
    const stageInstructions: string[] = [
      'ステージ1: プロジェクトの背景や利用シーンを引き出す質問を1つだけ投げ、返答は最大2文に収めてください。',
      'ステージ2: 主要な機能やユーザーストーリーを確認する質問を1つだけ投げ、返答は最大2文に収めてください。',
      'ステージ3: これまでの内容を3行以内の箇条書きでまとめ、成功指標か次のアクションを1つ提案し、最後に「要件サマリーを保存しましょう」と促してください。',
    ];
    const currentStage = Math.min(aiTurns, stageInstructions.length - 1);
    const stageHeader = stageInstructions[currentStage];

    const header = [
      'あなたは開発初心者を支援するプロダクト要件コーチです。',
      '会話は日本語で行い、専門用語は可能な限り噛み砕いて説明してください。',
      '会話は最大3ターンの応答で完結させてください。',
      'ステージ1とステージ2では過去の内容を要約しないでください。具体例は最大1個に留め、初心者でも理解できる表現にします。',
      'ステージ3のみ要約を行い、追加質問はせずに締めてください。',
      'これまでの会話ログを参考に、抜けている観点があれば該当ステージで質問してください。',
      stageHeader,
      'ステージは合計3つです。ステージ3が完了したら、ユーザーに要件サマリーの確認と保存を促してください。',
      '--- 会話ログ ---',
    ];
    const lines = conversation.map((entry) => {
      const role = entry.role === 'user' ? 'User' : entry.role === 'ai' ? 'Assistant' : 'System';
      return `${role}: ${entry.content}`;
    });
    return [...header, '', ...lines].join('\n');
  }

  function executeSuggestion(item: CmdItem) {
    // ルート選択時の分岐
    if (item.cmd === '/sound') { setCmdStage('sound'); setCmdIndex(0); setInput('/sound '); return; }
    if (item.cmd === '/speed') { setCmdStage('speed'); setCmdIndex(0); setInput('/speed '); return; }
    if (item.cmd === '/help') {
      const res = parseCommand('/help');
      if (res) pushHistory({ role: 'system', content: res });
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
        pushHistory({ role: 'system', content: 'Usage: /speed <ms>' });
      } else {
        const res = parseCommand(`/speed ${ms}`);
        if (res) pushHistory({ role: 'system', content: res });
      }
    } else {
      const res = parseCommand(item.cmd);
      if (res) pushHistory({ role: 'system', content: res });
    }
    setShowCmds(false); setCmdIndex(0); setInput(''); setCmdStage('root');
  }

  async function sendMessage(message: string) {
    if (!message.trim() || streaming) return;
    const activeMode = mode;
    if (message.trim().startsWith('/')) {
      const res = parseCommand(message.trim());
      if (res) pushHistory({ role: 'system', content: res }, activeMode);
      return;
    }
    // 日本語メモ: 新規メッセージ開始時にタイプライターの残存テキストをクリア
    cancel();
    setText('');
    const currentHistory = histories[activeMode] ?? [];
    const requirementPrompt = activeMode === 'requirements'
      ? formatConversation([...currentHistory, { role: 'user', content: message }])
      : null;
    // ユーザー発言を履歴追加
    pushHistory({ role: 'user', content: message }, activeMode);
    setStreaming(true);
    onStreamingChange?.(true);
    let useFallback = false;
    let collected = '';
    try {
      const ac = new AbortController();
      abortRef.current = ac;
      const settings = getSettings();
      const prompt = requirementPrompt ?? message;
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          tone: settings.tone,
          assistantName: settings.assistantName,
          noStream: noStreamPref,
          apiKey: settings.geminiApiKey || undefined,
        }),
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
          pushHistory({ role: 'ai', content: fallbackMessage }, activeMode);
        }
      } else {
        pushHistory({ role: 'ai', content: collected }, activeMode);
      }
    }
  }

  async function finalizeRequirements() {
    if (mode !== 'requirements') return;
    const summary = requirementDraft.trim();
    if (!summary) {
      setSaveStatus('error');
      setSaveFeedback('要件テキストを入力してください');
      return;
    }
    if (requirementsHistory.length === 0) {
      setSaveStatus('error');
      setSaveFeedback('会話ログがまだありません');
      return;
    }
    setSaveStatus('saving');
    setSaveFeedback('');
    try {
      const res = await fetch('/api/tasks/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          conversation: requirementsHistory,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Failed to save requirements (${res.status})`);
      }
      await res.json().catch(() => ({}));
      setSaveStatus('success');
      setSaveFeedback('要件を保存しました');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存に失敗しました';
      setSaveStatus('error');
      setSaveFeedback(message);
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
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-pixel pixel-title text-neon text-base">AI Chat</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    clearHistory();
                    cancel();
                    setText('');
                    abortRef.current?.abort();
                    setStreaming(false);
                    onStreamingChange?.(false);
                    setShowCmds(false);
                    setCmdIndex(0);
                    setCmdStage('root');
                    if (mode === 'requirements') {
                      setRequirementDraft('');
                      setSaveStatus('idle');
                      setSaveFeedback('');
                    }
                  }}
                  className="px-3 py-1 text-sm border border-neon border-opacity-40 rounded-md hover:bg-neon hover:bg-opacity-10"
                  title="Clear history"
                >
                  Clear
                </button>
                <button onClick={onClose} className="px-3 py-1 text-sm border border-neon border-opacity-40 rounded-md hover:bg-neon hover:bg-opacity-10">
                  Close
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`px-3 py-1 border border-neon border-opacity-40 rounded-md transition ${mode === 'chat' ? 'bg-neon bg-opacity-15 text-neon' : 'text-white/70 hover:bg-neon hover:bg-opacity-10'}`}
              >
                通常チャット
              </button>
              <button
                type="button"
                onClick={() => setMode('requirements')}
                className={`px-3 py-1 border border-neon border-opacity-40 rounded-md transition ${mode === 'requirements' ? 'bg-neon bg-opacity-15 text-neon' : 'text-white/70 hover:bg-neon hover:bg-opacity-10'}`}
              >
                要件ブラッシュアップ
              </button>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
            <div className="min-h-[10rem] whitespace-pre-wrap text-sm space-y-3">
              {history.map((m, i) => {
                const isUser = m.role === 'user';
                const isSystem = m.role === 'system';
                return (
                  <div key={i} className={isUser ? 'text-neon text-opacity-80' : isSystem ? 'text-white/70' : ''}>
                    <span className={isUser ? 'text-neon' : isSystem ? 'text-white/50' : 'text-neon text-opacity-70'}>
                      {isUser ? 'YOU>' : isSystem ? 'SYS>' : 'AI>'}
                    </span>{' '}
                    {m.content}
                  </div>
                );
              })}
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
        {mode === 'requirements' && (
          <div className="mt-3 border border-neon border-opacity-20 rounded-md p-3 bg-bg bg-opacity-40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-neon text-sm font-semibold">要件サマリー</h4>
              <button
                type="button"
                onClick={() => {
                  if (!lastAiMessage) return;
                  setRequirementDraft(lastAiMessage);
                  setSaveStatus('idle');
                  setSaveFeedback('');
                }}
                className="text-xs px-2 py-1 border border-neon border-opacity-30 rounded-md hover:bg-neon hover:bg-opacity-10 disabled:opacity-50"
                disabled={!lastAiMessage}
              >
                最終AI応答をコピー
              </button>
            </div>
            <textarea
              rows={4}
              className="w-full bg-bg text-white/90 border border-neon border-opacity-30 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-opacity-60"
              value={requirementDraft}
              onChange={(e) => {
                setRequirementDraft(e.target.value);
                setSaveStatus('idle');
                setSaveFeedback('');
              }}
              placeholder="ここに確定した要件テキストをまとめてください"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={finalizeRequirements}
                className="px-3 py-1.5 text-sm border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 disabled:opacity-60"
                disabled={!canFinalize || isSavingRequirements || streaming}
              >
                {isSavingRequirements ? '保存中…' : '要件を保存'}
              </button>
              {saveFeedback && (
                <span className={`text-xs ${saveStatus === 'success' ? 'text-emerald-300' : saveStatus === 'error' ? 'text-red-300' : 'text-white/60'}`}>
                  {saveFeedback}
                </span>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
        {/* 入力欄 */}
        <form
          className="mt-4 flex items-start gap-2 relative"
          onSubmit={(e) => {
              e.preventDefault();
              const msg = input.trim();
              if (!msg) return;
              setInput('');
              sendMessage(msg);
            }}
          >
            <textarea
              rows={mode === 'requirements' ? 3 : 2}
              className="flex-1 bg-bg text-white/90 placeholder:text-white/40 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40 resize-none"
              placeholder={inputPlaceholder}
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
                if (showCmds) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCmdIndex((i) => (i + 1) % Math.max(1, suggestions.length));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCmdIndex((i) => (i - 1 + Math.max(1, suggestions.length)) % Math.max(1, suggestions.length));
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (suggestions.length) executeSuggestion(suggestions[Math.max(0, Math.min(cmdIndex, suggestions.length - 1))]);
                    return;
                  }
                  if (e.key === 'ArrowLeft' && cmdStage !== 'root') {
                    e.preventDefault();
                    setCmdStage('root');
                    setCmdIndex(0);
                    setInput('/');
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowCmds(false);
                    setCmdStage('root');
                    setCmdIndex(0);
                    return;
                  }
                }

                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                  e.preventDefault();
                  const msg = input.trim();
                  if (!msg) return;
                  setInput('');
                  sendMessage(msg);
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
