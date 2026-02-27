import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from './conversations.js';
import { mkdtempSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createAgentSession,
  getAgentSession,
  getAgentSessionByThread,
  getActiveSessions,
  getAllSessions,
  updateAgentSession,
  logActivity,
  getSessionActivities,
  getRecentActivities,
} from './agentSessions.js';

describe('agentSessions', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'clackbot-agent-test-'));
    mkdirSync(join(cwd, '.clackbot'), { recursive: true });
    initDatabase(cwd);
  });

  afterEach(() => {
    closeDatabase();
  });

  // ─── Session CRUD ───

  it('creates and retrieves a session', () => {
    const session = createAgentSession({
      agentType: 'brain',
      taskDescription: '테스트 작업',
      threadTs: '1234567890.123456',
    });

    expect(session.id).toBeDefined();
    expect(session.agentType).toBe('brain');
    expect(session.taskDescription).toBe('테스트 작업');
    expect(session.threadTs).toBe('1234567890.123456');
    expect(session.status).toBe('active');
    expect(session.messageCount).toBe(0);
    expect(session.toolsUsed).toEqual([]);
    expect(session.createdAt).toBeTypeOf('number');
    expect(session.lastActiveAt).toBeTypeOf('number');

    // getAgentSession
    const fetched = getAgentSession(session.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(session.id);
    expect(fetched!.agentType).toBe('brain');
    expect(fetched!.taskDescription).toBe('테스트 작업');
  });

  it('returns null for non-existent session', () => {
    const result = getAgentSession('non-existent-id');
    expect(result).toBeNull();
  });

  it('lists active sessions', () => {
    createAgentSession({ agentType: 'brain', taskDescription: '작업 1' });
    createAgentSession({ agentType: 'sub', taskDescription: '작업 2' });
    const completedSession = createAgentSession({ agentType: 'brain', taskDescription: '작업 3' });
    updateAgentSession(completedSession.id, { status: 'completed', resultSummary: '완료됨' });

    const active = getActiveSessions();
    expect(active).toHaveLength(2);
    expect(active.every(s => s.status === 'active')).toBe(true);
  });

  it('updates session status', () => {
    const session = createAgentSession({ agentType: 'brain', taskDescription: '업데이트 테스트' });

    updateAgentSession(session.id, {
      status: 'completed',
      resultSummary: '성공적으로 완료',
      completedAt: Date.now(),
    });

    const updated = getAgentSession(session.id);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('completed');
    expect(updated!.resultSummary).toBe('성공적으로 완료');
    expect(updated!.completedAt).toBeTypeOf('number');
  });

  it('updates session messageCount and toolsUsed', () => {
    const session = createAgentSession({ agentType: 'brain' });

    updateAgentSession(session.id, {
      messageCount: 5,
      toolsUsed: ['Read', 'Write', 'Bash'],
    });

    const updated = getAgentSession(session.id);
    expect(updated!.messageCount).toBe(5);
    expect(updated!.toolsUsed).toEqual(['Read', 'Write', 'Bash']);
  });

  it('updates session resumeId', () => {
    const session = createAgentSession({ agentType: 'brain' });

    updateAgentSession(session.id, { resumeId: 'resume-abc-123' });

    const updated = getAgentSession(session.id);
    expect(updated!.resumeId).toBe('resume-abc-123');
  });

  it('gets session by thread', () => {
    createAgentSession({
      agentType: 'brain',
      threadTs: '1111111111.000001',
      taskDescription: '스레드 세션',
    });

    // 완료된 세션 (같은 스레드)
    const completed = createAgentSession({
      agentType: 'brain',
      threadTs: '2222222222.000002',
    });
    updateAgentSession(completed.id, { status: 'completed' });

    const active = getAgentSessionByThread('1111111111.000001');
    expect(active).not.toBeNull();
    expect(active!.threadTs).toBe('1111111111.000001');
    expect(active!.status).toBe('active');

    // 완료된 스레드 세션은 반환하지 않음
    const noActive = getAgentSessionByThread('2222222222.000002');
    expect(noActive).toBeNull();
  });

  it('returns null for non-existent thread', () => {
    const result = getAgentSessionByThread('9999999999.000000');
    expect(result).toBeNull();
  });

  it('paginated getAllSessions works', () => {
    // 5개 세션 생성
    for (let i = 0; i < 5; i++) {
      createAgentSession({ agentType: 'brain', taskDescription: `작업 ${i}` });
    }
    // 1개 완료
    const completed = createAgentSession({ agentType: 'sub', taskDescription: '완료 작업' });
    updateAgentSession(completed.id, { status: 'completed' });

    // 전체 조회
    const all = getAllSessions();
    expect(all.items).toHaveLength(6);
    expect(all.total).toBe(6);

    // status 필터
    const activeOnly = getAllSessions({ status: 'active' });
    expect(activeOnly.items).toHaveLength(5);
    expect(activeOnly.total).toBe(5);

    const completedOnly = getAllSessions({ status: 'completed' });
    expect(completedOnly.items).toHaveLength(1);
    expect(completedOnly.total).toBe(1);

    // 페이지네이션
    const page1 = getAllSessions({ limit: 3, offset: 0 });
    expect(page1.items).toHaveLength(3);
    expect(page1.total).toBe(6);

    const page2 = getAllSessions({ limit: 3, offset: 3 });
    expect(page2.items).toHaveLength(3);
    expect(page2.total).toBe(6);
  });

  it('creates session with all optional fields', () => {
    const session = createAgentSession({
      agentType: 'sub',
      threadTs: '9999999999.000000',
      skillUsed: 'code-review',
      taskDescription: '코드 리뷰',
      assignedChannels: ['C123', 'C456'],
      cwd: '/tmp/project',
    });

    expect(session.skillUsed).toBe('code-review');
    expect(session.assignedChannels).toEqual(['C123', 'C456']);
    expect(session.cwd).toBe('/tmp/project');

    const fetched = getAgentSession(session.id);
    expect(fetched!.assignedChannels).toEqual(['C123', 'C456']);
  });

  // ─── Activity CRUD ───

  it('logs and retrieves activities for a session', () => {
    const session = createAgentSession({ agentType: 'brain' });

    logActivity({
      sessionId: session.id,
      agentType: 'brain',
      activityType: 'tool_use',
      toolName: 'Read',
      detail: { file: '/tmp/test.ts' },
      channelId: 'C123',
    });

    logActivity({
      sessionId: session.id,
      agentType: 'brain',
      activityType: 'skill_invoke',
      toolName: 'code-review',
    });

    const activities = getSessionActivities(session.id);
    expect(activities).toHaveLength(2);

    expect(activities[0].activityType).toBe('tool_use');
    expect(activities[0].toolName).toBe('Read');
    expect(activities[0].detail).toEqual({ file: '/tmp/test.ts' });
    expect(activities[0].channelId).toBe('C123');
    expect(activities[0].createdAt).toBeTypeOf('number');

    expect(activities[1].activityType).toBe('skill_invoke');
    expect(activities[1].toolName).toBe('code-review');
  });

  it('gets recent activities across sessions', () => {
    const session1 = createAgentSession({ agentType: 'brain' });
    const session2 = createAgentSession({ agentType: 'sub' });

    logActivity({
      sessionId: session1.id,
      agentType: 'brain',
      activityType: 'tool_use',
      toolName: 'Bash',
    });

    logActivity({
      sessionId: session2.id,
      agentType: 'sub',
      activityType: 'agent_spawn',
      detail: { childAgent: 'code-review' },
    });

    logActivity({
      sessionId: session1.id,
      agentType: 'brain',
      activityType: 'memory_update',
      detail: { file: 'memory.md' },
    });

    // 전체 최신순
    const recent = getRecentActivities(10);
    expect(recent).toHaveLength(3);
    // 최신이 먼저
    expect(recent[0].activityType).toBe('memory_update');
    expect(recent[1].activityType).toBe('agent_spawn');
    expect(recent[2].activityType).toBe('tool_use');

    // limit 테스트
    const limited = getRecentActivities(2);
    expect(limited).toHaveLength(2);

    // offset 테스트
    const offset = getRecentActivities(10, 1);
    expect(offset).toHaveLength(2);
    expect(offset[0].activityType).toBe('agent_spawn');
  });

  it('returns empty array for session with no activities', () => {
    const session = createAgentSession({ agentType: 'brain' });
    const activities = getSessionActivities(session.id);
    expect(activities).toEqual([]);
  });

  it('activity without optional fields', () => {
    const session = createAgentSession({ agentType: 'brain' });

    logActivity({
      sessionId: session.id,
      agentType: 'brain',
      activityType: 'memory_update',
    });

    const activities = getSessionActivities(session.id);
    expect(activities).toHaveLength(1);
    expect(activities[0].toolName).toBeUndefined();
    expect(activities[0].detail).toBeUndefined();
    expect(activities[0].channelId).toBeUndefined();
  });
});
