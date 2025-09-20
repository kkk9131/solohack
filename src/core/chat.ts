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
  tone?: string; // 日本語メモ: 口調のプリセット（例: "丁寧・前向き・簡潔"）
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
   * 指示に沿った日本語プロンプトを構築。
   * - あなたの名前は「…」です
   * - 良きパートナーとして回答
   * - スタイルは「…」（例: 妹のような感じで）
   * - わからない場合は「わかりません」
   * - モード: tech|coach
   */
  private buildPrompt(question: string): string {
    const name = this.config.assistantName ?? 'SoloBuddy';
    const tone = this.config.tone ?? '丁寧・前向き・簡潔';
    const mode = this.config.mode ?? 'tech';
    return [
      `あなたの名前は「${name}」です。`,
      'ユーザーが行なっているプロジェクトを遂行する良きパートナーとして回答を述べてください。',
      `スタイルは「${tone}」（例: 妹のような感じで）で親しく接してください。`,
      'また、わからない場合はハルシネーションをできるだけ下げるため「わかりません」と回答してください。',
      `モード: ${mode}`,
      '',
      question,
    ].join('\n');
  }

  /**
   * ask: 質問文字列を渡して応答テキストを受け取る。
   * - 将来は system/assistant の役割分担やメモリの持ち方も拡張予定。
   */
  async ask(question: string): Promise<string> {
    // 日本語メモ: 実APIはコストがかかるため、CI/ユニットテストではモック化推奨。
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = this.buildPrompt(question);
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.();
    return text ?? 'No response text available.';
  }

  /**
   * askStream: 応答をストリーミングで逐次受け取り、chunkテキストをコールバックに渡す。
   */
  async askStream(
    question: string,
    onChunk: (text: string) => void | Promise<void>,
  ): Promise<void> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = this.buildPrompt(question);
    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      const t = (chunk as any)?.text?.();
      if (t) await onChunk(t);
    }
    // 最終レスポンスの完了を待つ（不要なら省略可）
    await result.response;
  }
}
