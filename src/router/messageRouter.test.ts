import { describe, it, expect } from 'vitest';
import { routeMessage } from './messageRouter.js';
import type { IncomingMessage } from '../events/types.js';
import type { ActiveSession } from './types.js';

function makeMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    id: 'msg-1',
    source: 'slack',
    text: '안녕하세요',
    userId: 'U001',
    channelId: 'C001',
    threadTs: 'ts-1',
    isOwner: true,
    mode: 'dm',
    ...overrides,
  };
}

describe('routeMessage', () => {
  it('DM + Owner + 활성 Sub Agent 없음 → brain 라우팅', () => {
    const result = routeMessage(makeMessage({ mode: 'dm' }), []);
    expect(result.action).toBe('brain');
    expect(result.mode).toBe('dm');
    expect(result.isOwner).toBe(true);
  });

  it('thread + Owner + 활성 Sub Agent 있음 → agent_resume', () => {
    const sessions: ActiveSession[] = [
      { sessionId: 's1', threadTs: 'ts-1', agentType: 'sub', resumeId: 'r1', status: 'active' },
    ];
    const result = routeMessage(makeMessage({ mode: 'thread', threadTs: 'ts-1' }), sessions);
    expect(result.action).toBe('agent_resume');
    expect(result.resumeId).toBe('r1');
  });

  it('channel 모드 → agent_new (1회성)', () => {
    const result = routeMessage(makeMessage({ mode: 'channel' }), []);
    expect(result.action).toBe('agent_new');
    expect(result.mode).toBe('channel');
  });

  it('비Owner + channel → agent_new', () => {
    const result = routeMessage(makeMessage({ mode: 'channel', isOwner: false }), []);
    expect(result.action).toBe('agent_new');
    expect(result.isOwner).toBe(false);
  });

  it('thread + Owner + 활성 Sub Agent 없음 → brain', () => {
    const result = routeMessage(makeMessage({ mode: 'thread' }), []);
    expect(result.action).toBe('brain');
  });

  it('web source + DM 모드 → brain', () => {
    const result = routeMessage(makeMessage({ source: 'web', mode: 'dm' }), []);
    expect(result.action).toBe('brain');
    expect(result.isOwner).toBe(true);
  });

  it('활성 세션이 있어도 다른 threadTs면 brain', () => {
    const sessions: ActiveSession[] = [
      { sessionId: 's1', threadTs: 'other-ts', agentType: 'sub', resumeId: 'r1', status: 'active' },
    ];
    const result = routeMessage(makeMessage({ mode: 'thread', threadTs: 'ts-1' }), sessions);
    expect(result.action).toBe('brain');
  });
});
