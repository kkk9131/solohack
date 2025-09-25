import { GoogleGenerativeAI } from '@google/generative-ai';
import { listTasks, upsertDependencies } from '@/lib/tasksStorage';

export const runtime = 'nodejs';

type TaskSummary = { id: number; title: string };

function buildDepsPrompt(tasks: TaskSummary[]) {
  const catalog = tasks.map((t) => `- ${t.id}: ${t.title}`).join('\n');
  return [
    'You are a task dependency analyzer. Given a list of tasks (id and title),',
    'infer a plausible dependency graph for execution order. Output strict JSON only with this shape:',
    '{"dependencies": {"<id>": [<id>, ...], ... }}.\n',
    '- Only use provided ids.\n- Keep it acyclic.\n- If a task has no prerequisites, use an empty array.\n',
    'Tasks:\n' + catalog,
  ].join('\n');
}

export async function POST() {
  try {
    const tasks = (await listTasks()).map((t) => ({ id: t.id, title: t.title }));
    if (tasks.length === 0) return Response.json({ dependencies: {} });

    const apiKey = process.env.SOLOHACK_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      // 日本語メモ: APIキーなし時は依存無しで返す
      return Response.json({ dependencies: {} });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelId = (process.env.SOLOHACK_GEMINI_MODEL || 'gemini-1.5-flash').trim();
    const model = genAI.getGenerativeModel({ model: modelId });
    const prompt = buildDepsPrompt(tasks);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const deps = parseDependenciesFromText(text);
    await upsertDependencies(deps);
    return Response.json({ dependencies: deps });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return new Response(message, { status: 500 });
  }
}

function parseDependenciesFromText(text: string): Record<number, number[]> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : text;
  try {
    const parsed = JSON.parse(candidate) as { dependencies?: Record<string, unknown> };
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const dependencies = parsed.dependencies;
    if (!dependencies || typeof dependencies !== 'object') {
      return {};
    }
    const result: Record<number, number[]> = {};
    for (const [key, value] of Object.entries(dependencies)) {
      const taskId = Number(key);
      if (!Number.isFinite(taskId)) continue;
      if (!Array.isArray(value)) {
        result[taskId] = [];
        continue;
      }
      const normalized = value
        .map((item) => Number(item))
        .filter((dep): dep is number => Number.isFinite(dep));
      const unique = Array.from(new Set(normalized)).filter((dep) => dep !== taskId);
      result[taskId] = unique;
    }
    return result;
  } catch {
    return {};
  }
}
