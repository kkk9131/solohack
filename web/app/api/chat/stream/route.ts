import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

type Payload = {
  prompt: string;
  mode?: 'tech' | 'coach';
  tone?: string;
  assistantName?: string;
};

function buildPrompt({ prompt, mode, tone, assistantName }: Payload) {
  const name = assistantName ?? 'SoloBuddy';
  const style = tone ?? '丁寧・前向き・簡潔';
  const m = mode ?? 'tech';
  return [
    `あなたの名前は「${name}」です。`,
    'ユーザーが行なっているプロジェクトを遂行する良きパートナーとして回答を述べてください。',
    `スタイルは「${style}」で親しく接してください。`,
    'わからない場合は「わかりません」と正直に回答してください。',
    `モード: ${m}`,
    '',
    prompt,
  ].join('\n');
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const apiKey = process.env.SOLOHACK_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return new Response('Missing SOLOHACK_GEMINI_API_KEY/GOOGLE_API_KEY', { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = buildPrompt(body);
    const result = await model.generateContentStream(prompt);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          for await (const chunk of result.stream as any) {
            const t = chunk?.text?.();
            if (t) send({ token: t });
          }
          // flush
          controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (e: any) {
    return new Response(`Error: ${e?.message ?? 'unknown'}`, { status: 500 });
  }
}

