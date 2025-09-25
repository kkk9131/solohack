import { NextRequest } from 'next/server';
import { removeTask, updateTask, type WebTask } from '@/lib/tasksStorage';

export const runtime = 'nodejs';

type StatusValue = 'todo' | 'in-progress' | 'done';

type PatchPayload = {
  title?: string;
  completed?: boolean;
  inProgress?: boolean;
  deps?: number[];
  status?: StatusValue;
};

function parsePatch(value: unknown): PatchPayload {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid payload');
  }
  const record = value as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title : undefined;
  const completed = typeof record.completed === 'boolean' ? record.completed : undefined;
  const inProgress = typeof record.inProgress === 'boolean' ? record.inProgress : undefined;
  const deps = Array.isArray(record.deps)
    ? record.deps
        .map((item) => Number(item))
        .filter((num): num is number => Number.isFinite(num))
    : undefined;
  const statusRaw = record.status;
  const status:
    | StatusValue
    | undefined = statusRaw === 'todo' || statusRaw === 'in-progress' || statusRaw === 'done' ? statusRaw : undefined;
  return { title, completed, inProgress, deps, status };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return new Response('Invalid id', { status: 400 });
    const { status, ...raw } = parsePatch(await req.json());
    const patch: Partial<WebTask> = { ...raw };
    // NOTE: statusショートハンドを許容（todo|in-progress|done）
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
    const updated = await updateTask(id, patch);
    return Response.json({ task: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bad Request';
    return new Response(message, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return new Response('Invalid id', { status: 400 });
    await removeTask(id);
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bad Request';
    return new Response(message, { status: 400 });
  }
}
