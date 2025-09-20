# Repository Guidelines
SoloHack CLI aims to deliver a gamified solo-development workflow backed by an AI teammate. Follow the practices below so contributions stay consistent and easy to merge.

## Project Structure & Module Organization
Source lives in `src/` with reusable logic under `src/core/` (`taskManager.ts`, `timer.ts`, `chat.ts`) and the CLI surface in `src/cli/index.ts`. Keep tests in `src/tests/` mirroring the core modules, and place long-form specs or product notes in `docs/` (see `docs/REQUIRED_DEFINITIONS.md`). Persisted data defaults to `storage/solohack.json`; treat it as ephemeral dev state, not a checked-in fixture.

## Build, Test, and Development Commands
After `npm install`, use:
- `npm run build` – transpiles TypeScript to `dist/`.
- `npm run dev` – runs the CLI with ts-node for rapid iteration.
- `npm run dev:watch` – hot-reloads the CLI on file changes.
- `npm run build:watch` – incremental rebuild of `dist/`.
- `npm test` – executes the unit suite.
- `npm run lint` – runs eslint + prettier.
Add new scripts to `package.json` instead of bespoke shell commands.

Binary alias:
- CLI binary is available as `solohack` and short alias `slh`.
- If you previously ran `npm link`, re-run it to create the new alias.

## Coding Style & Naming Conventions
Use TypeScript strict mode with 2-space indentation and trailing commas. Favor camelCase for functions and variables, PascalCase for classes, and kebab-case flags for CLI options. Export granular helpers from `src/core/` so the CLI layer stays thin. Run `npm run lint` before pushing; configure Prettier via `.prettierrc` when project files land.

Learning-friendly comments (JP): add clear, concise Japanese comments where non-trivial logic exists. Prefer short doc comments over long prose. Use these tags:
- `// 日本語メモ:` rationale or trade-offs
- `// TODO:` pending tasks (include intent, not dates)
- `// NOTE:` surprising behavior or constraints
Keep comments updated as code evolves; summarize, don’t narrate every line.

## Testing Guidelines
Write Vitest specs alongside modules as `<name>.spec.ts`. Stub OpenAI calls with test doubles; never hit the live API in CI. Target 85%+ line coverage for `src/core/`, and add smoke tests covering CLI command wiring. Use `npm test -- --runInBand` when debugging timer concurrency.

## Commit & Pull Request Guidelines
History currently shows a single “Initial commit”, so adopt Conventional Commit prefixes going forward (`feat:`, `fix:`, `docs:`). Keep messages in the imperative mood and wrap at ~72 chars. Pull requests must include: summary bullets, linked issues (or `n/a`), screenshots or recordings for UX changes, and notes on test coverage. Request review once CI passes and unresolved comments are addressed.

## Environment & Configuration
Store AI credentials in `.env` (Gemini): `SOLOHACK_GEMINI_API_KEY` (or `GOOGLE_API_KEY`). Optional: `SOLOHACK_ASSISTANT_NAME` and `SOLOHACK_ASSISTANT_TONE` (e.g., "polite, concise, friendly").

Storage providers:
- Select with `SOLOHACK_STORAGE_PROVIDER`: `json` (default) or `memory`.
- `json` stores at `storage/solohack.json`; `memory` is in‑process only (good for tests).
Never commit secrets; update `.env.example` accordingly.

## Repo Logs
Track work in `log.md`. Use date-only timestamps like `YYYY-MM-DD` (e.g., `2025-09-20`). Keep entries short and action-focused.
