# Avatar UI Core 連携メモ（SoloHack Web）

本メモは、`sito-sikino/avatar-ui-core` の構成と機能を把握し、SoloHack Web（Next.js + React）に統合するための指針をまとめたものです。

## 概要

- リポジトリ: https://github.com/sito-sikino/avatar-ui-core
- 技術構成: Flask（Python）+ フロント（ES Modules / Vanilla JS / CSS）
- 目的: ターミナル調 UI（グリーン・オン・ブラック）、タイプライター演出、口パク同期のピクセルアートアバター、効果音
- API: `/api/chat`（POST: `{ message }` -> `{ response }`）
- アセット: `static/images/idle.png`, `static/images/talk.png`

## ディレクトリ構成（主要）

```
app.py                     # Flaskアプリ
settings.py                # .envから設定ロード
static/js/app.js           # エントリ、各マネージャ初期化
static/js/animation.js     # 口パク & タイプライター
static/js/chat.js          # 入出力＋fetch /api/chat
static/js/sound.js         # Web Audio によるタイプ音
static/js/settings.js      # 画像パス生成/設定
templates/index.html       # UIテンプレート
```

## 機能の中核

- 口パク: `AnimationManager.startMouthAnimation()` が `setInterval` で `idle.png` と `talk.png` を交互に切替
- タイプライター: `typeWriter(el, text)` が 1 文字ずつ出力し、スペース以外で効果音を再生
- チャット: `ChatManager` が Enter で `/api/chat` に POST、受け取った `response` を `typeWriter` で表示
- 設定: `.env` -> `settings.py` -> `index.html` の `appConfig` 経由でフロントに伝播

## SoloHack Web への統合戦略

SoloHack Web は Next.js（App Router）+ React + Tailwind + Framer Motion を採用。直接 Flask を使わず、以下の方針で**React化**して統合します。

### 1) Avatar コンポーネント（React/TypeScript）

- 状態: `idle | talk | celebrate`（原リポジトリは `idle/talk` の2種。`celebrate` は SoloHack 拡張）
- Props（案）:
  - `state: 'idle' | 'talk' | 'celebrate'`
  - `size?: number`（px）
  - `images?: { idle: string; talk: string }`
  - `beep?: boolean`（タイプ音ON/OFF）
  - `fps?: number`（口パク間隔の逆数：原実装は `MOUTH_ANIMATION_INTERVAL_MS`）
- 実装: `useEffect` で `state==='talk'` 時に `setInterval` で画像フレーム切替。`celebrate` は Framer Motion によるグロー/スケール演出で対応。

### 2) Typewriter Hook / Utility

- `useTypewriter(text, { delayMs })` で 1 文字ずつ流すロジックを提供
- ストリーミング（SSE）前提: サーバーからトークンが随時届く設計に合わせ、`appendToken()` で文字列を増やす方式
- 効果音: スペース以外の追加時に `SoundManager` 相当の音を再生（Web Audio）。アクセシビリティのため無効化可

### 3) チャットの流量制御

- 原実装は「全文受信→タイプライター」。SoloHack は「サーバーSSEで逐次→タイプライター反映」を採用
- ストリーミング開始→`Avatar state = talk`、ストリーム完了→`idle`
- エラー時は `system` ライン追加、必要に応じて `talk` → `idle` に戻す

### 4) サーバーサイド（Next.js Server Actions / API Route）

- OpenAI API を**サーバー**で呼び出し、SSE でクライアントに転送（秘密鍵をクライアントに渡さない）
- SoloHack 既存ENVとの対応
  - `GEMINI_API_KEY`（原）→ `OPENAI_API_KEY`（SoloHack）
  - `TYPEWRITER_DELAY_MS`（原）→ `SOLOHACK_STREAM_DELAY_MS`（SoloHack）

### 5) スタイル / テーマ適合

- 原実装: ターミナル（グリーン）。SoloHack: Dreamflow 風（黒×ネオンブルー）
- Tailwind トークンで `--neon`, `--glow` を定義。Avatarの枠やラベルをネオン発光で再現
- 祝福演出（タイマー完了）: `celebrate` 状態を一定時間活性化し、Framer Motion の `animate` でグロー/スケール

### 6) アセット

- 画像: `idle.png`, `talk.png` を `public/avatars/default/` 配下に配置（64–128px 推奨）
- 将来: カラーパレット別や差分テーマ別のバリエーション管理（`palette?: 'blue' | ...'`）

## 既存コードの要点（抜粋）

- `animation.js` — 口パクは `setInterval` で idle/talk をトグル、タイプライター完了時に停止
- `chat.js` — fetch で `/api/chat`、応答を `typeWriter` に渡す。UIは行要素 `.line ai` を追加して内部 `<span.ai-text>` に流し込み
- `sound.js` — `AudioContext` + `OscillatorNode` + `GainNode` で矩形波ビープ音

## セキュリティと設計上の注意

- APIキーはクライアントに渡さない（Server Actions / Route Handler 経由）
- ストリーミング中断・再接続を考慮（再試行/キャンセル）
- 効果音はユーザー設定で無効化可能に（自動再生制約・聴覚配慮）

## 実装メモ（擬似コード）

```tsx
function Avatar({ state, size = 96, images, fps = 6, beep = false }) {
  const [frame, setFrame] = useState<'idle'|'talk'>('idle');
  useEffect(() => {
    if (state !== 'talk') { setFrame('idle'); return; }
    const ms = Math.round(1000 / fps);
    const id = setInterval(() => setFrame(f => f === 'idle' ? 'talk' : 'idle'), ms);
    return () => clearInterval(id);
  }, [state, fps]);
  const src = frame === 'idle' ? images.idle : images.talk;
  return (
    <motion.img src={src} width={size} height={size} animate={state==='celebrate'?{scale:[1,1.08,1]}:undefined} />
  );
}
```

## 今後の拡張

- `celebrate` の追加アニメーション（パーティクル、外周リンググロー）
- 口パクを2フレーム → 3–4 フレーム化（眨きフレームも含め自然に）
- 低速端末向けの CPU 使用率最適化（requestAnimationFrame 併用）

---

参考：原リポジトリの README / コードは `tmp/avatar-ui-core/` で確認済み。
