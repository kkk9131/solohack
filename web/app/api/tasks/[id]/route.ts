import { NextRequest } from 'next/server';
import { removeTask, updateTask } from '@/lib/tasksStorage';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return new Response('Invalid id', { status: 400 });
    const patch = (await req.json()) as Partial<{ title: string; completed: boolean; inProgress: boolean; deps: number[] }> & { status?: 'todo'|'in-progress'|'done' };
    // NOTE: statusショートハンドを許容（todo|in-progress|done）
    const status = patch.status as undefined | 'todo' | 'in-progress' | 'done';
    if (status) {
      if (status === 'done') {
        patch.completed = true;
        patch.inProgress = false;
      } else if (status === 'in-progress') {
        patch.completed = false;
        patch.inProgress = true;
      } else {
        patch.completed = false;
        patch.inProgress = false;
      }
    }
    delete (patch as any).status;
    const updated = await updateTask(id, patch as any);
    return Response.json({ task: updated });
  } catch (e: any) {
    return new Response(e?.message ?? 'Bad Request', { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return new Response('Invalid id', { status: 400 });
    await removeTask(id);
    return new Response(null, { status: 204 });
  } catch (e: any) {
    return new Response(e?.message ?? 'Bad Request', { status: 400 });
  }
}
