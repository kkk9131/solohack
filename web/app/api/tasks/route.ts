import { NextRequest } from 'next/server';
import { addTask, listTasks } from '@/lib/tasksStorage';

export const runtime = 'nodejs';

export async function GET() {
  const tasks = await listTasks();
  return Response.json({ tasks });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return new Response('Title required', { status: 400 });
    const task = await addTask(title);
    return Response.json({ task });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bad Request';
    return new Response(message, { status: 400 });
  }
}
