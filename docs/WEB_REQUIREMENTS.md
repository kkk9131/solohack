# SoloHack Web版 要件定義書（Dreamflow風）

本書は SoloHack の Web 版（フェーズ2）の要件を整理し、実装時の指針と整合性を確保するためのドキュメントです。CLI 版のコア（`src/core/`）を再利用しつつ、Dreamflow 風 UI で「開発がゲーム体験になる」演出を目指します。

## 1. プロジェクト概要

- 名称（仮）：SoloHack Web
- 目的：個人開発を「楽しく・没入感のある体験」に変える開発支援アプリ
- コンセプト：黒背景 × ネオンブルー × 余白 × スムーズアニメーション（Dreamflow風）
- ターゲット：個人開発者、副業エンジニア、学習者
- 特徴：
  - AI相棒による相談・コーチング（技術支援＋モチベUP）
  - タスク管理・タイマー・進捗バーを HUD 風 UI で常時可視化
  - ピクセルアート風アバターで「伴走者感」を演出

## 2. 機能要件

### 2.1 タイトル画面

- 黒背景に大きなネオンブルーの「SOLO HACK」ロゴを中央に表示
- 上部にサブテキスト「Welcome to SoloHack」、下部に「Press Enter to continue」
- ピクセルアート風 AI 相棒（アバター）がロゴ横に登場（軽いバウンド/フェードイン）

受け入れ基準（例）
- Enter キーまたはクリックでダッシュボードに遷移
- 初回アクセス時は簡易オンボーディング（API キー未設定なら案内）

### 2.2 タスク管理

- モーダルでタスクの追加／編集／削除
- タスク完了で進捗バー（チェックポイント型）のノードが発光（HUD 風）
- 横スクロールで履歴/チェックポイントを確認可能

受け入れ基準（例）
- タスク CRUD が動作し、Supabase に永続化される
- 完了時、対象ノードが 1 秒程度グロー → 収束アニメーション

### 2.3 タイマー

- 画面中央に大きなカウントダウンタイマー（ネオンブルーの発光アニメーション）
- 終了時に画面全体が光る「祝福演出」＋相棒が喜びモーション

受け入れ基準（例）
- 開始/停止/延長/リセットが可能
- 終了イベントでアバターが Celebrate 状態へ 1.5s 以上遷移

### 2.4 AI相棒チャット

- 右サイドからスライドインするチャットパネル（モーダル/ドロワー）
- ネオンブルーのモノスペース文字、応答はタイプライター風ストリーミング
- ピクセルアートアバターが常駐（Idle/Talk 切替）
- モード切替：
  - 技術相談（tech：コード例を優先）
  - コーチング（coach：励まし・雑談）

受け入れ基準（例）
- ストリーミング応答中は Avatar が Talk、停止で Idle に戻る
- tech/coach のモード切替でプロンプト方針/口調が反映される

### 2.5 設定

- AI 相棒の名前・口調の設定（ローカル/サーバー側に保存）
- API キー入力欄（OpenAI／Supabase）
- UI テーマカラー（デフォルト：青ネオン）

受け入れ基準（例）
- 設定はユーザー単位で永続化され、再読み込み後も反映
- 入力済み API キーはセキュアに保存（クライアントでは保持しない）

## 3. 非機能要件

- フレームワーク：Next.js（App Router）+ React + TypeScript
- UI：Tailwind CSS（ダーク/ネオンテーマ）+ Framer Motion
- DB：Supabase（Auth + DB、タスク/ユーザー設定）
- AI：OpenAI API（ストリーミング対応、SSE/Fetch）
- スタイル：Dreamflow 風（黒背景・ネオンブルー・広めの余白・スムーズトランジション）
- パフォーマンス：LCP < 2.5s、CLS < 0.1 を目安（MVP段階で計測）
- アクセシビリティ：フォーカス可視、キーボード操作、コントラスト比を配慮

## 4. 技術スタック

- Next.js (App Router)
- Tailwind CSS（dark theme + blue neon、CSS 変数でトークン化）
- Framer Motion（フェードイン/スライドイン/グロー/祝福演出）
- Supabase（DB・Auth）
- OpenAI API（AI 相棒、ストリーミング）
- Avatar UI Core（React 包装でピクセルアートアバターを表示）

## 5. アバター UI 設計

- スタイル：ピクセルアート風（64–128px 推奨、Retina でシャープに）
- 状態：`idle` / `talk` / `celebrate`
- 切替：
  - チャットのストリーミング開始→ `talk`
  - ストリーム完了/停止→ `idle`
  - タイマー終了→ `celebrate`（一定時間後 `idle`）
- 配置：
  - タイトル画面のロゴ横
  - チャットパネル上部（常駐）
  - タイマー終了時の中心近く（祝福モーション）

実装方針（Avatar UI Core 連携）
- `avatar-ui-core` の React 化（もしくは React ラッパー）を前提に `Avatar` コンポーネントを用意
- 期待プロパティ（想定）
  - `state: 'idle' | 'talk' | 'celebrate'`
  - `size?: number`（px）、`palette?: 'blue' | 'pink' | 'green' ...`
  - `loop?: boolean`、`fps?: number`
- チャットのストリームイベントに応じて `state` を制御
- 祝福演出は Framer Motion と連動（外枠グロー + スケール）

注：`avatar-ui-core` の実 API は確認のうえ最終化（別紙：統合メモを作成予定）。

## 6. 画面・ルーティング（App Router）

- `/` タイトル（Enter で `/dashboard`）
- `/dashboard` HUD 風レイアウト（タスク + タイマー + 進捗）
- `/settings` 設定画面（AI 名/口調、テーマ、API キー）
- チャットパネル：`/dashboard` 上の右スライドドロワー（URL はモーダルパラメータで管理可）

主要コンポーネント
- `Avatar`（ピクセルアート、状態切替）
- `TaskList`, `TaskModal`, `ProgressBar(HUD)`
- `Timer`（残り時間 + グロー）
- `ChatPanel`（ストリーミング + モード切替）
- `SettingsForm`

## 7. データモデル（Supabase）

テーブル定義（MVP 最小）

```sql
-- tasks
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  order_index int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- user_settings
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_name text,
  ai_tone text,
  theme text default 'neon-blue',
  stream_default text default 'stream',
  stream_delay_ms int default 40,
  updated_at timestamptz not null default now()
);

-- optional: chat_sessions/messages（履歴保存が必要になった場合に追加）
```

RLS（行レベルセキュリティ）
- 各テーブルで `user_id = auth.uid()` のポリシーを設定
- `insert/update/delete` は本人のみ許可

## 8. API / Server Actions（Next.js）

- タスク：`createTask`, `updateTask`, `toggleComplete`, `deleteTask`, `listTasks`
- 設定：`getUserSettings`, `updateUserSettings`
- チャット：`postChat`（OpenAI ストリームをサーバーでプロキシ、SSE 返却）

注：API は Server Actions で直呼び or `api/` ルートで SSE を返却。クライアントは `fetch(eventSource)` で受信し、タイプライター描画。

## 9. テーマ/スタイル（Tailwind）

- テーマトークン（CSS 変数）例：
  - `--bg: #0b0f14`、`--hud: #0e1620`、`--neon: #00d8ff`、`--glow: rgba(0,216,255,.6)`
- Tailwind 拡張：`colors.neon`, `boxShadow.glow`, `animation.typewriter` など
- Framer Motion：`fadeInUp`, `slideInRight`, `glowPulse`, `celebrateBurst`

## 10. 環境変数（Web 版）

- `OPENAI_API_KEY`（サーバーサイドで使用）
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SOLOHACK_ASSISTANT_NAME`, `SOLOHACK_ASSISTANT_TONE`（CLI 互換のキー名も許可）
- `SOLOHACK_STREAM_DEFAULT`（`stream` | `no-stream`）、`SOLOHACK_STREAM_DELAY_MS`

## 11. アーキテクチャ方針

- ロジック層は CLI と共有可能な形に保つ（`src/core/` をパッケージとして流用 or 複製を避ける）
- データアクセスは Supabase クライアントをラップ（テスト容易性）
- チャットはサーバー経由でストリーミング（秘密鍵の漏洩防止）

## 12. MVP ゴール（受け入れ基準）

- Dreamflow 風の没入 UI でタスク・タイマー・AI チャットが稼働
- アバター常駐（チャット中は Talk、タイマー終了は Celebrate）
- ネオンブルー基調、スムーズトランジション、HUD 風進捗が成立

## 13. テスト方針

- 単体：ロジック（タスク/タイマー）を core 由来でテスト
- 結合：Server Actions（Supabase/RLS、OpenAI ストリームのモック）
- E2E：主要フロー（タイトル→ダッシュボード→チャット/設定）を Playwright でスモーク

## 14. 検討事項・リスク

- `avatar-ui-core` の API/ビルド形式を確認して React 連携最適化（ESM/CJS、Tree Shaking、サイズ）
- ストリーミングのバックプレッシャー/切断時リトライ
- Supabase 同期（オフライン/並行編集/順序制御）

## 15. マイルストーン（提案）

1) 画面骨格/テーマ/レイアウト（タイトル/ダッシュボード/設定）
2) タスク CRUD + 進捗 HUD（Supabase 連携/RLS）
3) タイマー + 祝福演出
4) チャットストリーミング + アバター連動
5) アクセシビリティ/パフォーマンス調整、E2E スモーク

---
メモ：`avatar-ui-core` の調査結果と統合方針は docs/integrations/avatar-ui-core.md を参照してください。
