import { NextRequest } from 'next/server';
import { getRequirements, saveRequirementsSession, RequirementsMessage } from '@/lib/tasksStorage';

export const runtime = 'nodejs';

function normalizeConversationPayload(value: unknown): RequirementsMessage[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<RequirementsMessage['role']>(['user', 'ai', 'system']);
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return undefined;
      const record = entry as Record<string, unknown>;
      const role = typeof record.role === 'string' && allowed.has(record.role as RequirementsMessage['role'])
        ? (record.role as RequirementsMessage['role'])
        : undefined;
      const content = typeof record.content === 'string' ? record.content : '';
      if (!role || !content.trim()) return undefined;
      return { role, content };
    })
    .filter((item): item is RequirementsMessage => Boolean(item));
}

export async function GET() {
  const requirements = await getRequirements();
  return Response.json({ requirements });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const summary = typeof body?.summary === 'string' ? body.summary : '';
    const conversation = normalizeConversationPayload(body?.conversation);
    // 日本語メモ: 空配列や空文字はストレージで弾かれるので、try-catch 外で発生させる
    const saved = await saveRequirementsSession({ summary, conversation });
    return Response.json({ requirements: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bad Request';
    return new Response(message, { status: 400 });
  }
}
