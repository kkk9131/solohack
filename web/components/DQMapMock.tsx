"use client";

import { type CSSProperties, useMemo, useState } from "react";
import type { WebTask } from "@/lib/tasksStorage";
import { dependencyLayers, groupByStatus, inferStatus } from "@/lib/taskGrouping";

type CommandKey = "tasks" | "pomo" | "records";

type CommandConfig = {
  key: CommandKey;
  label: string;
};

type NodeKey = "start" | "front" | "back" | "infra" | "release";

type NodeConfig = {
  key: NodeKey;
  label: string;
  top: string;
  left: string;
};

const commandList: CommandConfig[] = [
  { key: "tasks", label: "タスク" },
  { key: "pomo", label: "ポモ" },
  { key: "records", label: "レコード" },
];

const nodeList: NodeConfig[] = [
  { key: "start", label: "はじまりの村", top: "62%", left: "14%" },
  { key: "front", label: "フロントの島", top: "48%", left: "33%" },
  { key: "back", label: "バックの島", top: "44%", left: "51%" },
  { key: "infra", label: "インフラの塔", top: "32%", left: "68%" },
  { key: "release", label: "リリース城", top: "26%", left: "86%" },
];

const nodeKeyOrder: NodeKey[] = nodeList.map((node) => node.key);
const statusFallback: Record<"todo" | "in-progress" | "done", NodeKey> = {
  todo: "start",
  "in-progress": "front",
  done: "release",
};

type DQMapMockProps = {
  tasks: WebTask[];
  loading: boolean;
  completion: number;
};

export default function DQMapMock({ tasks, loading, completion }: DQMapMockProps) {
  // 日本語メモ: DQ風ダッシュボードの雰囲気を掴むためのモック。コマンド選択をローカル状態で疑似再現する。
  const [selectedCommand, setSelectedCommand] = useState<CommandKey>("tasks");
  const [detailVisible, setDetailVisible] = useState(true);
  const [statusVisible, setStatusVisible] = useState(true);
  const [commandVisible, setCommandVisible] = useState(true);
  const [messageVisible, setMessageVisible] = useState(true);

  const statusGroups = useMemo(() => groupByStatus(tasks), [tasks]);
  const layers = useMemo(() => dependencyLayers(tasks), [tasks]);
  const layerIndexByTask = useMemo(() => {
    const map = new Map<number, number>();
    layers.forEach((layer, index) => {
      layer.forEach((task) => map.set(task.id, index));
    });
    return map;
  }, [layers]);
  const totalTasks = tasks.length;
  const doneTasks = statusGroups["done"].length;
  const inProgressTasks = statusGroups["in-progress"].length;
  const todoTasks = statusGroups["todo"].length;
  const focusGauge = useMemo(() => {
    // 日本語メモ: 6分割の簡易ゲージ。進捗率が0-100%に収まっていなくても丸めて描画。
    const totalBars = 6;
    const clamped = Math.max(0, Math.min(100, Math.round(completion)));
    const filled = Math.min(totalBars, Math.round((clamped / 100) * totalBars));
    const empty = Math.max(0, totalBars - filled);
    return `${"█".repeat(filled)}${"░".repeat(empty)}`;
  }, [completion]);

  const tasksByNode = useMemo(() => {
    const buckets = Object.fromEntries(
      nodeKeyOrder.map((key) => [key, [] as WebTask[]]),
    ) as Record<NodeKey, WebTask[]>;

    for (const task of tasks) {
      const layerIndex = layerIndexByTask.get(task.id);
      let nodeKey: NodeKey;
      if (layerIndex != null) {
        const clamped = Math.min(layerIndex, nodeKeyOrder.length - 1);
        nodeKey = nodeKeyOrder[clamped] ?? nodeKeyOrder[nodeKeyOrder.length - 1];
      } else if (layers.length === 0) {
        const fallback = statusFallback[inferStatus(task)];
        nodeKey = fallback ?? nodeKeyOrder[0];
      } else {
        nodeKey = nodeKeyOrder[0];
      }
      buckets[nodeKey].push(task);
    }

    for (const list of Object.values(buckets)) {
      list.sort((a, b) => a.id - b.id);
    }

    return buckets;
  }, [tasks, layerIndexByTask, layers.length]);

  const renderTasksDetail = () => {
    // 日本語メモ: タスク状態と依存レイヤーをDQ風メッセージに要約して表示する。
    if (loading) {
      return <div>タスク同期中...</div>;
    }
    if (totalTasks === 0) {
      return <div>タスクがありません。コマンドで追加しましょう。</div>;
    }

    return (
      <>
        <div>
          合計 {totalTasks} 件 / 完了 {doneTasks} 件 ({completion}%)
        </div>
        <div>実行中 {inProgressTasks} 件 / 未着手 {todoTasks} 件</div>
        {layers.length === 0 ? (
          <div className="mt-2 text-xs">依存関係データはまだありません。</div>
        ) : (
          <div className="mt-2 space-y-1 text-xs leading-relaxed">
            {layers.map((layer, index) => {
              const titles = layer.map((task) => task.title);
              const preview = titles.slice(0, 3).join("、");
              const suffix = titles.length > 3 ? "、…" : "";
              return (
                <div key={`stage-${index}`} className="flex gap-2">
                  <span className="text-[var(--dq-gold)] whitespace-nowrap">
                    Stage {index + 1}
                  </span>
                  <span className="flex-1 truncate">
                    {titles.length === 0 ? "(なし)" : `${preview}${suffix}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-2 space-y-1 text-xs leading-relaxed">
          {nodeList.map((node) => (
            <div key={`node-summary-${node.key}`} className="flex gap-2">
              <span className="text-[var(--dq-gold)] whitespace-nowrap">
                {node.label}
              </span>
              <span className="flex-1 truncate">
                {tasksByNode[node.key].length === 0
                  ? "待機中"
                  : `${tasksByNode[node.key].length} 件配置`}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  };

  const detailContent = (() => {
    switch (selectedCommand) {
      case "tasks":
        return renderTasksDetail();
      case "pomo":
        return (
          <>
            <div>・次のセッション 25:00</div>
            <div>・完了ポモ 2 / 目標 4</div>
            <div>・リカバリまで 05:00</div>
          </>
        );
      case "records":
      default:
        return (
          <>
            <div>・連続達成 5日</div>
            <div>・週完了ミッション 12件</div>
            <div>・最速タスク 15分</div>
          </>
        );
    }
  })();

  const themeStyle = useMemo<CSSProperties>(
    () =>
      ({
        "--dq-blue": "#0d1424",
        "--dq-gold": "#00d8ff",
        "--dq-black": "#05080f",
        "--dq-white": "#e6faff",
        "--dq-red": "#ff4d80",
      }) as CSSProperties,
    [],
  );

  const windowClass =
    "bg-[var(--dq-blue)] text-[var(--dq-white)] border-4 border-[var(--dq-gold)] shadow-[0_6px_0_var(--dq-black)] rounded-none";

  const commandButtonClass =
    "flex-1 px-4 py-2 border-2 border-[var(--dq-gold)] text-[var(--dq-white)] font-pixel text-sm tracking-wide transition-colors";

  return (
    <section
      className="relative w-full min-h-[28rem] lg:min-h-[32rem] flex flex-col items-center justify-center overflow-hidden"
      style={themeStyle}
    >
      <div className="relative w-full max-w-6xl flex-1 flex items-center justify-center py-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #132c38 0px, #132c38 16px, #101d2f 16px, #101d2f 32px), repeating-linear-gradient(90deg, #132c38 0px, #132c38 16px, #101d2f 16px, #101d2f 32px)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 40%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.18), transparent 30%)",
          }}
          aria-hidden
        />

        <div className="relative w-[92%] h-[78%] border-4 border-[var(--dq-gold)] bg-[#091225]/90 shadow-[0_12px_0_var(--dq-black)]">
          <div className="absolute inset-0">
            <div className="absolute left-[18%] right-[16%] top-[58%] h-5 bg-[#1b9dd4] shadow-[0_3px_0_rgba(0,0,0,0.35)]" />
            <div className="absolute left-[32%] top-[40%] h-[22%] w-5 bg-[#1b9dd4] shadow-[3px_0_0_rgba(0,0,0,0.35)]" />
            <div className="absolute left-[50%] top-[34%] h-[28%] w-5 bg-[#1b9dd4] shadow-[3px_0_0_rgba(0,0,0,0.35)]" />
            <div className="absolute left-[66%] top-[28%] h-[24%] w-5 bg-[#1b9dd4] shadow-[3px_0_0_rgba(0,0,0,0.35)]" />
          </div>

          {nodeList.map((node) => (
            <div
              key={node.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
              style={{ top: node.top, left: node.left }}
            >
              <div className="w-16 h-16 bg-[#0c2f4a] border-4 border-[var(--dq-gold)] shadow-[0_6px_0_var(--dq-black)]" />
              <div
                className="px-3 py-1 bg-[var(--dq-blue)] border-2 border-[var(--dq-gold)] text-xs font-pixel"
                style={{ textShadow: "2px 2px 0 var(--dq-black)" }}
              >
                {node.label}
              </div>
              {tasksByNode[node.key].length > 0 && (
                <div
                  className="w-40 px-3 py-2 bg-[rgba(0,216,255,0.12)] border-2 border-[var(--dq-gold)] text-[11px] font-pixel text-left space-y-1"
                  style={{ textShadow: "1px 1px 0 var(--dq-black)" }}
                >
                  {tasksByNode[node.key].slice(0, 3).map((task) => (
                    <div key={`${node.key}-${task.id}`} className="truncate">
                      ・{task.title}
                    </div>
                  ))}
                  {tasksByNode[node.key].length > 3 && (
                    <div className="text-[10px] text-[var(--dq-gold)]">
                      他 {tasksByNode[node.key].length - 3} 件
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="absolute left-[16%] top-[42%] w-20 h-20 bg-[url('/avatars/default/idle.png')] bg-contain bg-no-repeat" />
          <div className="absolute left-[28%] top-[34%] w-16 h-16 bg-[url('/avatars/default/celebrate.png')] bg-contain bg-no-repeat opacity-80" />
          {messageVisible && (
            <div className="absolute right-10 bottom-12 flex flex-col items-end gap-2">
              <div
                className="px-3 py-1 bg-[rgba(0,216,255,0.12)] border-2 border-[var(--dq-gold)] font-pixel text-xs text-[var(--dq-white)]"
                style={{ textShadow: "2px 2px 0 var(--dq-black)" }}
              >
                ソロハック進行中！
              </div>
            </div>
          )}
        </div>

        {statusVisible && (
          <div
            className={`${windowClass} absolute left-10 bottom-28 w-72 px-5 py-4 flex flex-col gap-2 font-pixel text-sm`}
            style={{ textShadow: "2px 2px 0 var(--dq-black)" }}
          >
            <div className="text-lg">勇者 かずと</div>
            <div>完了タスク: {doneTasks}/{totalTasks}</div>
            <div>実行中: {inProgressTasks} / 未着手: {todoTasks}</div>
            <div>集中ゲージ: {focusGauge}</div>
          </div>
        )}

        {commandVisible && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
            <div className={`${windowClass} w-[540px] px-4 py-3`}>
              <div className="flex items-center gap-3">
                {commandList.map((item) => {
                  const isActive = item.key === selectedCommand;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setDetailVisible((prev) => !prev);
                          return;
                        }
                        setSelectedCommand(item.key);
                        setDetailVisible(true);
                      }}
                      className={`${commandButtonClass} ${
                        isActive
                          ? "bg-[rgba(0,216,255,0.18)] border-[var(--dq-gold)]"
                          : "bg-[#0a1d2c]"
                      }`}
                      style={{ textShadow: "2px 2px 0 var(--dq-black)" }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {detailVisible && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2">
            <div
              className={`${windowClass} w-[520px] px-5 py-4 font-pixel text-sm space-y-1`}
              style={{ textShadow: "2px 2px 0 var(--dq-black)" }}
            >
              {detailContent}
              <div className="animate-pulse text-right">▶︎</div>
            </div>
          </div>
        )}

        <div
          className={`${windowClass} absolute bottom-8 right-8 w-60 px-4 py-3 font-pixel text-xs space-y-2`}
          style={{ textShadow: "2px 2px 0 var(--dq-black)" }}
        >
          <div className="text-sm">ウィンドウ表示</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatusVisible((prev) => !prev)}
              className={`px-2 py-1 border border-[var(--dq-gold)] ${statusVisible ? "bg-[rgba(0,216,255,0.18)]" : "bg-[#0a1d2c]"}`}
            >
              ステータス
            </button>
            <button
              type="button"
              onClick={() => setCommandVisible((prev) => !prev)}
              className={`px-2 py-1 border border-[var(--dq-gold)] ${commandVisible ? "bg-[rgba(0,216,255,0.18)]" : "bg-[#0a1d2c]"}`}
            >
              コマンド
            </button>
            <button
              type="button"
              onClick={() => setDetailVisible((prev) => !prev)}
              className={`px-2 py-1 border border-[var(--dq-gold)] ${detailVisible ? "bg-[rgba(0,216,255,0.18)]" : "bg-[#0a1d2c]"}`}
            >
              メッセージ
            </button>
            <button
              type="button"
              onClick={() => setMessageVisible((prev) => !prev)}
              className={`px-2 py-1 border border-[var(--dq-gold)] ${messageVisible ? "bg-[rgba(0,216,255,0.18)]" : "bg-[#0a1d2c]"}`}
            >
              バルーン
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
