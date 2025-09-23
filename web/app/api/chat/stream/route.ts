import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

type Payload = {
  prompt: string;
  mode?: 'tech' | 'coach';
  tone?: string;
  assistantName?: string;
  noStream?: boolean;
  apiKey?: string; // 日本語メモ: クライアントからの一時キー（開発用途）。
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
    '以降、毎回の挨拶や自己紹介は不要です。要点を簡潔に述べてください。',
    `モード: ${m}`,
    '',
    prompt,
  ].join('\n');
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const apiKey = (body.apiKey && body.apiKey.trim()) || process.env.SOLOHACK_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return new Response('Missing SOLOHACK_GEMINI_API_KEY/GOOGLE_API_KEY', { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelId = (process.env.SOLOHACK_GEMINI_MODEL || 'gemini-1.5-flash').trim();
    const model = genAI.getGenerativeModel({ model: modelId });
    const prompt = buildPrompt(body);
    let streamResult: any | null = null;
    let canStream = !body.noStream;
    try {
      if (canStream) {
        streamResult = await model.generateContentStream(prompt);
      }
    } catch {
      canStream = false; // 一部モデルはストリーム非対応
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          if (canStream && streamResult?.stream) {
            for await (const chunk of streamResult.stream as any) {
              const t = chunk?.text?.();
              if (t) send({ token: t });
            }
          } else {
            // フォールバック: 非ストリームモデル → まとめて取得し1回で送出
            try {
              const full = await model.generateContent(prompt);
              const text = full?.response?.text?.() ?? '';
              if (text) send({ token: text });
            } catch (e) {
              throw e;
            }
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
