// 日本語メモ: Web版のユーザー設定（AI名/口調、テーマ、ストリーム既定、遅延ms）を
// localStorage に保存・読込する薄いユーティリティ。

export type StreamDefault = 'stream' | 'no-stream';

export type ThemeName = 'cyan' | 'magenta' | 'lime' | 'violet' | 'amber';

export type Settings = {
  assistantName: string;
  tone: string;
  theme: ThemeName;
  streamDefault: StreamDefault;
  streamDelayMs: number; // 非SSEのタイプ出力やSSEペースの基準(ms/文字)
  // 日本語メモ: APIキーはローカル保存（開発用途）。本番ではサーバー側の安全な保管推奨。
  geminiApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const STORAGE_KEY = 'slh_settings';

export const DEFAULTS: Settings = {
  assistantName:
    (process.env.NEXT_PUBLIC_SOLOHACK_ASSISTANT_NAME || process.env.SOLOHACK_ASSISTANT_NAME || '').trim() ||
    'SoloBuddy',
  tone:
    (process.env.NEXT_PUBLIC_SOLOHACK_ASSISTANT_TONE || process.env.SOLOHACK_ASSISTANT_TONE || '').trim() ||
    '丁寧・前向き・簡潔',
  streamDefault:
    ((process.env.NEXT_PUBLIC_SOLOHACK_STREAM_DEFAULT || process.env.SOLOHACK_STREAM_DEFAULT || 'stream').trim() ===
    'no-stream'
      ? 'no-stream'
      : 'stream'),
  streamDelayMs:
    Number(process.env.NEXT_PUBLIC_SOLOHACK_STREAM_DELAY_MS || process.env.SOLOHACK_STREAM_DELAY_MS) || 40,
  theme: 'cyan',
  geminiApiKey: (process.env.NEXT_PUBLIC_SOLOHACK_GEMINI_API_KEY || '').trim() || undefined,
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim() || undefined,
  supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim() || undefined,
};

export function getSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULTS,
      ...parsed,
      // 型ガード（不正値があればデフォルトへ）
      streamDefault: parsed.streamDefault === 'no-stream' ? 'no-stream' : 'stream',
      streamDelayMs: Number(parsed.streamDelayMs) >= 0 ? Number(parsed.streamDelayMs) : DEFAULTS.streamDelayMs,
      theme: (['cyan', 'magenta', 'lime', 'violet', 'amber'] as ThemeName[]).includes((parsed.theme as ThemeName) || 'cyan')
        ? (parsed.theme as ThemeName)
        : 'cyan',
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

// テーマの実体（CSS変数設定値）。必要であれば bg/hud も差し替え可能。
const THEME_MAP: Record<ThemeName, { neon: string; glow: string }> = {
  cyan: { neon: '#00d8ff', glow: 'rgba(0, 216, 255, 0.6)' },
  magenta: { neon: '#ff00d8', glow: 'rgba(255, 0, 216, 0.6)' },
  lime: { neon: '#a3ff00', glow: 'rgba(163, 255, 0, 0.6)' },
  violet: { neon: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.6)' },
  amber: { neon: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)' },
};

export function applyTheme(theme: ThemeName) {
  if (typeof document === 'undefined') return;
  const t = THEME_MAP[theme] || THEME_MAP.cyan;
  const root = document.documentElement;
  root.style.setProperty('--neon', t.neon);
  root.style.setProperty('--glow', t.glow);
}
