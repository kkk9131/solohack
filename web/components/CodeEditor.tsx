"use client";
import { useMemo } from 'react';
import Editor, { OnChange } from '@monaco-editor/react';

export type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  path?: string; // 拡張子で言語推定
  language?: string;
  readOnly?: boolean;
  height?: string | number;
};

export default function CodeEditor({ value, onChange, path, language, readOnly = false, height = '70vh' }: CodeEditorProps) {
  // 日本語メモ: Monaco の言語は拡張子から簡易判定。必要に応じて拡張。
  const lang = useMemo(() => {
    if (language) return language;
    const p = (path || '').toLowerCase();
    if (p.endsWith('.ts') || p.endsWith('.tsx')) return 'typescript';
    if (p.endsWith('.js') || p.endsWith('.jsx')) return 'javascript';
    if (p.endsWith('.json')) return 'json';
    if (p.endsWith('.md')) return 'markdown';
    if (p.endsWith('.css')) return 'css';
    if (p.endsWith('.html')) return 'html';
    if (p.endsWith('.yml') || p.endsWith('.yaml')) return 'yaml';
    return 'plaintext';
  }, [path, language]);

  const handleChange: OnChange = (v) => {
    onChange?.(v ?? '');
  };

  return (
    <div className="rounded-md overflow-hidden border border-neon border-opacity-20 bg-bg/70">
      <Editor
        height={height}
        theme="vs-dark"
        path={path}
        defaultLanguage={lang}
        language={lang}
        value={value}
        onChange={handleChange}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          tabSize: 2,
          smoothScrolling: true,
          scrollBeyondLastLine: false,
          guides: { bracketPairs: true },
          renderWhitespace: 'boundary',
        }}
      />
    </div>
  );
}
