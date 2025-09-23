import { GoogleGenerativeAI } from '@google/generative-ai';
import { listTasks, upsertDependencies } from '@/lib/tasksStorage';

export const runtime = 'nodejs';

function buildDepsPrompt(tasks: { id: number; title: string }[]) {
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
    let parsed: any = null;
    try {
      // NOTE: コードブロックで返る場合に備えて抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      // 解析失敗時は空依存
      parsed = { dependencies: {} };
    }
    const deps: Record<number, number[]> = Object.fromEntries(
      Object.entries(parsed?.dependencies ?? {}).map(([k, v]) => [Number(k), Array.isArray(v) ? v.map((n: any) => Number(n)).filter((x: any) => Number.isFinite(x)) : []]),
    );
    await upsertDependencies(deps);
    return Response.json({ dependencies: deps });
  } catch (e: any) {
    return new Response(e?.message ?? 'Error', { status: 500 });
  }
}
