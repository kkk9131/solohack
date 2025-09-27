import { GoogleGenerativeAI } from '@google/generative-ai';
import { getRequirements, replaceTasksWithGenerated } from '@/lib/tasksStorage';
import { buildGenerationPrompt, parseGenerationResponse } from '@/lib/planning';

export const runtime = 'nodejs';

const DEFAULT_MODEL = (process.env.SOLOHACK_GEMINI_MODEL || 'gemini-1.5-flash').trim();

export async function POST() {
  try {
    const requirements = await getRequirements();
    if (!requirements) {
      return new Response('Requirements session not found', { status: 400 });
    }

    const apiKey = process.env.SOLOHACK_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      // 日本語メモ: APIキー未設定時は既存タスクを書き換えず空レスポンスを返す
      return Response.json({ tasks: [], roadmap: [], skipped: 'missing_api_key' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
    const prompt = buildGenerationPrompt(requirements);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseGenerationResponse(text);

    if (parsed.tasks.length === 0) {
      return new Response('Failed to extract tasks from AI response', { status: 502 });
    }

    const seeds = parsed.tasks.map((task) => ({ title: task.title, mapNode: task.mapNode }));
    const savedTasks = await replaceTasksWithGenerated(seeds);

    return Response.json({ tasks: savedTasks, roadmap: parsed.roadmap });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return new Response(message, { status: 500 });
  }
}
