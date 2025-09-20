# リポジトリガイドライン
SoloHack CLI は AI 相棒と進めるゲーミフィケーション開発体験を提供することを目標としています。以下の指針に従い、変更を安定して統合できるようにしましょう。

## プロジェクト構造とモジュール配置
ソースは `src/` にあり、再利用可能なロジックは `src/core/`（`taskManager.ts`、`timer.ts`、`chat.ts`）にまとめ、CLI のエントリーポイントは `src/cli/index.ts` に置きます。テストは `src/tests/` で対応するモジュールをミラーリングし、仕様メモやリサーチは `docs/`（例：`docs/REQUIRED_DEFINITIONS.md`）に保存します。データ永続化は既定で `storage/solohack.json` を想定し、開発中の一時ファイルとして扱ってください。

## ビルド・テスト・開発コマンド
`npm install` 後は次を利用します。
- `npm run build` – TypeScript を `dist/` へトランスパイル。
- `npm run dev` – ts-node で CLI を実行（高速反復）。
- `npm run dev:watch` – 変更を監視して自動再実行。
- `npm run build:watch` – `dist/` をインクリメンタル再ビルド。
- `npm test` – ユニットテスト一式を実行。
- `npm run lint` – eslint と prettier をまとめて実行。
独自スクリプトは `package.json` の npm scripts に追加し、散在するシェルスクリプトは避けましょう。

バイナリの短縮エイリアス:
- CLI は `solohack` に加えて `slh` でも起動できます。
- 既に `npm link` 済みの場合は、新エイリアス作成のため再度 `npm link` を実行してください。

## コーディング規約と命名（学習向けコメント指針）
TypeScript は strict モード、インデントはスペース 2、末尾カンマを推奨します。関数・変数は camelCase、クラスは PascalCase、CLI オプションは kebab-case を徹底します。`src/core/` から細かいユーティリティをエクスポートし、CLI 層を薄く保ちます。

学習向けの日本語コメントは「要点を短く」。以下のタグを推奨します。
- `// 日本語メモ:` 背景・理由・トレードオフ
- `// TODO:` 今後の具体的な改善方針（目的ベースで）
- `// NOTE:` 想定外になりやすい挙動・制約
長文になりそうな場合は関数のJSDocに要約し、コード進化に合わせて更新してください。

## テスト指針
テストは Vitest を使い、各モジュールに対応する `<name>.spec.ts` を `src/tests/` に配置します。OpenAI 連携はテストダブルでスタブ化し、CI で実 API を呼び出さないようにします。`src/core/` のラインカバレッジは 85% 以上を目標にし、CLI コマンドの配線を確認するスモークテストも追加します。タイマー併走の調査時は `npm test -- --runInBand` を利用してください。

## コミットとプルリクエスト指針
現在の履歴は「Initial commit」のみなので、今後は Conventional Commits のプレフィックス（`feat:`、`fix:`、`docs:` など）を採用し、命令形で約 72 文字に収めます。プルリクには要約箇条書き、関連 issue（なければ `n/a`）、UI 変更時のスクリーンショットや動画、テスト結果を必ず添付し、CI が通過してレビューコメントが解消されてからレビューを依頼してください。

## 環境設定
AI 関連の資格情報は `.env` に保存し、Gemini を利用する場合は `SOLOHACK_GEMINI_API_KEY`（または `GOOGLE_API_KEY`）と任意の `SOLOHACK_ASSISTANT_NAME` を設定します。秘密情報はコミットせず、変更があれば `.env.example` を更新します。新しいランタイムフラグを導入する際は README に追記し、CLI のヘルプ出力にもわかりやすい既定値を示してください。

## 作業ログ
作業は `log.md` に記録します。時刻は `YYYY-MM-DD HH時`（例: `2025-09-20 08時`）で、要点を箇条書きにまとめてください。
