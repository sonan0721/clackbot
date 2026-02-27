import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initDatabase } from '../store/conversations.js';
import { initBrainMemory, readBrainFile } from '../store/brainMemory.js';
import { getActiveSessions } from '../store/agentSessions.js';

// e2e 통합 테스트 — 실제 Claude Code 호출이 필요한 테스트는 .skip
// CI에서는 건너뛰고, 로컬에서 수동 실행 시에만 사용

describe('Brain Agent e2e', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'clackbot-e2e-'));
    mkdirSync(join(cwd, '.clackbot'), { recursive: true });
    initDatabase(cwd);
  });

  it('Brain 메모리 초기화 후 기본 파일 존재', () => {
    initBrainMemory(cwd);
    const memory = readBrainFile(cwd, 'memory.md');
    expect(memory).toContain('Brain 메모리');
    const sessions = readBrainFile(cwd, 'sessions.md');
    expect(sessions).toContain('활성 세션');
    const knowledge = readBrainFile(cwd, 'knowledge.md');
    expect(knowledge).toContain('학습된 지식');
    const tasks = readBrainFile(cwd, 'tasks.md');
    expect(tasks).toContain('작업 히스토리');
  });

  it('초기 상태에서 활성 세션 없음', () => {
    const active = getActiveSessions();
    expect(active).toHaveLength(0);
  });

  // 실제 Claude Code 호출 테스트 — 수동 실행 전용
  it.skip('queryBrain으로 간단한 질문에 응답', async () => {
    const { queryBrain } = await import('./brain.js');

    initBrainMemory(cwd);

    const result = await queryBrain({
      prompt: '안녕, 넌 누구야?',
      cwd,
      isOwner: true,
    });

    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.sessionId).toBeTruthy();
  });

  it.skip('queryBrain 후 세션이 DB에 기록됨', async () => {
    const { queryBrain } = await import('./brain.js');

    initBrainMemory(cwd);

    const result = await queryBrain({
      prompt: '테스트 메시지',
      cwd,
      isOwner: true,
    });

    // 세션이 생성되고 completed 상태여야 함
    const { getAgentSession } = await import('../store/agentSessions.js');
    const session = getAgentSession(result.sessionId);
    expect(session).toBeTruthy();
    expect(session!.agentType).toBe('brain');
    expect(session!.status).toBe('completed');
  });
});
