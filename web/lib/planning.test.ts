import { describe, expect, it } from 'vitest';
import { parseGenerationResponse, buildGenerationPrompt } from './planning';

const mockSession = {
  summary: 'Build a neon dashboard with tasks and timer.',
  conversation: [
    { role: 'user', content: 'お願い！ソロハックのダッシュボードを作りたい。' },
    { role: 'ai', content: '了解しました。主要機能を教えてください。' },
  ],
  updatedAt: new Date().toISOString(),
} as const;

describe('buildGenerationPrompt', () => {
  it('includes summary and conversation fallback text', () => {
    const prompt = buildGenerationPrompt(mockSession);
    expect(prompt).toContain('Requirement Summary');
    expect(prompt).toContain(mockSession.summary);
    expect(prompt).toContain('Conversation Log');
    expect(prompt).toContain('AI: 了解しました');
  });
});

describe('parseGenerationResponse', () => {
  it('parses tasks and roadmap with trimming and map node filtering', () => {
    const text = `
    Here is your plan:
    {"tasks": [
      {"title": "  Setup project  ", "mapNode": "START", "summary": "init"},
      {"title": "Build UI", "mapNode": "front"},
      {"title": "", "mapNode": "front"}
    ],
    "roadmap": [
      {"order": 2, "title": "UI", "summary": "screens", "mapNode": "front", "tasks": ["Build UI"]},
      {"order": 1, "summary": "foundation", "mapNode": "Start", "tasks": ["Setup project"]},
      {"order": 3, "title": "", "summary": "", "tasks": []}
    ]}`;

    const { tasks, roadmap } = parseGenerationResponse(text);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ title: 'Setup project', mapNode: 'start' });
    expect(tasks[1]).toMatchObject({ title: 'Build UI', mapNode: 'front' });

    expect(roadmap).toHaveLength(2);
    expect(roadmap[0]).toMatchObject({ order: 1, summary: 'foundation', mapNode: 'start' });
    expect(roadmap[1]).toMatchObject({ order: 2, title: 'UI' });
  });

  it('returns empty arrays when JSON is invalid', () => {
    const { tasks, roadmap } = parseGenerationResponse('Not JSON');
    expect(tasks).toHaveLength(0);
    expect(roadmap).toHaveLength(0);
  });

  it('falls back to index order when order field missing', () => {
    const text = '{"tasks": [{"title": "A"}], "roadmap": [{"title": "Stage", "summary": "plan"}] }';
    const { roadmap } = parseGenerationResponse(text);
    expect(roadmap[0].order).toBe(1);
  });
});
