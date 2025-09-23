"use client";
// 日本語メモ: Monaco ラッパー。App Router では SSR 無効の動的ロードが安定。
import dynamic from 'next/dynamic';
import { useMemo, useRef } from 'react';

const MonacoEditor = dynamic(async () => (await import('@monaco-editor/react')).default, {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center text-white/60 text-sm">
      Loading editor...
    </div>
  ),
});

function guessLanguage(path?: string, fallback = 'typescript'): string {
  if (!path) return fallback;
  const p = path.toLowerCase();
  if (p.endsWith('.ts') || p.endsWith('.tsx')) return 'typescript';
  if (p.endsWith('.js') || p.endsWith('.jsx')) return 'javascript';
  if (p.endsWith('.json')) return 'json';
  if (p.endsWith('.md')) return 'markdown';
  if (p.endsWith('.css')) return 'css';
  if (p.endsWith('.html')) return 'html';
  if (p.endsWith('.sh')) return 'shell';
  if (p.endsWith('.yml') || p.endsWith('.yaml')) return 'yaml';
  return fallback;
}

export default function EditorPane({
  path,
  value,
  readOnly,
  onChange,
}: {
  path?: string;
  value: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}) {
  const language = useMemo(() => guessLanguage(path), [path]);
  const savedThemeRef = useRef(false);

  // 日本語メモ: 初回マウント時にテーマを定義（CSS変数のネオン色を参照）。
  function handleMount(editor: any, monaco: any) {
    try {
      if (!savedThemeRef.current) {
        const neon = getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() || '#00d8ff';
        monaco.editor.defineTheme('slh-neon-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: '', foreground: 'FFFFFF' },
            { token: 'comment', foreground: '6b7280' },
            { token: 'string', foreground: 'a7f3d0' },
            { token: 'keyword', foreground: neon.replace('#', '') },
          ],
          colors: {
            'editor.background': '#0b0f14',
            'editor.lineHighlightBackground': '#0e162033',
            'editorCursor.foreground': neon,
            'editorGutter.modifiedBackground': '#3b82f6',
            'editorGutter.addedBackground': '#22c55e',
            'editorGutter.deletedBackground': '#ef4444',
            'editorLineNumber.activeForeground': neon,
          },
        });
        savedThemeRef.current = true;
      }
      monaco.editor.setTheme('slh-neon-dark');
    } catch {}
  }

  return (
    <div className="w-full h-full">
      <MonacoEditor
        height="100%"
        defaultLanguage={language}
        language={language}
        value={value}
        onChange={(v) => onChange?.(v || '')}
        onMount={handleMount}
        options={{
          readOnly: !!readOnly,
          fontLigatures: false,
          fontSize: 13,
          minimap: { enabled: false },
          smoothScrolling: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}

