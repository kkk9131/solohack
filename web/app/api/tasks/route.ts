import { NextRequest } from 'next/server';
import { addTask, listTasks } from '@/lib/tasksStorage';

export const runtime = 'nodejs';

export async function GET() {
  const tasks = await listTasks();
  return Response.json({ tasks });
}

export async function POST(req: NextRequest) {
  try {
    const { title } = (await req.json()) as { title?: string };
    if (!title || !title.trim()) return new Response('Title required', { status: 400 });
    const task = await addTask(title);
    return Response.json({ task });
  } catch (e: any) {
    return new Response(e?.message ?? 'Bad Request', { status: 400 });
  }
}

