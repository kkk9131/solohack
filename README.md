# SoloHack CLI

*Making solo development more fun and sustainable.*

[日本語版READMEはこちら](./README.ja.md)

## Overview

SoloHack is a support application designed to make solo development a more enjoyable and sustainable experience. This CLI is the first Minimum Viable Product (MVP) of the SoloHack project.

The core concept is to provide a "gamified development experience" combined with an AI partner who can help with coding questions and provide motivation.

## Features (CLI MVP)

### 1. Task Management
Simulates a hackathon-like experience with simple task commands.
You can use either `solohack` or the short alias `slh`.
- `slh task add "My new feature"`: Add a new task.
- `slh task list`: View all tasks.
- `slh task done <id>`: Mark a task as complete.
- `slh task remove <id>`: Delete a task.

### 2. Pomodoro Timer
A countdown timer to help you focus.
- `slh timer start 25`: Start a 25-minute timer.
- `slh timer status`: Check the remaining time.
- `slh timer stop`: Stop the timer.
- `slh timer reset`: Reset the timer to the original duration and restart.

### 3. AI Chat Partner
Your AI partner for technical and motivational support.
- `slh chat "How do I center a div?"`: Ask a question.
- **Modes:**
  - `--mode tech`: Get technical advice and code examples.
  - `--mode coach`: Receive motivational support and encouragement.
- **Customizable:** The AI's name and personality can be configured via a `.env` file.

## Tech Stack

- **Language:** Node.js, TypeScript
- **CLI Framework:** Commander.js
- **AI:** OpenAI API (gpt-4o-mini with streaming)
- **Data Storage:** Local JSON file for the MVP
- **Testing:** Jest/Vitest

## Future Vision

The SoloHack project aims to expand from this CLI version to:
1.  A **Web App**
2.  A **Mobile App**
3.  A full-fledged, **IDE-like Desktop Application**

The ultimate goal is to create a next-generation IDE that handles everything from Git operations to building and deployment with a single click, all within a fun, game-like environment.

## Developer Notes

- Global link for local testing: `npm run link` (creates `slh` and `solohack` commands). If you had linked before, re-run to add the new alias.
- Unlink (optional): `npm unlink -g solohack-cli` (and inside the repo: `npm unlink`)
