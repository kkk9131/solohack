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
import { PomodoroTimer } from '../core/timer.js';
import { ChatClient } from '../core/chat.js';
import { loadTasks, saveTasks } from '../core/storage.js';

loadEnv();

const program = new Command();
let tasks: TaskManager; // 日本語メモ: フックで永続化から読み込んで初期化する。

program
  .name('solohack')
  .description('Gamified solo development CLI with AI partner.')
  .version('0.1.0');

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
  .action((minutes: number) => {
    // 日本語メモ: タイマーの実時間連携は今後実装。ここでは状態リセットのイメージを掴む。
    const localTimer = new PomodoroTimer(minutes);
    localTimer.start();
    console.log(`Started a ${minutes}-minute pomodoro.`);
  });

program
  .command('chat')
  .argument('<question...>', 'Ask the AI partner a question.')
  .option('--mode <mode>', 'Chat mode (tech|coach)', 'tech')
  .description('Talk with your AI partner.')
  .action(async (questionWords: string[], options: { mode: 'tech' | 'coach' }) => {
    const apiKey = process.env.SOLOHACK_OPENAI_KEY;

    if (!apiKey) {
      console.error('Missing SOLOHACK_OPENAI_KEY in environment.');
      process.exitCode = 1;
      return;
    }

    try {
      const chatClient = new ChatClient({
        apiKey,
        assistantName: process.env.SOLOHACK_ASSISTANT_NAME,
        mode: options.mode,
      });
      const question = questionWords.join(' ');
      const answer = await chatClient.ask(question);
      console.log(answer);
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
