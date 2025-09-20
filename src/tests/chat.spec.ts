import { describe, it, expect, vi, beforeEach } from 'vitest';

// 日本語メモ: Gemini クライアントをモックし、API呼び出しをスタブする。
class MockModel {
  generateContent = vi.fn().mockResolvedValue({
    response: { text: () => 'Mocked answer' },
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
});
