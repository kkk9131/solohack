"use client";
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TerminalStartupScreenProps {
  onContinue: () => void;
}

export default function TerminalStartupScreen({ onContinue }: TerminalStartupScreenProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // ASCII文字表示後にプロンプトを表示
    const timer = setTimeout(() => setShowPrompt(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onContinue();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onContinue]);

  // SOLO HACKのASCII文字（SOLOを正しく修正）
  const soloAscii = [
    "███████╗ ██████╗ ██╗      ██████╗ ",
    "██╔════╝██╔═══██╗██║     ██╔═══██╗",
    "███████╗██║   ██║██║     ██║   ██║",
    "╚════██║██║   ██║██║     ██║   ██║",
    "███████║╚██████╔╝███████╗╚██████╔╝",
    "╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝ "
  ];

  const hackAscii = [
    "██╗  ██╗ █████╗  ██████╗██╗  ██╗",
    "██║  ██║██╔══██╗██╔════╝██║ ██╔╝",
    "███████║███████║██║     █████╔╝ ",
    "██╔══██║██╔══██║██║     ██╔═██╗ ",
    "██║  ██║██║  ██║╚██████╗██║  ██╗",
    "╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝"
  ];

  return (
    <div className="absolute inset-0 bg-bg flex flex-col items-center justify-center p-2 z-10">
      {/* ウィンドウ風コンテナ - より大きなサイズ */}
      <div className="w-full max-w-6xl hud-card overflow-hidden">
        {/* タイトルバー */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neon border-opacity-20">
          <div className="text-neon text-opacity-80 text-sm">Welcome to Solo Hack</div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500/80" />
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-400/80" />
            <span className="inline-block w-3 h-3 rounded-full bg-green-400/80" />
          </div>
        </div>

        {/* ターミナルコンテンツ - より大きなパディング */}
        <div className="p-6 min-h-[420px] flex flex-col items-center justify-center space-y-4 overflow-x-auto">
          {/* SOLO ASCII Art */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-mono text-neon text-center w-full flex flex-col items-center"
          >
            {soloAscii.map((line, index) => (
              <motion.div
                key={`solo-${index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-xs leading-3 whitespace-pre font-mono tracking-tighter"
                style={{
                  textShadow: '0 0 4px var(--neon), 0 0 8px var(--glow)',
                  fontFamily: 'ui-monospace, "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                }}
              >
                {line}
              </motion.div>
            ))}
          </motion.div>

          {/* HACK ASCII Art */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="font-mono text-neon text-center w-full flex flex-col items-center"
          >
            {hackAscii.map((line, index) => (
              <motion.div
                key={`hack-${index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 + index * 0.1 }}
                className="text-xs leading-3 whitespace-pre font-mono tracking-tighter"
                style={{
                  textShadow: '0 0 4px var(--neon), 0 0 8px var(--glow)',
                  fontFamily: 'ui-monospace, "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                }}
              >
                {line}
              </motion.div>
            ))}
          </motion.div>

          {/* Press Enterプロンプト */}
          {showPrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0, 1] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: "loop"
              }}
              className="text-neon text-opacity-70 text-xs font-mono mt-4"
            >
              Press Enter to continue
            </motion.div>
          )}

          {/* Continueボタン */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            onClick={onContinue}
            className="mt-2 px-4 py-1.5 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10 transition-colors font-mono text-xs"
          >
            Continue
          </motion.button>
        </div>
      </div>
    </div>
  );
}