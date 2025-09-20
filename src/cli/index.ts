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

program.addHelpText(
  'after',
  '\nExamples:\n' +
    '  slh task add "Write docs"\n' +
    '  slh task list\n' +
    '  slh timer start 25\n' +
    '  slh chat "How do I center a div?" --mode tech\n' +
    '\nEnvironment:\n' +
    '  SOLOHACK_GEMINI_API_KEY / GOOGLE_API_KEY  Gemini API key\n' +
    '  SOLOHACK_ASSISTANT_NAME                   Assistant display name\n' +
    '  SOLOHACK_ASSISTANT_TONE                   Tone preset (e.g., 丁寧・前向き・簡潔)\n' +
    '  SOLOHACK_STREAM_DELAY_MS                  Typewriter delay per character (ms)\n');

// 日本語メモ: Commander のサブコマンドはネストで定義すると誤解が少ない。
const task = program.command('task').description('Task management');
task.addHelpText('after', '\nExamples:\n  slh task add "New feature"\n  slh task list\n  slh task done 1\n  slh task remove 1\n');

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
timerCmd.addHelpText('after', '\nExamples:\n  slh timer start 25\n  slh timer status\n  slh timer stop\n  slh timer reset\n  slh timer extend 5\n');

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
  .addHelpText('after', '\nExamples:\n  slh chat "Explain SOLID principles" --mode tech\n  slh chat "励まして!" --mode coach --tone "丁寧・前向き・簡潔" --speed normal\n  slh chat "まとめて出力" --no-stream\n')
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
      const speedMap: Record<string, number> = { instant: 0, fast: 5, normal: 12, slow: 40 };
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
  .command('palette')
  .alias('/')
  .description('Open interactive command palette (slash menu).')
  .action(async () => {
    // 動的requireで型解決や未インストール環境でもビルドを通す
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let AutoComplete: any, Input: any, Select: any;
    try {
      ({ AutoComplete, Input, Select } = require('enquirer'));
    } catch {
      console.error('Interactive palette requires "enquirer". Install with: npm i enquirer');
      process.exitCode = 1;
      return;
    }

    const choices = [
      { name: 'task:add', message: 'task add  — タスクを追加' },
      { name: 'task:list', message: 'task list — タスク一覧' },
      { name: 'task:done', message: 'task done — タスク完了' },
      { name: 'task:remove', message: 'task remove — タスク削除' },
      { name: 'timer:start', message: 'timer start — タイマー開始' },
      { name: 'timer:status', message: 'timer status — タイマー残り' },
      { name: 'timer:stop', message: 'timer stop — タイマー停止' },
      { name: 'timer:reset', message: 'timer reset — タイマー再開' },
      { name: 'timer:extend', message: 'timer extend — タイマー延長' },
      { name: 'chat:ask', message: 'chat — AIに質問（Gemini）' },
      { name: 'config:storage', message: '設定: ストレージプロバイダーを選択 (json/memory)' },
      { name: 'config:chat', message: '設定: チャットの既定オプションを設定 (mode/tone/speed/delay)' },
      { name: 'exit', message: '終了' },
    ];
    // セッション設定（このパレット起動中のみ有効）
    let sessionMode: 'tech' | 'coach' | undefined;
    let sessionTone: string | undefined;
    let sessionStream: boolean | undefined; // true=stream, false=no-stream
    let sessionDelayMs: number | undefined;

    for (;;) {
      const select = new AutoComplete({
        name: 'cmd',
        message: 'コマンドを選択してください (/ で検索)',
        limit: 12,
        choices,
      });
      const cmd: string = await select.run();
      if (cmd === 'exit') break;

      try {
        switch (cmd) {
        case 'task:add': {
          const title = await new Input({ name: 'title', message: 'タイトル:' }).run();
          const created = tasks.addTask(title);
          await saveTasks(tasks.listTasks());
          console.log(`Added task #${created.id}: ${created.title}`);
          break;
        }
        case 'task:list': {
          const list = tasks.listTasks();
          if (list.length === 0) console.log('No tasks yet.');
          else list.forEach((t) => console.log(`${t.completed ? '✅' : '🕒'} #${t.id} ${t.title}`));
          break;
        }
        case 'task:done': {
          const idStr = await new Input({ name: 'id', message: 'ID:' }).run();
          const id = Number.parseInt(idStr, 10);
          const done = tasks.markDone(id);
          await saveTasks(tasks.listTasks());
          console.log(`Completed task #${done.id}.`);
          break;
        }
        case 'task:remove': {
          const idStr = await new Input({ name: 'id', message: 'ID:' }).run();
          const id = Number.parseInt(idStr, 10);
          tasks.removeTask(id);
          await saveTasks(tasks.listTasks());
          console.log(`Removed task #${id}.`);
          break;
        }
        case 'timer:start': {
          const minStr = await new Input({ name: 'minutes', message: '分(整数):', initial: '25' }).run();
          const minutes = Number.parseInt(minStr, 10) || 25;
          await saveTimer({ startedAt: Date.now(), durationSeconds: minutes * 60 });
          console.log(`Started a ${minutes}-minute pomodoro.`);
          break;
        }
        case 'timer:status': {
          const t = await loadTimer();
          if (!t) {
            console.log('No timer running.');
          } else {
            const now = Date.now();
            const elapsed = Math.max(0, Math.floor((now - t.startedAt) / 1000));
            const remaining = Math.max(0, t.durationSeconds - elapsed);
            const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
            if (remaining <= 0) console.log('✅ Timer finished.');
            else {
              const barWidth = 20;
              const ratio = Math.min(1, t.durationSeconds === 0 ? 1 : elapsed / t.durationSeconds);
              const filled = Math.max(0, Math.min(barWidth, Math.round(barWidth * ratio)));
              const empty = barWidth - filled;
              const percent = Math.round(ratio * 100);
              const bar = `${'█'.repeat(filled)}${'-'.repeat(empty)}`;
              console.log(`⏳ Remaining: ${fmt(remaining)} | [${bar}] ${percent}%`);
            }
          }
          break;
        }
        case 'timer:stop': {
          await saveTimer(undefined);
          console.log('Timer cleared.');
          break;
        }
        case 'timer:reset': {
          const t = await loadTimer();
          if (!t) console.log('No timer to reset.');
          else {
            await saveTimer({ startedAt: Date.now(), durationSeconds: t.durationSeconds });
            console.log('Timer reset.');
          }
          break;
        }
        case 'timer:extend': {
          const addStr = await new Input({ name: 'add', message: '延長(分):', initial: '5' }).run();
          const add = Number.parseInt(addStr, 10);
          if (!Number.isFinite(add) || add <= 0) console.log('Please provide a positive number of minutes.');
          else {
            const t = await loadTimer();
            if (!t) console.log('No timer to extend.');
            else {
              await saveTimer({ startedAt: t.startedAt, durationSeconds: t.durationSeconds + add * 60 });
              console.log(`Extended by ${add} minute(s).`);
            }
          }
          break;
        }
        case 'chat:ask': {
          const question = await new Input({ name: 'q', message: '質問:' }).run();
          const apiKey = process.env.SOLOHACK_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
          if (!apiKey) {
            console.error('Missing SOLOHACK_GEMINI_API_KEY (or GOOGLE_API_KEY) in environment.');
          } else {
            const chatClient = new ChatClient({
              apiKey,
              assistantName: process.env.SOLOHACK_ASSISTANT_NAME,
              mode: (sessionMode ?? 'tech') as 'tech' | 'coach',
              tone: sessionTone ?? process.env.SOLOHACK_ASSISTANT_TONE,
            });
            const useStream = sessionStream ?? true;
            const delay = sessionDelayMs ?? (Number.isFinite(Number(process.env.SOLOHACK_STREAM_DELAY_MS))
              ? Number(process.env.SOLOHACK_STREAM_DELAY_MS)
              : 40);
            if (useStream) {
              await chatClient.askStream(question, async (text) => {
                await new Promise((r) => setTimeout(r, delay));
                process.stdout.write(text);
              });
              process.stdout.write('\n');
            } else {
              const answer = await chatClient.ask(question);
              console.log(answer);
            }
          }
          break;
        }
        case 'config:storage': {
          const current = process.env.SOLOHACK_STORAGE_PROVIDER ?? 'json';
          const provider = await new Select({ name: 'sp', message: `プロバイダー (現在: ${current})`, choices: ['json', 'memory'] }).run();
          process.env.SOLOHACK_STORAGE_PROVIDER = provider as string;
          console.log(`Storage provider set to: ${provider} (セッションのみ)`);
          break;
        }
        case 'config:chat': {
          sessionMode = (await new Select({ name: 'mode', message: 'モード', choices: ['tech', 'coach'], initial: sessionMode === 'coach' ? 1 : 0 }).run()) as 'tech' | 'coach';
          sessionTone = await new Input({ name: 'tone', message: 'トーン（例: 丁寧・前向き・簡潔 / 妹のような感じ）', initial: sessionTone ?? process.env.SOLOHACK_ASSISTANT_TONE ?? '' }).run();
          const streamChoice = await new Select({ name: 'stream', message: '出力方式', choices: ['stream (タイプライター)', 'no-stream (一括)'], initial: sessionStream === false ? 1 : 0 }).run();
          sessionStream = streamChoice.startsWith('stream');
          if (sessionStream) {
            const speedChoice = await new Select({ name: 'speed', message: '速度', choices: ['instant', 'fast', 'normal', 'slow'], initial: 3 }).run();
            const speedMap: Record<string, number> = { instant: 0, fast: 5, normal: 12, slow: 40 };
            sessionDelayMs = speedMap[speedChoice as string] ?? 40;
            const override = await new Input({ name: 'delay', message: `遅延(ms/文字) 任意（空で既定: ${sessionDelayMs}）`, initial: '' }).run();
            if (override && !Number.isNaN(Number(override))) sessionDelayMs = Number(override);
          } else {
            sessionDelayMs = undefined;
          }
          console.log('チャット設定を更新しました。');
          break;
        }
      }
      } catch (err) {
        console.error((err as Error).message);
        process.exitCode = 1;
      }
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

program
  .command('completion')
  .argument('[shell]', 'Target shell (bash|zsh)', 'bash')
  .description('Print shell completion script to stdout.')
  .action((shell: string) => {
    if (shell === 'bash') {
      console.log(`
_slh_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[\${COMP_CWORD}]}"
  prev="\${COMP_WORDS[\${COMP_CWORD}-1]}"
  local commands="task timer chat completion help --help --version"
  local task_sub="add list done remove"
  local timer_sub="start status stop reset extend"
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "$cur") )
    return 0
  fi
  case "\${COMP_WORDS[1]}" in
    task)
      COMPREPLY=( $(compgen -W "\${task_sub}" -- "$cur") ) ;;
    timer)
      COMPREPLY=( $(compgen -W "\${timer_sub}" -- "$cur") ) ;;
    chat)
      COMPREPLY=( $(compgen -W "--mode --no-stream --speed --delay --tone" -- "$cur") ) ;;
  esac
}
complete -F _slh_completions slh
`);
    } else if (shell === 'zsh') {
      console.log(`
#compdef slh
_slh() {
  local -a cmds task_sub timer_sub chat_opts
  cmds=('task:Task commands' 'timer:Pomodoro timer' 'chat:AI chat' 'completion:Print completions')
  task_sub=('add:Add task' 'list:List tasks' 'done:Complete task' 'remove:Remove task')
  timer_sub=('start:Start timer' 'status:Show status' 'stop:Stop' 'reset:Reset' 'extend:Extend')
  chat_opts=('--mode[Mode tech|coach]' '--no-stream[Disable streaming]' '--speed[Type speed]' '--delay[Delay ms]' '--tone[Tone preset]')
  if (( CURRENT == 2 )); then
    _describe 'command' cmds
    return
  fi
  case $words[2] in
    task) _describe 'task' task_sub ;;
    timer) _describe 'timer' timer_sub ;;
    chat) _describe 'options' chat_opts ;;
  esac
}
compdef _slh slh
`);
    } else {
      console.error('Unsupported shell. Use bash or zsh.');
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
