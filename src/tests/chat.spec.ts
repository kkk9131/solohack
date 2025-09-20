import { describe, it, expect, vi, beforeEach } from 'vitest';

// 日本語メモ: openai クライアントをモックし、API呼び出しをスタブする。
class MockResponses {
  create = vi.fn().mockResolvedValue({ output_text: 'Mocked answer' });
}

class MockOpenAI {
  responses = new MockResponses();
  constructor(_: unknown) {}
}

vi.mock('openai', () => ({
  default: MockOpenAI,
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

