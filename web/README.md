# SoloHack Web (Prototype)

Next.js + Tailwind CSS + Framer Motion による Web 版の雛形です。Dreamflow 風（黒×ネオン）UIと HUD レイアウトをベースに、アバター・タイマー・チャットの最小演出を含みます。

## セットアップ

```bash
cd web
npm install
npm run dev
```

- 開発: http://localhost:3000
- 環境変数（SSEで応答を受けるには少なくともどちらかを設定）
  - `SOLOHACK_GEMINI_API_KEY=` または `GOOGLE_API_KEY=`
  - タイプライター速度（クライアント側）
    - `NEXT_PUBLIC_SOLOHACK_STREAM_DELAY_MS=60`（フォールバック時）
    - `NEXT_PUBLIC_SOLOHACK_TITLE_DELAY_MS=60`（タイトル画面。未設定時は上記を流用）
    - `NEXT_PUBLIC_SOLOHACK_SSE_PACE_MS=0`（SSEトークンの表示間隔ms。0=即時。例: 30〜60でゆっくり）
- ルート:
  - `/` タイトル（Enter またはボタンで `/dashboard`）
  - `/dashboard` HUD（Avatar/Timer/Progress + Chat ドロワー）
  - `/settings` 設定プレースホルダ

## 技術スタック
- Next.js (App Router)
- Tailwind CSS（テーマトークン: `--bg`, `--hud`, `--neon`, `--glow`）
- Framer Motion（フェード/スライド/発光）

## 実装ポイント
- `components/Avatar.tsx`
  - 状態: `idle|talk|celebrate`
  - talk中は idle/talk 画像を交互に切替（assetsは `public/avatars/default/` 前提。未配置時はプレースホルダ）
- `components/Timer.tsx`
  - ブラウザ内カウントダウン。完了時に `celebrate` 演出用コールバック
- `components/ChatPanel.tsx`
  - 右スライドのドロワー。タイプライターのモック表示（SSE統合予定）
- `lib/useTypewriter.ts`
  - 単発メッセージ用タイプライター。SSE版は `appendToken` 拡張を想定

## 今後の統合
- OpenAI ストリーミング（Server Action / API Route + SSE）
- Supabase（タスク/設定/RLS）
- Avatar assets（`idle.png`/`talk.png`）の差し替えと `celebrate` 演出強化

## アバター画像の配置
- 推奨サイズ: 128x128px（透過PNG, アンチエイリアスなし, 1pxグリッド）
- 必須: `web/public/avatars/default/idle.png`, `web/public/avatars/default/talk.png`
- 任意: `web/public/avatars/default/celebrate.png`
- 表示は `image-rendering: pixelated` でシャープにしています（`globals.css` の `.pixelated`）。

### ソースからの自動リサイズ（推奨）
1) ソースを配置（例）
```
web/public/avatars/default/src/idle_src.png
web/public/avatars/default/src/talk_src.png
# 任意: web/public/avatars/default/src/celebrate_src.png
```
2) 変換（128x128, 最近傍, 透明背景, 中央配置）
```
cd web
npm install   # 初回のみ（sharp を取得）
npm run avatars:build
```
3) 出力先
```
web/public/avatars/default/idle.png
web/public/avatars/default/talk.png
# 任意: web/public/avatars/default/celebrate.png
```

---
- 仕様: `docs/WEB_REQUIREMENTS.md`
- avatar-ui-core 連携方針: `docs/integrations/avatar-ui-core.md`
