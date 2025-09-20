# SoloHack Web (Prototype)

Next.js + Tailwind CSS + Framer Motion による Web 版の雛形です。Dreamflow 風（黒×ネオン）UIと HUD レイアウトをベースに、アバター・タイマー・チャットの最小演出を含みます。

## セットアップ

```bash
cd web
npm install
npm run dev
```

- 開発: http://localhost:3000
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

---
- 仕様: `docs/WEB_REQUIREMENTS.md`
- avatar-ui-core 連携方針: `docs/integrations/avatar-ui-core.md`
