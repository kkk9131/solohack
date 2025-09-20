import { describe, it, expect, vi, beforeEach } from 'vitest';

// 日本語メモ: Gemini クライアントをモックし、API呼び出しをスタブする。
class MockModel {
  generateContent = vi.fn().mockResolvedValue({
    response: { text: () => 'Mocked answer' },
  });
  generateContentStream = vi.fn().mockResolvedValue({
    stream: (async function* () {
      yield { text: () => 'Hello ' };
      yield { text: () => 'World' };
    })(),
    response: Promise.resolve({ text: () => 'Hello World' }),
  });
}

class MockGeminiClient {
  constructor(_: unknown) {}
  getGenerativeModel() {
    return new MockModel();
  }
}

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: MockGeminiClient,
}));

describe('ChatClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns output_text from mocked OpenAI', async () => {
    const { ChatClient } = await import('../core/chat.js');
    const chat = new ChatClient({ apiKey: 'test-key', mode: 'tech' });
    const res = await chat.ask('Hello?');
    expect(res).toBe('Mocked answer');
  });

  it('streams chunks via askStream', async () => {
    const { ChatClient } = await import('../core/chat.js');
    const chat = new ChatClient({ apiKey: 'test-key', mode: 'tech' });
    const chunks: string[] = [];
    await chat.askStream('Hi', (t) => { chunks.push(t); });
    expect(chunks.join('')).toBe('Hello World');
  });

  it('uses assistantName and default mode when not provided', async () => {
    const { ChatClient } = await import('../core/chat.js');
    const chat = new ChatClient({ apiKey: 'test-key', assistantName: 'Kaz' });
    const res = await chat.ask('Hello?');
    expect(res).toBe('Mocked answer');
  });
});
