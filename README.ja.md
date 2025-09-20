# SoloHack CLI

*個人開発を、もっと楽しく、続けやすく。*

[English README is here](./README.md)

## 概要

SoloHackは、個人開発を「楽しく・続けやすく」するために設計された支援アプリケーションです。このCLIは、SoloHackプロジェクトの最初の学習MVP（Minimum Viable Product）です。

AIの相棒が開発の相談に乗ったり、モチベーションを支援したりすることで、「ゲーム感覚の開発体験」を提供することを目的としています。

## 機能一覧（CLI版 MVP）

### 1. タスク管理
シンプルなコマンドで、ハッカソンのような開発体験を演出します。短縮エイリアス `slh` でも実行できます。
- `slh task add "新しい機能"`: タスクを追加します。
- `slh task list`: タスク一覧を表示します。
- `slh task done <id>`: タスクを完了にします。
- `slh task remove <id>`: タスクを削除します。

### 2. ポモドーロタイマー
集中力を高めるためのカウントダウンタイマーです。
- `slh timer start 25`: 25分のタイマーを開始します。
- `slh timer status`: 残り時間を確認します。
- `slh timer stop`: タイマーを停止します。
- `slh timer reset`: タイマーを最初の設定時間にリセットして再開します。
- `slh timer extend 5`: 実行中のタイマーを5分延長します。

### 3. AIチャット（相棒）
技術的な相談からモチベーション維持まで、AIの相棒がサポートします。
- `slh chat "divを中央寄せするには？"`: 質問を投げかけます。
- **モード切替:**
  - `--mode tech`: 技術的なアドバイスやコード例を返します。
  - `--mode coach`: モチベーションを維持するための励ましの言葉を返します。
 - **口調プリセット:** `--tone "丁寧・前向き・簡潔"` のように指定できます。`.env` の `SOLOHACK_ASSISTANT_TONE` でも設定可能です。
- **ストリーミング:** 既定でストリーミング表示します。まとめて表示したい場合は `--no-stream` を付与します。
 - **速度調整:** `--speed instant|fast|normal|slow`（既定: `slow`）や `--delay <ms>` でタイプライター速度を変更できます。環境変数 `SOLOHACK_STREAM_DELAY_MS` も利用可。
- **カスタマイズ:** `.env` ファイルでAIの名前や口調を設定できます。
  - 環境変数: `SOLOHACK_GEMINI_API_KEY`（または `GOOGLE_API_KEY`）

## 技術スタック

- **言語:** Node.js, TypeScript
- **CLIフレームワーク:** Commander.js
- **AI:** Gemini（`@google/generative-ai` 利用）
- **データ保存:** ローカルJSONファイル（MVP）
- **テスト:** Jest/Vitest

## 将来の展望

SoloHackプロジェクトは、このCLI版から始まり、将来的には以下の形態への拡張を目指しています。

1.  **Webアプリケーション版**
2.  **モバイルアプリ版**
3.  本格的な **IDE風デスクトップアプリケーション**

最終的には、Git操作からビルド、デプロイまでをワンクリックで行える、ゲーム感覚の次世代IDEを創造することが目標です。

## 開発者向け補足

- ローカルでのリンク: `npm run link`（`slh` と `solohack` の両方が使えるようになります）。既にリンク済みの場合も、新エイリアス反映のため再実行してください。
- 解除（任意）: `npm unlink -g solohack-cli`（必要に応じて、リポジトリ内で `npm unlink`）
