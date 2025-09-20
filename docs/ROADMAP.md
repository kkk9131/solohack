# SoloHack ロードマップ
SoloHack はソロ開発をゲーム感覚で継続できる体験を提供することを目標にしています。以下では CLI MVP を起点に、段階的な機能拡張と運用体制を整理します。

## フェーズ0: CLI MVP 安定化 (現行)
- [x] タスク管理コマンド（`task add/list/done/remove`）の実装
- [x] タイマー最小実装（`timer start <minutes>`）
- [x] AI チャット最小実装（`chat`、`.env` 経由で OpenAI）
- [x] JSON 永続化（`storage/solohack.json`、pre/postAction による自動ロード/保存）
- [x] `src/core/` と `src/cli/` の分離（I/O は CLI 層へ）
- [x] Vitest 導入と基本ユニットテスト
- [x] カバレッジ 85% 以上の達成と維持
- [x] CI（GitHub Actions）で build/test/lint を自動化
- [x] `.env.example` の整備
- [x] ガイドライン（AGENTS 英/日）とロードマップの作成
- [x] CI の堅牢化（npm ci 条件分岐 / Node 22 追加 / concurrency / permissions）

## フェーズ1: 開発者体験の強化
- [ ] CLI ヘルプの拡充（例・既定値の明示、`--help` 整備）
- [ ] シェル補完（zsh/bash）対応の検討・実装
- [ ] 進捗演出（タイプライター表示・装飾）の導入
- [x] 学習向け日本語コメントの体系化・コード反映（初期対応済み）
- [ ] ストレージ抽象化（インターフェイス化し差し替え容易に）
- [ ] プロジェクトボード運用とロードマップの定期更新フロー確立

## フェーズ2: Web 版 プロトタイプ
- [ ] `src/core/` 共有の Web クライアント雛形（React/Next.js）
- [ ] Supabase など外部永続層の PoC（認証・同期の検証）
- [ ] UI コンポーネントとデザインシステムのドラフト

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
