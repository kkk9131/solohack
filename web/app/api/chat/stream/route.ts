import {
  GoogleGenerativeAI,
  type GenerateContentResult,
  type GenerateContentStreamResult,
  type EnhancedGenerateContentResponse,
} from '@google/generative-ai';

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

function parsePayload(value: unknown): Payload {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid payload');
  }
  const record = value as Record<string, unknown>;
  const prompt = typeof record.prompt === 'string' ? record.prompt : '';
  if (!prompt.trim()) {
    throw new Error('Prompt required');
  }
  const mode = record.mode === 'coach' ? 'coach' : record.mode === 'tech' ? 'tech' : undefined;
  const tone = typeof record.tone === 'string' ? record.tone : undefined;
  const assistantName = typeof record.assistantName === 'string' ? record.assistantName : undefined;
  const noStream = record.noStream === true;
  const apiKey = typeof record.apiKey === 'string' ? record.apiKey : undefined;
  return { prompt, mode, tone, assistantName, noStream, apiKey };
}

function safeText(response: EnhancedGenerateContentResponse | undefined): string {
  if (!response) return '';
  try {
    return response.text();
  } catch {
    return '';
  }
}

function extractTextChunks(source: AsyncGenerator<EnhancedGenerateContentResponse>): AsyncGenerator<string> {
  const iterator = source[Symbol.asyncIterator]();
  return {
    async next() {
      const { value, done } = await iterator.next();
      if (done) {
        return { done: true, value: undefined } as const;
      }
      return { done: false, value: safeText(value) };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  } as AsyncGenerator<string>;
}

export async function POST(req: Request) {
  try {
    const body = parsePayload(await req.json());
    const apiKey = (body.apiKey && body.apiKey.trim()) || process.env.SOLOHACK_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return new Response('Missing SOLOHACK_GEMINI_API_KEY/GOOGLE_API_KEY', { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelId = (process.env.SOLOHACK_GEMINI_MODEL || 'gemini-1.5-flash').trim();
    const model = genAI.getGenerativeModel({ model: modelId });
    const prompt = buildPrompt(body);
    let streamResult: GenerateContentStreamResult | null = null;
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
          if (canStream && streamResult) {
            for await (const token of extractTextChunks(streamResult.stream)) {
              if (token) send({ token });
            }
          } else {
            // フォールバック: 非ストリームモデル → まとめて取得し1回で送出
            const full: GenerateContentResult = await model.generateContent(prompt);
            const text = safeText(full.response);
            if (text) send({ token: text });
          }
          // flush
          controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
