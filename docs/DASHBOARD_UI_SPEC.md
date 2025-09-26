# RPGマップ連動UI — 技術仕様（Codex-ready）

## 0. ゴール / 非ゴール

**ゴール**: 既存アプリ（タスク管理 / ポモドーロ / AIチャット）に、RPG風マップ（固定・直線型）を追加し、タスク状態とアバター移動を連動させる。

**非ゴール（MVP）**: マップ分岐、AIマップ自動生成、装備/称号/レベル、複数ワールド、対戦・協働プレイ。

## 1. 前提・用語

- **Tech stack**: Next.js + Tailwind CSS + shadcn/ui, PixiJS（Canvas描画）, Supabase（Auth / Postgres / Realtime）, React Query（fetch + cache）。
- **時間・座標系**:
  - 基本単位: `px`
  - `tile_size` = 16（ドット絵前提）
  - アバター移動速度: `speed_px_per_sec` = 64（MVP固定）
- **タスク状態**: `todo` | `in_progress` | `done`
  - 日本語UI表示: 未着手 / 進行中 / 完了
- **ノード（島）キー（固定・直線順）**:
  - `start_village`
  - `front_island`
  - `backend_island`
  - `infra_tower`
  - `release_castle`

## 2. 画面レイアウト（固定レイアウト / shadcn + Tailwind）

```
┌──────────────────────────────────────────────┐
│ [Header] Pomodoro + TaskList (横並び)       │  ← 高さ auto
├──────────────────────────────────────────────┤
│ [Main]                                       │
│  ├─ [Center] MapCanvas (Pixi)                │  ← 伸縮 1fr
│  └─ [Right Sidebar] AI Chat (shadcn Panel)   │  ← 固定 320px（Resizable可）
└──────────────────────────────────────────────┘
```

- **レイアウト実装**: `grid grid-cols-[1fr_320px] grid-rows-[auto_1fr]`
- **MapCanvas** は CSR専用（`Next.js dynamic(..., { ssr:false })`）

## 3. ユースケース / 状態遷移（アバター）

- **未着手（todo）**: `start_village` で待機（`idle`）
- **進行中（in_progress）**: 対象タスクの 割当ノード へ移動（`moving`）
- **完了（done）**: 割当ノード上で 祝福演出（旗/光/宝箱）→ `cleared`

### MVPポリシー（多タスク）

- ユーザーごとに 同時 `in_progress` は1件まで（DBの部分ユニーク制約で強制）
- `in_progress` が変更されたら、アバターは そのタスクのノードへ移動開始
- `done` が先に立った場合は 即スナップして演出（MVP: 瞬間移動で簡素化）

## 4. データモデル（TypeScript Interfaces）

```typescript
// 共通
export type TaskStatus = '''todo''' | '''in_progress''' | '''done''';
export type AvatarState = '''idle''' | '''moving''' | '''cleared''';
export type NodeKey =
  | '''start_village'''
  | '''front_island'''
  | '''backend_island'''
  | '''infra_tower'''
  | '''release_castle''';

export interface Vec2 { x: number; y: number; }

export interface MapNode {
  id: string;           // uuid
  map_id: string;       // uuid
  key: NodeKey;         // 固定キー
  name: string;         // 表示名
  position: Vec2;       // 中心座標(px)
  arrival_radius: number; // 到達判定半径(px)
  order_index: number;  // 直線順序
  type: '''start''' | '''island''' | '''tower''' | '''castle''';
}

export interface Path {
  id: string;
  map_id: string;
  from_node_key: NodeKey;
  to_node_key: NodeKey;
  waypoints: Vec2[]; // 直線なら [A, B] の2点でOK
}

export interface MapMeta {
  id: string;
  name: string;
  width: number;   // px
  height: number;  // px
  tile_size: number; // 16
}

export interface Avatar {
  id: string;
  user_id: string;
  position: Vec2;             // 現在座標(px)
  state: AvatarState;
  current_node_key: NodeKey;  // 論理上の位置
  active_task_id: string | null; // 進行中タスク（1件）
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  status: TaskStatus;   // todo/in_progress/done
  node_key: NodeKey;    // どの島に属するか
  order_index: number;  // UI表示順
  created_at: string;   // ISO
  updated_at: string;   // ISO
}
```

## 5. Supabase: DDL / インデックス / RLS / Realtime

### 5.1 テーブル（MVPで必要な最小）

```sql
-- tasks: 既存がある場合はALTERで node_key と部分ユニークを追加
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  status text not null check (status in ('''todo''','''in_progress''','''done''')),
  node_key text not null check (node_key in (
    '''start_village''','''front_island''','''backend_island''','''infra_tower''','''release_castle'''
  )),
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 「ユーザーごとに in_progress は1件」の部分ユニーク
create unique index if not exists tasks_one_in_progress_per_user
  on public.tasks (user_id)
  where (status = '''in_progress''');

create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  position_x int not null default 0,
  position_y int not null default 0,
  state text not null check (state in ('''idle''','''moving''','''cleared''')) default '''idle''',
  current_node_key text not null default '''start_village''',
  active_task_id uuid null references public.tasks(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  width int not null,
  height int not null,
  tile_size int not null default 16
);

create table if not exists public.map_nodes (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  key text not null,
  name text not null,
  position_x int not null,
  position_y int not null,
  arrival_radius int not null default 24,
  order_index int not null,
  type text not null check (type in ('''start''','''island''','''tower''','''castle''')),
  unique(map_id, key)
);

create table if not exists public.paths (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  from_node_key text not null,
  to_node_key text not null,
  waypoints jsonb not null,
  unique(map_id, from_node_key, to_node_key)
);
```

### 5.2 RLS（ユーザー自身のみ）

```sql
alter table public.tasks enable row level security;
create policy tasks_select on public.tasks
  for select using (user_id = auth.uid());
create policy tasks_modify on public.tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.avatars enable row level security;
create policy avatars_rw on public.avatars
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

### 5.3 Realtime購読（推奨チャンネル命名）

- `public:tasks:user:{user_id}`
- `public:avatars:user:{user_id}`

```javascript
supabase
  .channel(`public:tasks:user:${userId}`)
  .on('''postgres_changes''',
    { event: '''*''', schema: '''public''', table: '''tasks''', filter: `user_id=eq.${userId}` },
    handleTaskChange
  )
  .subscribe();

supabase
  .channel(`public:avatars:user:${userId}`)
  .on('''postgres_changes''',
    { event: '''*''', schema: '''public''', table: '''avatars''', filter: `user_id=eq.${userId}` },
    handleAvatarChange
  )
  .subscribe();
```

## 6. マップ（固定）— シードデータ（JSON例）

```json
{
  "map": { "name": "Linear Dev Journey", "width": 1600, "height": 400, "tile_size": 16 },
  "nodes": [
    { "key": "start_village",  "name": "村（スタート）",    "position": { "x": 80,  "y": 300 }, "arrival_radius": 24, "order_index": 0, "type": "start" },
    { "key": "front_island",   "name": "フロント島",        "position": { "x": 400, "y": 280 }, "arrival_radius": 24, "order_index": 1, "type": "island" },
    { "key": "backend_island", "name": "バックエンド島",    "position": { "x": 800, "y": 260 }, "arrival_radius": 24, "order_index": 2, "type": "island" },
    { "key": "infra_tower",    "name": "インフラ塔",        "position": { "x": 1150,"y": 240 }, "arrival_radius": 24, "order_index": 3, "type": "tower" },
    { "key": "release_castle", "name": "リリース城（ゴール）","position": { "x": 1500,"y": 220 }, "arrival_radius": 24, "order_index": 4, "type": "castle" }
  ],
  "paths": [
    { "from_node_key": "start_village",  "to_node_key": "front_island",   "waypoints": [ { "x": 80, "y": 300 }, { "x": 400, "y": 280 } ] },
    { "from_node_key": "front_island",   "to_node_key": "backend_island", "waypoints": [ { "x": 400, "y": 280 }, { "x": 800, "y": 260 } ] },
    { "from_node_key": "backend_island", "to_node_key": "infra_tower",    "waypoints": [ { "x": 800, "y": 260 }, { "x": 1150,"y": 240 } ] },
    { "from_node_key": "infra_tower",    "to_node_key": "release_castle", "waypoints": [ { "x": 1150,"y": 240 }, { "x": 1500,"y": 220 } ] }
  ]
}
```

## 7. 連動ルール（Task ⇄ Map/Avatar）

### 7.1 ステートマシン（簡易）

- **`todo` → アバター `idle` @ `start_village`**
- **`todo` → `in_progress`**:
  - `avatars.active_task_id = task.id`
  - 経路: `current_node_key` → `task.node_key`
  - アバター `moving`
- **`in_progress` → `done`**:
  - アバターを `task.node_key` にスナップ
  - 祝福演出（旗/光/宝箱）表示
  - アバター `cleared`
  - `avatars.active_task_id = null`（MVPでは自動で次の `in_progress` は選ばない）

### 7.2 タスクの島割当（`node_key`）

- 生成時に AIチャットが `node_key` を付与（推奨）
- 付与が無い場合の簡易分類（MVP）:
  - `front_island`: "UI", "Next.js", "component", "Tailwind", "shadcn"
  - `backend_island`: "API", "FastAPI", "DB", "schema", "Supabase function"
  - `infra_tower`: "deploy", "Vercel", "Railway", "CI", "logging", "monitoring"
  - `release_castle`: "release", "doc", "QA", "store", "marketing"
- デフォルト: `front_island`

## 8. PixiJS 描画と移動ロジック（MVP）

### 8.1 コンポーネント構成（React側）

```
/components/
  AppShell.tsx                // Header + Main Grid
  PomodoroPanel.tsx
  TaskList.tsx
  ChatSidebar.tsx

  MapCanvas/
    index.tsx                 // dynamic(import, ssr:false)
    usePixiApp.ts             // Pixi Application lifecycle
    MapScene.ts               // ノード/パス/演出の構築
    AvatarSprite.ts           // AnimatedSprite + state machine
    movement.ts               // 経路計算/進行（dt管理）
```

### 8.2 移動（疑似コード / 実装指針）

```typescript
// movement.ts
export function computePath(from: Vec2, waypoints: Vec2[], to: Vec2): Vec2[] {
  // [from, ...waypoints, to] を返すだけ（直線）
  return [from, ...waypoints, to];
}

export function advanceAlongPath(
  current: Vec2, path: Vec2[], speedPxPerSec: number, dtSec: number
): { next: Vec2; arrived: boolean; nextIndex: number } {
  // 現在のセグメントに対して速度ベクトルで前進し、到達判定
  // EPS=0.5px 程度で収束。最後の点に到達したら arrived=true
}
```

### 8.3 Ticker統合

- `Pixi ticker.add((delta) => ...)` で `dtSec = delta / 60` を算出
- React とは `ref` 経由で双方向同期（位置のみPixi主導、DBアップデートは節流）

### 8.4 演出（MVP）

- `done` ノードに 旗スプライトを配置（`visible = task.status === '''done'''`）
- アバター `cleared` で短い 発光アニメ（アルファ/スケールのTween）
- テクスチャ: プレースホルダPNGでOK（将来差し替え）

## 9. React Query / API コントラクト

### 9.1 Query Keys

- `['''tasks''', userId]`
- `['''avatar''', userId]`
- `['''map''', '''linear''']`

### 9.2 Mutations

```typescript
// タスク状態変更
updateTaskStatus({ taskId, status }: { taskId: string; status: TaskStatus })

// タスク作成（AI生成経由もここに集約）
createTask({ title, node_key }: { title: string; node_key: NodeKey })

// アバターの明示的移動（デバッグ用・通常は不要）
setAvatarNode({ node_key }: { node_key: NodeKey })
```

### 9.3 Realtime ハンドラ（擬似）

```typescript
function handleTaskChange(payload) {
  // cache.update(['''tasks''', userId], reconcile)
  // status変更: in_progress → 経路再計算
}

function handleAvatarChange(payload) {
  // cache.update(['''avatar''', userId], ...)
}
```

## 10. UI仕様（TaskList と同時反映）

- TaskListのセレクト変更 → `updateTaskStatus` mutation → DB更新 → Realtime → Map反映
- 反映遅延は 200ms以内（体感即時、Mapperでoptimistic update可）
- TaskList には `node_key` バッジを表示（色分け）

## 11. アクセシビリティ / フォールバック

- MapCanvas が非対応環境: 進捗バー（島順に 0–100%）を表示
- キーボード操作で TaskList 全操作可。マップは視覚補助（必須操作無し）

## 12. パフォーマンス・品質基準

- 60 FPS 目標（中規模テクスチャ・PC/モバイル）
- メモリリーク無し（`app.destroy(true)`、テクスチャ破棄）
- Realtime 購読は `unmount`時に必ず `unsubscribe`

## 13. Feature Flag

- `NEXT_PUBLIC_FEATURE_MAP_RPG = '''on''' | '''off'''`
- `off`なら MapCanvas を非表示、フォールバックのみ。

## 14. 定義済みレイアウト（Tailwind例）

```tsx
// AppShell.tsx の主要レイアウト例
<div className="grid grid-cols-[1fr_320px] grid-rows-[auto_1fr] h-dvh">
  <header className="row-span-1 col-span-2 border-b">
    <div className="flex items-center justify-between gap-4 px-4 py-2">
      <PomodoroPanel />
      <TaskList />
    </div>
  </header>

  <main className="row-span-1 col-span-1 overflow-hidden">
    <MapCanvas />  {/* dynamic import, ssr:false */}
  </main>

  <aside className="row-span-1 col-span-1 border-l overflow-hidden">
    <ChatSidebar />
  </aside>
</div>
```

## 15. 受入条件（Definition of Done）

- タスク状態変更が <1秒 でマップに反映される（Realtime or optimistic）。
- `in_progress` が1件のみであることを DB制約で保証。
- アバターが `in_progress` で 開始→目標ノードに移動する。
- `done` で対象ノードに 旗演出が出る（少なくともスプライトの表示）。
- ページ離脱/再訪問でも アバター位置と 進行状態が復元される。
- Map機能はフラグで 無効化可能（フォールバック動作）。

## 16. テスト計画

- **ユニット（Vitest）**
  - `advanceAlongPath`（端数・dt差異・最終到達）
  - `computePath`（ノード間直線・中継点）
  - タスク状態変換リデューサ（`todo`→`in_progress`→`done`）
- **統合（Playwright）**
  - タスク作成→`node_key` 表示
  - `todo`→`in_progress` でアバターが移動開始（位置が毎秒進む）
  - `done` でノードに旗が出る
  - ページ再読み込みで状態復元
  - RLS: 他ユーザーのレコードが視えないこと（API 403）

## 17. 実装ステップ（推奨順）

1. DBマイグレーション（テーブル / 制約 / RLS）
2. シード投入（固定マップ / ノード / パス）
3. TaskList と Realtime（既存UIに `node_key` 追加）
4. MapCanvas（Pixi）: 背景→ノード→パス→アバター→旗
5. 移動ロジック（`computePath` / `advanceAlongPath`）
6. 受入条件の自動テスト（Vitest / Playwright）

## 18. Codex向け指示テンプレ（そのまま投入可）

- **system（任意）**:
  > You are GPT-5-codex. Generate TypeScript/React code for a Next.js app using Tailwind and shadcn/ui, integrate PixiJS (client-only), and Supabase (Auth, DB, Realtime). Follow the provided spec exactly. Prefer small, focused files. No pseudo-code in final output.

- **user**:
  > # Task
  > Implement the "RPG Map Linked UI" feature per the spec below. Produce:
  > 1) DB migrations (SQL) for Supabase
  > 2) Seed script for map/nodes/paths (TypeScript)
  > 3) React components and hooks (MapCanvas, AvatarSprite, movement)
  > 4) React Query setup and Realtime subscriptions
  > 5) Tailwind layout as described
  > 6) Minimal tests for movement utilities (Vitest)
  >
  > # Constraints
  > - Next.js App Router
  > - MapCanvas is CSR-only via dynamic import
  > - No external Pixi React wrapper; manage Pixi lifecycle with refs/effects
  - Use TypeScript strict
  > - Keep assets as placeholders in /public/assets
  >
  > # Spec
  > <<上記「技術仕様（Codex-ready）」全文をここに貼る>>

## 19. 参考エンドポイント・疑似API（フロントのみで完結可）

- `supabase.from('''tasks''').update({ status }).eq('''id''', taskId)`
- `supabase.from('''avatars''').update({ active_task_id, current_node_key, position_x, position_y })...`
- 初回ログイン時に `avatars` レコードを作成（`start_village`/初期座標）

## 20. 将来拡張のためのフック（設計上の逃げ道）

- **経路**: `paths.waypoints` を増やせば分岐も表現可能
- **マップ自動生成**: `maps` / `map_nodes` をAIで生成→シードに流し込み
- **育成**: `avatars` に `xp`, `level`, `title`, `gear` を後付け可能

---

## 実装ロードマップ（チェックリスト）

- [ ] **ステップ1: データベース設定**
  - [ ] DBマイグレーション（`tasks`, `avatars`, `maps`, `map_nodes`, `paths` テーブル作成）
  - [ ] 部分ユニークインデックスとRLSポリシーを適用
- [ ] **ステップ2: 初期データ投入**
  - [ ] 固定マップ、ノード、パスのシードデータを投入するスクリプトを作成・実行
- [ ] **ステップ3: 既存UIの拡張**
  - [ ] `TaskList` コンポーネントに `node_key` バッジを追加
  - [ ] Supabase Realtime をセットアップし、タスク変更をリッスン
- [ ] **ステップ4: マップ描画**
  - [ ] `MapCanvas` コンポーネントの基本設定（Pixiアプリの初期化）
  - [ ] 背景、ノード、パスを描画
  - [ ] アバターと旗のスプライトを描画
- [ ] **ステップ5: アバターの移動ロジック**
  - [ ] 経路計算（`computePath`）と進行処理（`advanceAlongPath`）を実装
  - [ ] タスク状態の変更（`in_progress`）と連動してアバターを移動させる
- [ ] **ステップ6: テスト**
  - [ ] 移動ロジックのユニットテストを作成 (Vitest)
  - [ ] E2Eテストで一連のフロー（タスク作成→移動→完了）を確認 (Playwright)