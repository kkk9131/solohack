"use client";
import { useEffect, useMemo, useState } from 'react';
import { DEFAULTS, Settings, StreamDefault, ThemeName, applyTheme, getSettings, saveSettings } from '@/lib/settings';

export default function SettingsPage() {
  // 日本語メモ: 初期値は localStorage -> ENV の順に採用。
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState<string>('');
  useEffect(() => {
    setS(getSettings());
  }, []);

  const themes = useMemo<{ key: ThemeName; label: string; color: string }[]>(
    () => [
      { key: 'cyan', label: 'Cyan', color: '#00d8ff' },
      { key: 'magenta', label: 'Magenta', color: '#ff00d8' },
      { key: 'lime', label: 'Lime', color: '#a3ff00' },
      { key: 'violet', label: 'Violet', color: '#8b5cf6' },
      { key: 'amber', label: 'Amber', color: '#f59e0b' },
    ],
    [],
  );

  function update<K extends keyof Settings>(key: K, val: Settings[K]) {
    setS((prev) => ({ ...prev, [key]: val }));
  }

  function onSave() {
    saveSettings(s);
    applyTheme(s.theme);
    setSaved('保存しました');
    setTimeout(() => setSaved(''), 1600);
  }

  function onReset() {
    const d = DEFAULTS;
    setS(d);
    saveSettings(d);
    applyTheme(d.theme);
    setSaved('初期化しました');
    setTimeout(() => setSaved(''), 1600);
  }

  return (
    <main className="min-h-dvh p-6 md:p-10 space-y-8">
      <h2 className="font-pixel pixel-title text-neon text-2xl">Settings</h2>
      <div className="grid gap-6 max-w-xl">
        <section className="hud-card p-4 space-y-4">
          <h3 className="text-neon">AI相棒</h3>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-neon text-opacity-70">AI 名称</span>
              <input
                type="text"
                value={s.assistantName}
                onChange={(e) => update('assistantName', e.target.value)}
                placeholder="SoloBuddy など"
                className="bg-bg text-white/90 placeholder:text-white/40 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-neon text-opacity-70">口調（自由記述）</span>
              <input
                type="text"
                value={s.tone}
                onChange={(e) => update('tone', e.target.value)}
                placeholder="丁寧・前向き・簡潔 など"
                className="bg-bg text-white/90 placeholder:text-white/40 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-neon text-opacity-70">ストリーム既定</span>
              <select
                value={s.streamDefault}
                onChange={(e) => update('streamDefault', (e.target.value as StreamDefault) || 'stream')}
                className="bg-bg text-white/90 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40"
              >
                <option value="stream">stream（逐次）</option>
                <option value="no-stream">no-stream（一括）</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-neon text-opacity-70">遅延 ms/文字（表示速度）</span>
              <input
                type="number"
                min={0}
                value={s.streamDelayMs}
                onChange={(e) => update('streamDelayMs', Math.max(0, Number(e.target.value) || 0))}
                className="bg-bg text-white/90 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40"
              />
            </label>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onSave}
              className="px-3 py-2 border border-neon border-opacity-40 rounded-md text-neon hover:bg-neon hover:bg-opacity-10"
            >
              Save
            </button>
            <button
              onClick={onReset}
              className="px-3 py-2 border border-neon border-opacity-20 rounded-md text-white/70 hover:bg-neon hover:bg-opacity-10"
            >
              Reset
            </button>
            <span className="text-neon text-opacity-70 text-sm">{saved}</span>
          </div>
        </section>
        <section className="hud-card p-4 space-y-4">
          <h3 className="text-neon">テーマ</h3>
          <div className="text-sm text-neon text-opacity-70">ネオンカラー</div>
          <div className="flex flex-wrap gap-3">
            {themes.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  update('theme', t.key);
                  applyTheme(t.key);
                }}
                className={`w-9 h-9 rounded-full border ${s.theme === t.key ? 'border-neon border-2' : 'border-white/20'}`}
                style={{ backgroundColor: t.color }}
                aria-label={t.label}
                title={t.label}
              />
            ))}
          </div>
        </section>
        <section className="hud-card p-4 space-y-4">
          <h3 className="text-neon">API キー</h3>
          <div className="text-xs text-neon text-opacity-60">
            日本語メモ: 開発用途としてローカル保存します（ブラウザの localStorage）。本番環境ではサーバー側で安全に保管してください。
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-neon text-opacity-70">Gemini API Key</span>
              <input
                type="password"
                value={s.geminiApiKey ?? ''}
                onChange={(e) => update('geminiApiKey', e.target.value)}
                placeholder="sk-...（任意。設定時はENVより優先）"
                className="bg-bg text-white/90 placeholder:text-white/40 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-neon text-opacity-70">Supabase URL</span>
              <input
                type="text"
                value={s.supabaseUrl ?? ''}
                onChange={(e) => update('supabaseUrl', e.target.value)}
                placeholder="https://xxxx.supabase.co"
                className="bg-bg text-white/90 placeholder:text-white/40 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-neon text-opacity-70">Supabase ANON KEY</span>
              <input
                type="password"
                value={s.supabaseAnonKey ?? ''}
                onChange={(e) => update('supabaseAnonKey', e.target.value)}
                placeholder="eyJhbGci..."
                className="bg-bg text-white/90 placeholder:text-white/40 border border-neon border-opacity-20 rounded-md px-3 py-2 focus:outline-none focus:border-opacity-40"
              />
            </label>
          </div>
        </section>
      </div>
    </main>
  );
}
