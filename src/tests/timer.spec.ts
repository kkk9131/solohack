import { describe, expect, it } from 'vitest';
import { PomodoroTimer } from '../core/timer.js';

// 日本語メモ: tick() で時間を手動進行させるため、時間依存テストでも安定。
describe('PomodoroTimer', () => {
  it('resets to idle when stopped', () => {
    const timer = new PomodoroTimer(1);
    timer.start();
    timer.stop();

    const state = timer.tick();

    // 日本語メモ: stop()後でもtick()が安全に呼べることを確認。
    expect(state.state).toBe('idle');
    expect(state.remainingSeconds).toBe(60);
  });

  it('ticks down when running', () => {
    const timer = new PomodoroTimer(1); // 60秒
    timer.start();
    const s1 = timer.tick();
    expect(s1.state).toBe('running');
    expect(s1.remainingSeconds).toBe(59);
  });

  it('becomes idle when reaching zero', () => {
    const timer = new PomodoroTimer(0); // 0秒
    timer.start();
    const s = timer.tick();
    expect(s.remainingSeconds).toBe(0);
    expect(s.state).toBe('idle');
  });
});
