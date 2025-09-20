// 日本語メモ: シンプルなポモドーロ用タイマー。実時間は setInterval 等に繋げず、
// tick() を明示的に呼び出して1秒進める「テストしやすい設計」にしている。
export type TimerState = 'idle' | 'running' | 'paused';

export interface TimerTick {
  remainingSeconds: number;
  state: TimerState;
}

/**
 * PomodoroTimer
 * - start(): セッション開始（既に running なら無視）
 * - stop(): セッション停止＆初期値にリセット
 * - tick(): 1秒だけ経過させる（stateに応じて何もしないこともある）
 */
export class PomodoroTimer {
  private durationSeconds: number;
  private remainingSeconds: number;
  private state: TimerState = 'idle';

  constructor(durationMinutes = 25) {
    this.durationSeconds = durationMinutes * 60;
    this.remainingSeconds = this.durationSeconds;
  }

  start(): void {
    if (this.state === 'running') {
      return;
    }
    this.state = 'running';
    this.remainingSeconds = this.durationSeconds;
  }

  stop(): void {
    this.state = 'idle';
    this.remainingSeconds = this.durationSeconds;
  }

  /**
   * 1秒だけ進める。running 以外は現在値をそのまま返す。
   */
  tick(): TimerTick {
    if (this.state !== 'running') {
      return {
        remainingSeconds: this.remainingSeconds,
        state: this.state,
      };
    }

    this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
    if (this.remainingSeconds === 0) {
      this.state = 'idle';
    }

    return {
      remainingSeconds: this.remainingSeconds,
      state: this.state,
    };
  }
}

// 日本語メモ: 将来的には setInterval とイベント発火でUI層に通知する構造に変更予定。
