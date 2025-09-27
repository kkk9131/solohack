"use client";

import DQMapMock from "@/components/DQMapMock";
import type { RoadmapStage } from "@/lib/useTasksController";
import type { WebTask } from "@/lib/tasksStorage";

// 日本語メモ: DQマップ単体プレビュー用のモックデータ。
const sampleTasks: WebTask[] = [
  { id: 1, title: "要件ヒアリングを整理", completed: true, inProgress: false, mapNode: "start" },
  { id: 2, title: "画面ワイヤーの草案作成", completed: false, inProgress: true, mapNode: "front" },
  { id: 3, title: "API スキーマを定義", completed: false, inProgress: true, mapNode: "back" },
  { id: 4, title: "CI チェックを整備", completed: false, inProgress: false, mapNode: "infra" },
  { id: 5, title: "初期リリースノートを準備", completed: false, inProgress: false, mapNode: "release" },
];

const sampleRoadmap: RoadmapStage[] = [
  {
    order: 1,
    title: "Kickoff & 要件整理",
    summary: "プロジェクトの目的と優先度を固める",
    mapNode: "start",
    tasks: ["要件ヒアリングを整理"],
  },
  {
    order: 2,
    title: "UI プロト設計",
    summary: "UXを検証するためのワイヤーを整備",
    mapNode: "front",
    tasks: ["画面ワイヤーの草案作成"],
  },
  {
    order: 3,
    title: "API 実装準備",
    summary: "必要なエンドポイントを洗い出し",
    mapNode: "back",
    tasks: ["API スキーマを定義"],
  },
  {
    order: 4,
    title: "CI & リリース準備",
    summary: "デプロイとリリース情報を用意",
    mapNode: "infra",
    tasks: ["CI チェックを整備", "初期リリースノートを準備"],
  },
];

export default function DashboardDQPreviewPage() {
  const completion = sampleTasks.length === 0
    ? 0
    : Math.round((sampleTasks.filter((task) => task.completed).length / sampleTasks.length) * 100);

  return (
    <div className="min-h-dvh bg-bg text-white">
      <DQMapMock tasks={sampleTasks} roadmap={sampleRoadmap} loading={false} completion={completion} />
    </div>
  );
}
