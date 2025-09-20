#!/usr/bin/env node
/**
 * SoloHack CLI エントリーポイント
 * - Commander を使ってサブコマンド（task/*, timer/*, chat）を定義
 * - 実行前(preAction)に JSON からタスクを読み込み、実行後(postAction)に保存
 * - 開発中は `npm run dev -- <cmd>`、本番/グローバルは `solohack <cmd>` を想定
 * 例:
 *   npm run dev -- task add "最初のタスク"
 *   npm run dev -- task list
 *   npm run dev -- timer start 25
 *   npm run dev -- chat "質問" --mode tech
 */
import { Command } from 'commander';
import { config as loadEnv } from 'dotenv';
import { TaskManager } from '../core/taskManager.js';
import { ChatClient } from '../core/chat.js';
import { loadTasks, saveTasks, saveTimer, loadTimer } from '../core/storage.js';

loadEnv();

const program = new Command();
let tasks: TaskManager; // 日本語メモ: フックで永続化から読み込んで初期化する。

program
  .name('slh')
  .description('Gamified solo development CLI with AI partner.')
  .version('0.1.0');

program.addHelpText(
  'before',
  '\nAlias: You can also run this CLI as "solohack".\n'
);

// 日本語メモ: Commander のサブコマンドはネストで定義すると誤解が少ない。
const task = program.command('task').description('Task management');

task
  .command('add')
  .argument('<title>', 'Task title')
  .description('Add a new task to the queue.')
  .action((title: string) => {
    try {
      const task = tasks.addTask(title);
      console.log(`Added task #${task.id}: ${task.title}`);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
  });

task
  .command('list')
  .description('List all tasks.')
  .action(() => {
    const result = tasks.listTasks();
    if (result.length === 0) {
      console.log('No tasks yet.');
      return;
    }

    for (const task of result) {
      const status = task.completed ? '✅' : '🕒';
      console.log(`${status} #${task.id} ${task.title}`);
    }
  });

task
  .command('done')
  .argument('<id>', 'Task id to mark complete', (value) => Number.parseInt(value, 10))
  .description('Mark a task as done.')
  .action((id: number) => {
    try {
      const task = tasks.markDone(id);
      console.log(`Completed task #${task.id}.`);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
  });

task
  .command('remove')
  .argument('<id>', 'Task id to remove', (value) => Number.parseInt(value, 10))
  .description('Remove a task from the queue.')
  .action((id: number) => {
    try {
      tasks.removeTask(id);
      console.log(`Removed task #${id}.`);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
  });

const timerCmd = program.command('timer').description('Pomodoro timer');

timerCmd
  .command('start')
  .argument('[minutes]', 'Duration in minutes', (value) => Number.parseInt(value, 10), 25)
  .description('Start a pomodoro timer.')
  .action(async (minutes: number) => {
    // 日本語メモ: 永続化の完了を待たないとプロセス終了で書き込みが落ちる可能性があるため await する。
    const durationSeconds = minutes * 60;
    await saveTimer({ startedAt: Date.now(), durationSeconds });
    console.log(`Started a ${minutes}-minute pomodoro.`);
  });

timerCmd
  .command('status')
  .description('Show remaining time if a timer is running.')
  .action(async () => {
    const t = await loadTimer();
    if (!t) {
      console.log('No timer running.');
      return;
    }
    const now = Date.now();
    const elapsed = Math.max(0, Math.floor((now - t.startedAt) / 1000));
    const remaining = Math.max(0, t.durationSeconds - elapsed);
    const fmt = (sec: number) => {
      const mm = Math.floor(sec / 60).toString().padStart(2, '0');
      const ss = (sec % 60).toString().padStart(2, '0');
      return `${mm}:${ss}`;
    };

    if (remaining <= 0) {
      console.log('✅ Timer finished.');
      return;
    }

    const barWidth = 20;
    const ratio = Math.min(1, t.durationSeconds === 0 ? 1 : elapsed / t.durationSeconds);
    const filled = Math.max(0, Math.min(barWidth, Math.round(barWidth * ratio)));
    const empty = barWidth - filled;
    const percent = Math.round(ratio * 100);
    const bar = `${'█'.repeat(filled)}${'-'.repeat(empty)}`;
    console.log(`⏳ Remaining: ${fmt(remaining)} | [${bar}] ${percent}%`);
  });

timerCmd
  .command('stop')
  .description('Stop and clear the current timer if any.')
  .action(async () => {
    await saveTimer(undefined);
    console.log('Timer cleared.');
  });

timerCmd
  .command('reset')
  .description('Reset and restart the current timer with its original duration.')
  .action(async () => {
    const t = await loadTimer();
    if (!t) {
      console.log('No timer to reset.');
      return;
    }
    await saveTimer({ startedAt: Date.now(), durationSeconds: t.durationSeconds });
    console.log('Timer reset.');
  });

timerCmd
  .command('extend')
  .argument('<minutes>', 'Additional minutes to extend', (v) => Number.parseInt(v, 10))
  .description('Extend the running timer by the given minutes.')
  .action(async (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      console.log('Please provide a positive number of minutes.');
      return;
    }
    const t = await loadTimer();
    if (!t) {
      console.log('No timer to extend.');
      return;
    }
    const addSeconds = minutes * 60;
    await saveTimer({ startedAt: t.startedAt, durationSeconds: t.durationSeconds + addSeconds });
    console.log(`Extended by ${minutes} minute(s).`);
  });

program
  .command('chat')
  .argument('<question...>', 'Ask the AI partner a question.')
  .option('--mode <mode>', 'Chat mode (tech|coach)', 'tech')
  .option('--no-stream', 'Disable streaming output')
  .option('--speed <speed>', 'Typewriter speed (instant|fast|normal|slow)', 'slow')
  .option('--delay <ms>', 'Typewriter delay per character in ms (overrides --speed)', (v) => Number.parseInt(v, 10))
  .option('--tone <tone>', 'Assistant tone preset, e.g., "丁寧・前向き・簡潔"')
  .description('Talk with your AI partner.')
  .action(async (
    questionWords: string[],
    options: { mode: 'tech' | 'coach'; stream?: boolean; noStream?: boolean; speed?: string; delay?: number; tone?: string },
  ) => {
    const apiKey = process.env.SOLOHACK_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      console.error('Missing SOLOHACK_GEMINI_API_KEY (or GOOGLE_API_KEY) in environment.');
      process.exitCode = 1;
      return;
    }

    try {
      const chatClient = new ChatClient({
        apiKey,
        assistantName: process.env.SOLOHACK_ASSISTANT_NAME,
        mode: options.mode,
        tone: options.tone ?? process.env.SOLOHACK_ASSISTANT_TONE,
      });
      const question = questionWords.join(' ');
      const useStream = options.noStream ? false : true;
      const speedMap: Record<string, number> = { instant: 0, fast: 5, normal: 12, slow: 25 };
      const envDelay = process.env.SOLOHACK_STREAM_DELAY_MS ? Number.parseInt(process.env.SOLOHACK_STREAM_DELAY_MS, 10) : undefined;
      const delay = Number.isFinite(options.delay)
        ? (options.delay as number)
        : (typeof envDelay === 'number' && Number.isFinite(envDelay) ? envDelay : speedMap[options.speed ?? 'slow'] ?? speedMap.slow);

      const typewriterWrite = async (text: string, perCharMs: number) => {
        if (perCharMs <= 0) {
          process.stdout.write(text);
          return;
        }
        for (const ch of text) {
          process.stdout.write(ch);
          // 日本語メモ: 非同期スリープでタイプライター風の間隔を実現。
          await new Promise((r) => setTimeout(r, perCharMs));
        }
      };
      if (useStream) {
        // タイプライター風に逐次表示（速度は --delay または --speed / 環境変数で調整可能）
        await chatClient.askStream(question, async (text) => {
          await typewriterWrite(text, delay);
        });
        process.stdout.write('\n');
      } else {
        const answer = await chatClient.ask(question);
        console.log(answer);
      }
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
  });

program
  .hook('preAction', async () => {
    // 日本語メモ: 起動ごとに storage からタスクを読み込み、TaskManager を初期化。
    const initial = await loadTasks();
    tasks = new TaskManager(initial);
  });

program
  .hook('postAction', async () => {
    // 日本語メモ: 実行後にタスクを storage へ保存。
    if (tasks) {
      await saveTasks(tasks.listTasks());
    }
  });

program.parseAsync(process.argv);
