# SoloHack ロードマップ
SoloHack はソロ開発をゲーム感覚で継続できる体験を提供することを目標にしています。以下では CLI MVP を起点に、段階的な機能拡張と運用体制を整理します。

## フェーズ0: CLI MVP 安定化 (現行)
- [x] タスク管理コマンド（`task add/list/done/remove`）の実装
- [x] タイマー最小実装（`timer start <minutes>`）
- [x] AI チャット最小実装（`chat`、`.env` 経由で Gemini）
- [x] JSON 永続化（`storage/solohack.json`、pre/postAction による自動ロード/保存）
- [x] `src/core/` と `src/cli/` の分離（I/O は CLI 層へ）
- [x] Vitest 導入と基本ユニットテスト
- [x] カバレッジ 85% 以上の達成と維持
- [x] CI（GitHub Actions）で build/test/lint を自動化
- [x] `.env.example` の整備
- [x] ガイドライン（AGENTS 英/日）とロードマップの作成
- [x] CI の堅牢化（npm ci 条件分岐 / Node 22 追加 / concurrency / permissions）
- [x] タイマー拡張（status/stop/reset/extend、進捗バー/割合表示）
- [x] チャット拡張（Gemini へ置換、ストリーミング対応、タイプライター速度調整）
- [x] 口調プリセット（`--tone` / `SOLOHACK_ASSISTANT_TONE`）
- [x] CLI バイナリ短縮エイリアス `slh` の追加

## フェーズ1: 開発者体験の強化
- [x] CLI ヘルプの拡充（例・既定値の明示、`--help` 整備）
- [x] シェル補完（zsh/bash）対応の検討・実装
- [x] 進捗演出（ストリーミング・タイプライター、速度調整）
- [x] 学習向け日本語コメントの体系化・コード反映（初期対応済み）
- [x] ストレージ抽象化（インターフェイス化＋`json`/`memory`プロバイダー、ENV切替）
- [x] コマンドパレット（`/`）での対話実行と設定GUI（storage/chat既定）
- [x] `.env` への設定永続化（storage/chatの既定を保存可能）
- [ ] プロジェクトボード運用とロードマップの定期更新フロー確立

## フェーズ2: Web 版 プロトタイプ
- [x] Web 版 要件定義書の追加（docs/WEB_REQUIREMENTS.md）
- [x] avatar-ui-core の調査と統合方針メモ（docs/integrations/avatar-ui-core.md）
 - [x] Next.js(App Router) プロジェクト雛形の用意（Tailwind/Framer Motion 初期設定）
  - [x] web/ 配下に雛形を追加（タイトル/ダッシュボード/設定、Avatar/Timer/Chatの最小実装）
- [x] テーマトークン定義（黒/ネオン・グロー・HUD）とベースレイアウト
- [x] `Avatar` コンポーネント（idle/talk/celebrate、発光演出）
- [ ] `useTypewriter`（音声ON/OFF、SSE統合ユーティリティ化）
 - [x] `useTypewriter`（音声ON/OFF、SSE統合ユーティリティ化）
- [x] Chat サーバー（Gemini SSE プロキシ）/ クライアント（右ドロワー＋入力欄）
  - [x] SSE ペース調整（`NEXT_PUBLIC_SOLOHACK_SSE_PACE_MS`）
  - [x] 自動スクロール追従
- [x] タイマー（カウントダウン＋祝福演出とAvatar連動）
  - [x] 完了時のネオンフラッシュ演出 + celebrate
  - [x] Avatar celebrate → idle 自動復帰
  
  
- [x] アバター画像パイプライン（sharpで resize/trim、`npm run avatars:check/build`）
- [ ] タスク CRUD（Supabase + RLS、HUD進捗）
- [x] 設定画面（AI名/口調、テーマ、ストリーム既定、遅延ms）
- [x] Chat 改善（自己紹介抑制、Clear、履歴リセット、SYS 表示、タイプライターの残存テキスト対策）
- [x] ファイルエクスプローラ（プロジェクトディレクトリ可視化、/explorer、API: /api/fs/list, /api/fs/read）
- [ ] スモークE2E（タイトル→ダッシュボード→チャット/設定）
- [ ] パフォーマンス/A11y 初期調整（LCP/CLS/フォーカス可視）

参考: 仕様は docs/WEB_REQUIREMENTS.md、統合方針は docs/integrations/avatar-ui-core.md を参照。

## フェーズ3: マルチプラットフォーム展開
- [ ] モバイル（React Native）/デスクトップ（Tauri/Electron）検討と試作
- [ ] AI パーソナリティ・モード拡張、チーム/コミュニティ機能の企画
- [ ] デプロイ/通知との連携自動化の検証

## 継続タスク
- [x] ドキュメント多言語化の初期対応（README/AGENTS の英日）
- [ ] ドキュメント多言語の継続拡充（スクリーンショット・例の同期）
- [x] API キーの `.env` 管理と `.env.example` 整備
- [ ] 法務（利用規約/プライバシー方針）の検討・整備
- [ ] ガイドライン/ロードマップの四半期レビュー運用
