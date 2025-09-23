# フェーズ4 初期実装 — エディタ/ターミナル セットアップ手順

目的: 初心者向けに「中央エディタ＋右AIチャット＋下部Run/ターミナル（VSCode風）」の最小体験を提供します。

## 実装サマリ（現状）
- エディタ画面 `/editor`
  - Monaco エディタ（拡張子から言語推定）
  - 左ペイン: Explorer（Workspace/Local 切替）
    - Workspace: `/api/fs/list|read|write` でプロジェクト配下を編集
    - Local: File System Access API（Chromium）でローカルフォルダ編集
  - 右ドロワー: AIチャット（Dashboardと同等）
    - ストリーミング中は Avatar と連動（talk/idle）
  - 下部: 実行系
    - Run（SSE）: プリセットコマンド（build-web/lint-web/test-repo/echo）を spawn → ログ配信
    - Terminal（xterm + node-pty）: インタラクティブなシェル。Start/Stop、リサイズ同期

## セットアップ
1) 依存インストール
```
cd web
npm i
```

2) 環境変数（web/.env.local）
```
# PTY(インタラクティブ端末)を有効化（本番で必要。開発は未設定でもOK）
SOLOHACK_PTY_ENABLED=true

# Run(APIでspawn)を本番で許可したい場合に設定（開発は未設定でもOK）
SOLOHACK_RUN_ENABLED=true

# リポジトリルートを明示する場合のみ（既定: web/ の一つ上）
SOLOHACK_REPO_ROOT=..

# 任意: 使用シェルの明示（未設定時 macOS は /bin/bash）
SHELL=/bin/zsh
```

3) 開発サーバ
```
npm run dev
```

4) 動作確認
- `/editor`
  - 左上「Source」で `Workspace` / `Local` 切替
  - ファイルを開いて編集→`Save`（ソースに応じて保存先が切替）
  - 右上「Open Chat」→ ストリーミング中は Avatar が `talk`
  - 下部「Run」: プリセット実行（ログがストリーム表示）
  - 下部「Terminal (interactive)」: Start→ターミナル入力

## 本番運用の注意
- 書き込み/実行系は既定で無効にすべきです
  - `SOLOHACK_FS_WRITE_ENABLED=true`（Workspace保存）
  - `SOLOHACK_RUN_ENABLED=true`（プリセット実行）
  - `SOLOHACK_PTY_ENABLED=true`（PTY）
- 認証・許可レイヤの導入を推奨（User/Roleでの制御、許可パスの限定）

## トラブルシュート
- Interactive Terminal で `[connection error]`
  - DevTools → Network:
    - `POST /api/pty/start` が 200 か？
    - `GET /api/pty/stream?id=...` が 200 か？（403 → `SOLOHACK_PTY_ENABLED` 未設定）
  - node-pty のビルドに失敗 → `npm rebuild node-pty`、macOS は `xcode-select --install`
- Run（プリセット）が 403 → `SOLOHACK_RUN_ENABLED` を設定
- Workspace 保存が 403 → `SOLOHACK_FS_WRITE_ENABLED` を設定
- Local 編集（FSA）が出ない → ブラウザが Chromium 系か確認

## 今後（VSCode風へ拡張）
- M1: タブ複数セッション、再接続、Ctrl+C/D/clear、CWD指定起動、スクロールバック拡張
- M2: 検索/リンク（xterm addons）、右クリックメニュー、リネーム、分割表示
- M3: WebSocket 化（低遅延双方向）、SHELL/ENV選択、レイアウト保存

