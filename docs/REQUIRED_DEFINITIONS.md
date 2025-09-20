# SoloHack CLI版 まとめドキュメント

## 1. アプリ概要

SoloHack は、個人開発を「楽しく・続けやすく」するための支援アプリ。

- AI相棒 が開発相談やモチベーション支援を行う
- タスク管理・タイマー・進捗バー でハッカソン感を演出
- 将来的には Web版 → モバイル版 → IDE風デスクトップ へ拡張可能
- 最終形は Git操作・ビルド・デプロイまでワンクリックで行える「次世代IDE × ゲーム感開発体験」

CLI版は、その最初の学習MVPとして位置づけられます。

## 2. 要件定義書（CLI版）

### 2.1 プロジェクト目的

- 学習を兼ねて、SoloHackのコア機能を最初にCLIで実装する
- ロジック層をモジュール化し、将来のWeb/モバイル/IDE版に流用可能な基盤を作る

### 2.2 機能要件

#### タスク管理

- `slh task add "xxx"` → タスク追加
- `slh task list` → 一覧表示
- `slh task done <id>` → 完了
- `slh task remove <id>` → 削除
- 保存先：MVPはJSONファイル、拡張でSupabase

#### タイマー

- `slh timer start 25` → 25分カウントダウン
- `slh timer status` → 残り時間確認
- `slh timer stop` → 停止
- 終了時に演出

#### AIチャット（相棒）

- `slh chat "質問内容"` → OpenAI API呼び出し
- 出力はタイプライター風に1文字ずつ表示
- モード切替：
  - `--mode tech`（技術相談／コード例重視）
  - `--mode coach`（モチベーション支援／励まし）
- キャラクター性：名前や口調を `.env` で設定可能

### 2.3 非機能要件

- **開発環境**: Node.js v18+, TypeScript
- **CLIライブラリ**: commander or yargs
- **データ保存**: JSONファイル（初期）／Supabase（拡張）
- **AI API**: OpenAI (gpt-4o-mini, streaming対応)
- **設計方針**: ロジック層（core）とUI層（cli）を分離

### 2.4 技術スタック

- Node.js + TypeScript
- commander（CLI定義）
- fs（ローカル保存）
- openai（API接続）
- Jest/Vitest（ユニットテスト）

### 2.5 ディレクトリ構成（例）

```
solohack/
├─ src/
│  ├─ core/        # ロジック層（再利用可能）
│  │   ├─ taskManager.ts
│  │   ├─ timer.ts
│  │   └─ chat.ts
│  ├─ cli/         # CLI UI層
│  │   └─ index.ts
│  └─ tests/       # ユニットテスト
├─ package.json
└─ tsconfig.json
```

## 3. MVPゴール

- CLIで タスク管理・タイマー・AI相棒チャット を一通り動かせること
- コアロジックが モジュール化されている こと（Web/IDE移行に流用可能）
- AI相棒が モード切替 できること（技術相談／コーチング）
- 学習と実用の両方を満たす「最初のSoloHack体験」が提供できること
