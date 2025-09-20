import { GoogleGenerativeAI } from '@google/generative-ai';

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
 * ChatClient: Gemini を最小限にラップ。
 * 日本語メモ:
 * - コスト最適化のため、テストでは API 呼び出しをモック化します。
 * - ストリーミング表示は CLI 層での対応が必要（本クラスは同期的に文字列を返す）。
 */
export class ChatClient {
  private genAI: GoogleGenerativeAI;
  private config: ChatConfig;

  constructor(config: ChatConfig) {
    if (!config.apiKey) {
      throw new Error('Gemini API key is required for chat operations.');
    }

    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.config = config;
  }

  /**
   * ask: 質問文字列を渡して応答テキストを受け取る。
   * - 将来は system/assistant の役割分担やメモリの持ち方も拡張予定。
   */
  async ask(question: string): Promise<string> {
    // 日本語メモ: 実APIはコストがかかるため、CI/ユニットテストではモック化推奨。
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const persona = this.config.assistantName ? `Assistant: ${this.config.assistantName}` : 'Assistant: SoloBuddy';
    const mode = this.config.mode ?? 'tech';
    const prompt = `${persona}\nMode: ${mode}\n\n${question}`;
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.();
    return text ?? 'No response text available.';
  }
}
