import type { ClientOptions } from 'openai';
import OpenAI from 'openai';

/**
 * ChatConfig: OpenAI クライアントの設定。
 * - apiKey: 必須。`.env` の SOLOHACK_OPENAI_KEY を想定。
 * - assistantName: 任意。応答スタイルなどに反映する拡張余地。
 * - mode: 'tech' | 'coach'（プロンプトにモードを埋め込む簡易切替）
 */
export interface ChatConfig {
  apiKey?: string;
  assistantName?: string;
  mode?: 'tech' | 'coach';
}

/**
 * ChatClient: OpenAI の Responses API を最小限にラップ。
 * 日本語メモ:
 * - コスト最適化のため、テストでは API 呼び出しをモック化します。
 * - ストリーミング表示は CLI 層での対応が必要（本クラスは同期的に文字列を返す）。
 */
export class ChatClient {
  private openai: OpenAI;
  private config: ChatConfig;

  constructor(config: ChatConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required for chat operations.');
    }

    const options: ClientOptions = {
      apiKey: config.apiKey,
    };

    this.openai = new OpenAI(options);
    this.config = config;
  }

  /**
   * ask: 質問文字列を渡して応答テキストを受け取る。
   * - 将来は system/assistant の役割分担やメモリの持ち方も拡張予定。
   */
  async ask(question: string): Promise<string> {
    // 日本語メモ: 実APIはコストがかかるため、CI/ユニットテストではモック化推奨。
    const response = await this.openai.responses.create({
      model: 'gpt-4o-mini',
      input: `Mode: ${this.config.mode ?? 'tech'}\n${question}`,
    });

    return response.output_text ?? 'No response text available.';
  }
}
