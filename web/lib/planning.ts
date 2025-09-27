import {
  MAP_NODE_KEYS,
  type MapNodeKey,
  type RequirementsSession,
} from './tasksStorage';

export type PlannerTask = {
  title: string;
  mapNode?: MapNodeKey;
  summary?: string;
  note?: string;
};

export type PlannerRoadmapStage = {
  order: number;
  title: string;
  summary: string;
  mapNode?: MapNodeKey;
  tasks: string[];
};

export const MAP_NODE_GUIDELINES: Record<MapNodeKey, string> = {
  start: '構想/準備/要件整理のタスク',
  front: 'UI・UX・フロントエンドのタスク',
  back: 'APIやサーバー・データ処理のタスク',
  infra: 'CI/CD、デプロイ、監視など基盤系タスク',
  release: 'リリース・品質保証・アセット最終化など仕上げタスク',
};

export function buildGenerationPrompt(session: RequirementsSession): string {
  const conversation = formatConversation(session);
  const mapNodeRules = Object.entries(MAP_NODE_GUIDELINES)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const summary = session.summary.trim() || '(no summary captured)';
  const conversationBlock = conversation.trim() || '(no conversation history)';

  return [
    'You are an AI project planner for a solo developer. Using the stored requirement summary and discovery chat,',
    'produce a concise implementation plan for the SoloHack dashboard MVP.',
    'Output strict JSON only, matching this TypeScript schema (no comments, no code fences):',
    '{"tasks": Array<{"title": string; "mapNode": "start"|"front"|"back"|"infra"|"release"; "summary"?: string; "note"?: string;}>,',
    ' "roadmap": Array<{"order": number; "title": string; "summary": string; "mapNode": "start"|"front"|"back"|"infra"|"release"; "tasks": string[] }> }',
    'Rules:',
    '- Provide 5〜7 actionable tasks, each <= 60 characters.',
    '- Choose mapNode based on the domain focus:\n' + mapNodeRules,
    '- Roadmap should have 3〜4 sequential stages. order is 1-based.',
    '- Roadmap.tasks must reference task titles exactly.',
    '- Focus on concrete shipping steps for the SoloHack requirements.',
    '',
    'Requirement Summary:\n' + summary,
    '',
    'Conversation Log:\n' + conversationBlock,
  ].join('\n\n');
}

export function formatConversation(session: RequirementsSession): string {
  return session.conversation
    .slice(-12)
    .map((entry, index) => {
      const role = entry.role.toUpperCase();
      return `${index + 1}. ${role}: ${entry.content.trim()}`;
    })
    .join('\n');
}

export function parseGenerationResponse(text: string): {
  tasks: PlannerTask[];
  roadmap: PlannerRoadmapStage[];
} {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : text;
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const tasksRaw = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const roadmapRaw = Array.isArray(parsed.roadmap) ? parsed.roadmap : [];

    const tasks = tasksRaw
      .map((value) => {
        if (!value || typeof value !== 'object') return undefined;
        const record = value as Record<string, unknown>;
        const title = typeof record.title === 'string' ? record.title.trim() : '';
        if (!title) return undefined;
        const mapNode = normalizeMapNode(record.mapNode);
        const summary = typeof record.summary === 'string' ? record.summary.trim() : undefined;
        const note = typeof record.note === 'string' ? record.note.trim() : undefined;
        const task: PlannerTask = { title, mapNode, summary, note };
        return task;
      })
      .filter((task): task is PlannerTask => Boolean(task));

    const roadmap = roadmapRaw
      .map((value, index) => {
        if (!value || typeof value !== 'object') return undefined;
        const record = value as Record<string, unknown>;
        const title = typeof record.title === 'string' ? record.title.trim() : '';
        const summary = typeof record.summary === 'string' ? record.summary.trim() : '';
        const orderRaw = record.order ?? record.stage ?? record.sequence;
        const order = typeof orderRaw === 'number' && Number.isFinite(orderRaw) ? Math.max(1, Math.floor(orderRaw)) : index + 1;
        const mapNode = normalizeMapNode(record.mapNode);
        const tasksList = Array.isArray(record.tasks)
          ? record.tasks
              .map((item) => (typeof item === 'string' ? item.trim() : ''))
              .filter((item) => item.length > 0)
          : [];
        if (!title && !summary && tasksList.length === 0) return undefined;
        const stage: PlannerRoadmapStage = { order, title, summary, mapNode, tasks: tasksList };
        return stage;
      })
      .filter((stage): stage is PlannerRoadmapStage => Boolean(stage))
      .sort((a, b) => a.order - b.order);

    return { tasks, roadmap };
  } catch {
    return { tasks: [], roadmap: [] };
  }
}

export function normalizeMapNode(value: unknown): MapNodeKey | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return MAP_NODE_KEYS.find((key) => key === normalized);
}
