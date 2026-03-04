# Clackbot v4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** EventBus 중앙 이벤트 허브, 순수 함수 MessageRouter, 실시간 스트리밍 (Slack 3초 디바운스 + WebSocket 토큰 단위), 대시보드 실시간 채팅, Slack ↔ 대시보드 양방향 미러링을 구현한다.

**Architecture:** 모든 메시지/이벤트가 타입 안전한 EventBus를 통해 흐른다. MessageRouter가 순수 함수로 라우팅을 결정하고, Source(Slack/WebSocket)가 입력을 받아 EventBus에 발행하며, Sink(Slack/WebSocket)가 EventBus를 구독하여 각 채널에 적합한 방식으로 출력한다.

**Tech Stack:** Node.js EventEmitter (타입 래퍼), ws (WebSocket), Express, React, Vitest

**Design Doc:** `docs/plans/2026-03-04-v4-realtime-streaming-design.md`

---

## Phase 1: EventBus + MessageRouter

> 핵심 인프라. 기존 동작을 유지하면서 라우팅 로직을 순수 함수로 추출한다.

### Task 1: EventBus — 타입 안전 이벤트 허브

**Files:**
- Create: `src/events/types.ts`
- Create: `src/events/eventBus.ts`
- Create: `src/events/eventBus.test.ts`

**Step 1: 이벤트 타입 정의 작성**

```typescript
// src/events/types.ts
export type MessageSource = 'slack' | 'web';
export type MessageTarget = 'slack' | 'web' | 'all';
export type StreamType = 'token' | 'thinking' | 'tool_use' | 'tool_result';
export type SessionStatus = 'active' | 'completed' | 'failed' | 'expired';

export interface IncomingMessage {
  id: string;
  source: MessageSource;
  text: string;
  userId: string;
  channelId: string;
  threadTs: string;
  isOwner: boolean;
  mode: 'channel' | 'thread' | 'dm';
  attachments?: Array<{ name: string; path: string; mimeType: string }>;
  threadMessages?: Array<{ user: string; text: string; botId?: string }>;
}

export interface OutgoingMessage {
  id: string;
  target: MessageTarget;
  text: string;
  channelId: string;
  threadTs: string;
  sessionId: string;
  replaceTs?: string; // Slack 메시지 교체용 timestamp
}

export interface StreamData {
  content?: string;       // token 내용
  toolName?: string;      // tool_use 시 도구명
  toolInput?: string;     // tool_use 시 입력 요약
  toolResult?: string;    // tool_result 시 결과 요약
  thinkingSummary?: string; // thinking 요약
}

export interface AgentResult {
  text: string;
  toolsUsed: string[];
  resumeId?: string;
}

export interface EventMap {
  'message:incoming': { source: MessageSource; message: IncomingMessage };
  'message:outgoing': { target: MessageTarget; message: OutgoingMessage };
  'agent:stream': { sessionId: string; type: StreamType; data: StreamData };
  'agent:complete': { sessionId: string; result: AgentResult };
  'session:update': { sessionId: string; status: SessionStatus };
}
```

**Step 2: EventBus 테스트 작성**

```typescript
// src/events/eventBus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './eventBus.js';

describe('EventBus', () => {
  it('타입 안전하게 이벤트를 발행하고 구독한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('session:update', handler);
    bus.emit('session:update', { sessionId: 'test-1', status: 'active' });

    expect(handler).toHaveBeenCalledWith({ sessionId: 'test-1', status: 'active' });
  });

  it('off로 구독을 해제한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('session:update', handler);
    bus.off('session:update', handler);
    bus.emit('session:update', { sessionId: 'test-1', status: 'active' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('once로 1회만 수신한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.once('agent:complete', handler);
    bus.emit('agent:complete', { sessionId: 's1', result: { text: 'ok', toolsUsed: [] } });
    bus.emit('agent:complete', { sessionId: 's2', result: { text: 'no', toolsUsed: [] } });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('agent:stream 이벤트를 발행한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('agent:stream', handler);
    bus.emit('agent:stream', {
      sessionId: 's1',
      type: 'token',
      data: { content: 'hello' },
    });

    expect(handler).toHaveBeenCalledWith({
      sessionId: 's1',
      type: 'token',
      data: { content: 'hello' },
    });
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const { getEventBus } = await import('./eventBus.js');
    const a = getEventBus();
    const b = getEventBus();
    expect(a).toBe(b);
  });
});
```

**Step 3: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/events/eventBus.test.ts`
Expected: FAIL — 모듈 없음

**Step 4: EventBus 구현**

```typescript
// src/events/eventBus.ts
import { EventEmitter } from 'node:events';
import type { EventMap } from './types.js';

type EventHandler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

export class EventBus {
  private emitter = new EventEmitter();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  once<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    this.emitter.once(event, handler as (...args: unknown[]) => void);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  removeAllListeners(event?: keyof EventMap): void {
    this.emitter.removeAllListeners(event);
  }
}

// 싱글턴
let instance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!instance) {
    instance = new EventBus();
  }
  return instance;
}
```

**Step 5: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/events/eventBus.test.ts`
Expected: PASS (5 tests)

**Step 6: 커밋**

```bash
git add src/events/types.ts src/events/eventBus.ts src/events/eventBus.test.ts
git commit -m "feat: add typed EventBus — central event hub for v4 architecture"
```

---

### Task 2: MessageRouter — 순수 함수 라우팅

**Files:**
- Create: `src/router/types.ts`
- Create: `src/router/messageRouter.ts`
- Create: `src/router/messageRouter.test.ts`

**Step 1: 라우터 타입 정의 작성**

```typescript
// src/router/types.ts
import type { IncomingMessage } from '../events/types.js';

export interface ActiveSession {
  sessionId: string;
  threadTs: string;
  agentType: 'brain' | 'sub';
  resumeId?: string;
  status: 'active' | 'completed' | 'failed' | 'expired';
}

export interface RouteDecision {
  action: 'brain' | 'agent_resume' | 'agent_new' | 'direct_reply' | 'reject';
  sessionId?: string;
  resumeId?: string;
  mode: 'dm' | 'thread' | 'channel';
  isOwner: boolean;
}
```

**Step 2: MessageRouter 테스트 작성**

```typescript
// src/router/messageRouter.test.ts
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
```

**Step 3: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/router/messageRouter.test.ts`
Expected: FAIL

**Step 4: MessageRouter 구현**

```typescript
// src/router/messageRouter.ts
import type { IncomingMessage } from '../events/types.js';
import type { ActiveSession, RouteDecision } from './types.js';

/**
 * 순수 함수: 메시지와 활성 세션 상태를 받아 라우팅 결정을 반환한다.
 * 사이드 이펙트 없음.
 */
export function routeMessage(
  message: IncomingMessage,
  activeSessions: ActiveSession[],
): RouteDecision {
  const { mode, isOwner, threadTs } = message;

  // 1. channel 모드 → 항상 1회성 agent (Brain 불필요)
  if (mode === 'channel') {
    return {
      action: 'agent_new',
      mode,
      isOwner,
    };
  }

  // 2. 활성 Sub Agent 세션이 같은 thread에 있으면 이어서 진행
  const activeSubAgent = activeSessions.find(
    (s) => s.threadTs === threadTs && s.agentType === 'sub' && s.status === 'active',
  );
  if (activeSubAgent) {
    return {
      action: 'agent_resume',
      sessionId: activeSubAgent.sessionId,
      resumeId: activeSubAgent.resumeId,
      mode,
      isOwner,
    };
  }

  // 3. DM/thread + 활성 Sub Agent 없음 → Brain 라우팅
  return {
    action: 'brain',
    mode,
    isOwner,
  };
}
```

**Step 5: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/router/messageRouter.test.ts`
Expected: PASS (7 tests)

**Step 6: 커밋**

```bash
git add src/router/types.ts src/router/messageRouter.ts src/router/messageRouter.test.ts
git commit -m "feat: add MessageRouter — pure function routing with full test coverage"
```

---

### Task 3: handler.ts 리팩터링 — EventBus + MessageRouter 통합

**Files:**
- Modify: `src/slack/listeners/handler.ts`
- Ref: `src/events/eventBus.ts`, `src/router/messageRouter.ts`
- Ref: `src/store/agentSessions.ts` (getAgentSessionByThread)

**Step 1: handler.ts에서 라우팅 로직을 routeMessage() 호출로 교체**

핵심 변경: `handler.ts`의 if-else 라우팅 블록을 `routeMessage()` 호출 + switch로 교체하고, 결과를 EventBus에 발행한다. 기존 동작(queryBrain, queryAgent, 진행 표시, 세션 관리)은 그대로 유지한다.

변경 영역 (handler.ts 내부):
1. Import 추가: `EventBus`, `routeMessage`, 타입들
2. `handleMessage()` 시작 부분에서 `getEventBus()`로 bus 취득
3. `message:incoming` 이벤트 발행 (라우팅 전)
4. 기존 라우팅 if-else → `routeMessage()` 호출 + switch 문
5. 응답 완료 시 `agent:complete` 이벤트 발행
6. 기존 진행 콜백에서 `agent:stream` 이벤트 발행 (추가)

> **중요:** 기존 동작을 100% 유지한다. EventBus 발행은 "추가"이지 "교체"가 아니다.
> handler.ts 내부의 `queryBrain()`, `queryAgent()` 호출, 세션 관리, "생각 중..." 메시지 등은 그대로 둔다.
> 이 단계에서는 EventBus 이벤트를 구독하는 소비자가 아직 없으므로, 발행만 하면 된다.

**Step 2: 수동 테스트**

`clackbot start`로 봇을 시작하고:
1. DM 메시지 → Brain 라우팅 확인
2. 채널 멘션 → agent_new 라우팅 확인
3. 스레드 이어가기 → agent_resume 확인

**Step 3: 커밋**

```bash
git add src/slack/listeners/handler.ts
git commit -m "refactor: integrate EventBus + MessageRouter into handler.ts"
```

---

## Phase 2: 실시간 스트리밍 (Slack)

> Agent SDK 스트리밍 이벤트를 EventBus로 발행하고, SlackSink가 3초 디바운스로 chat.update 한다.

### Task 4: Agent SDK 스트리밍 이벤트 → EventBus 발행

**Files:**
- Modify: `src/agent/claude.ts` (queryAgent 내부)
- Modify: `src/agent/brain.ts` (queryBrain 내부)

**Step 1: claude.ts의 streaming 콜백에서 agent:stream 이벤트 발행**

Agent SDK `query()` 호출 시 `messages` 배열이 스트리밍으로 전달된다. 현재 이 배열을 순회하면서 진행 콜백(`onProgress`)을 호출하는 로직이 있다. 여기에 EventBus `agent:stream` 발행을 추가한다:

- `content_block_delta` (text) → `agent:stream { type: 'token', data: { content } }`
- `thinking` 블록 → `agent:stream { type: 'thinking', data: { thinkingSummary } }`
- `tool_use` → `agent:stream { type: 'tool_use', data: { toolName, toolInput } }`
- `tool_result` → `agent:stream { type: 'tool_result', data: { toolName, toolResult } }`
- 완료 → `agent:complete { sessionId, result }`

brain.ts도 동일한 패턴으로 이벤트를 발행한다.

**Step 2: 커밋**

```bash
git add src/agent/claude.ts src/agent/brain.ts
git commit -m "feat: emit agent:stream events from Agent SDK to EventBus"
```

---

### Task 5: SlackSink — 3초 디바운스 실시간 업데이트

**Files:**
- Create: `src/sinks/slackSink.ts`
- Create: `src/sinks/slackSink.test.ts`

**Step 1: SlackSink 테스트 작성**

```typescript
// src/sinks/slackSink.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackSink } from './slackSink.js';
import { EventBus } from '../events/eventBus.js';

describe('SlackSink', () => {
  let bus: EventBus;
  let mockClient: { chat: { update: ReturnType<typeof vi.fn> } };
  let sink: SlackSink;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = new EventBus();
    mockClient = { chat: { update: vi.fn().mockResolvedValue({}) } };
    sink = new SlackSink(bus, mockClient as any);
  });

  afterEach(() => {
    sink.dispose();
    vi.useRealTimers();
  });

  it('agent:stream token 이벤트를 3초 디바운스로 chat.update 호출', async () => {
    sink.startSession('s1', 'C001', 'ts-msg');

    bus.emit('agent:stream', { sessionId: 's1', type: 'token', data: { content: '안녕' } });
    bus.emit('agent:stream', { sessionId: 's1', type: 'token', data: { content: '하세요' } });

    // 3초 전에는 호출 안 됨
    expect(mockClient.chat.update).not.toHaveBeenCalled();

    // 3초 후 호출
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockClient.chat.update).toHaveBeenCalledTimes(1);
    expect(mockClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('안녕하세요') }),
    );
  });

  it('thinking 이벤트를 요약 형태로 표시', async () => {
    sink.startSession('s1', 'C001', 'ts-msg');

    bus.emit('agent:stream', {
      sessionId: 's1',
      type: 'thinking',
      data: { thinkingSummary: '채널 분석 중' },
    });

    await vi.advanceTimersByTimeAsync(3000);
    expect(mockClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('채널 분석 중') }),
    );
  });

  it('tool_use 이벤트를 도구명과 함께 표시', async () => {
    sink.startSession('s1', 'C001', 'ts-msg');

    bus.emit('agent:stream', {
      sessionId: 's1',
      type: 'tool_use',
      data: { toolName: 'slack_read_channel' },
    });

    await vi.advanceTimersByTimeAsync(3000);
    expect(mockClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('slack_read_channel') }),
    );
  });

  it('agent:complete로 최종 응답 교체', () => {
    sink.startSession('s1', 'C001', 'ts-msg');

    bus.emit('agent:complete', {
      sessionId: 's1',
      result: { text: '최종 응답입니다', toolsUsed: ['Read'] },
    });

    expect(mockClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('최종 응답입니다') }),
    );
  });

  it('관련 없는 sessionId 이벤트는 무시', async () => {
    sink.startSession('s1', 'C001', 'ts-msg');

    bus.emit('agent:stream', { sessionId: 'other', type: 'token', data: { content: '무시' } });

    await vi.advanceTimersByTimeAsync(3000);
    expect(mockClient.chat.update).not.toHaveBeenCalled();
  });
});
```

**Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/sinks/slackSink.test.ts`
Expected: FAIL

**Step 3: SlackSink 구현**

```typescript
// src/sinks/slackSink.ts
import type { WebClient } from '@slack/web-api';
import type { EventBus } from '../events/eventBus.js';
import type { StreamData } from '../events/types.js';
import { markdownToMrkdwn, truncateText } from '../utils/slackFormat.js';

interface SessionState {
  channelId: string;
  messageTs: string;
  buffer: string;
  activities: string[];
  timer: ReturnType<typeof setTimeout> | null;
}

const DEBOUNCE_MS = 3000;

export class SlackSink {
  private sessions = new Map<string, SessionState>();

  constructor(
    private bus: EventBus,
    private client: WebClient,
  ) {
    this.bus.on('agent:stream', this.handleStream);
    this.bus.on('agent:complete', this.handleComplete);
  }

  startSession(sessionId: string, channelId: string, messageTs: string): void {
    this.sessions.set(sessionId, {
      channelId,
      messageTs,
      buffer: '',
      activities: [],
      timer: null,
    });
  }

  dispose(): void {
    this.bus.off('agent:stream', this.handleStream);
    this.bus.off('agent:complete', this.handleComplete);
    for (const state of this.sessions.values()) {
      if (state.timer) clearTimeout(state.timer);
    }
    this.sessions.clear();
  }

  private handleStream = (payload: { sessionId: string; type: string; data: StreamData }): void => {
    const state = this.sessions.get(payload.sessionId);
    if (!state) return;

    switch (payload.type) {
      case 'token':
        state.buffer += payload.data.content ?? '';
        break;
      case 'thinking':
        state.activities.push(`🧠 _${payload.data.thinkingSummary}_`);
        break;
      case 'tool_use':
        state.activities.push(`🔧 _${payload.data.toolName} 실행 중..._`);
        break;
      case 'tool_result':
        // tool_result는 activities에 추가하지 않음 (tool_use로 충분)
        break;
    }

    this.scheduleUpdate(payload.sessionId, state);
  };

  private handleComplete = (payload: { sessionId: string; result: { text: string; toolsUsed: string[] } }): void => {
    const state = this.sessions.get(payload.sessionId);
    if (!state) return;

    // 타이머 취소
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    // 최종 응답으로 교체
    const text = truncateText(markdownToMrkdwn(payload.result.text));
    void this.client.chat.update({
      channel: state.channelId,
      ts: state.messageTs,
      text,
    });

    this.sessions.delete(payload.sessionId);
  };

  private scheduleUpdate(sessionId: string, state: SessionState): void {
    if (state.timer) return; // 이미 예약됨

    state.timer = setTimeout(() => {
      state.timer = null;
      void this.flushUpdate(sessionId, state);
    }, DEBOUNCE_MS);
  }

  private async flushUpdate(sessionId: string, state: SessionState): Promise<void> {
    const lines: string[] = [];

    // 활동 요약 (최근 3개)
    const recentActivities = state.activities.slice(-3);
    if (recentActivities.length > 0) {
      lines.push(recentActivities.join('\n'));
    }

    // 현재 버퍼 미리보기 (처음 200자)
    if (state.buffer) {
      const preview = state.buffer.slice(0, 200);
      lines.push(`\n${markdownToMrkdwn(preview)}${state.buffer.length > 200 ? '...' : ''}`);
    }

    if (lines.length === 0) return;

    const text = truncateText(lines.join('\n'));

    try {
      await this.client.chat.update({
        channel: state.channelId,
        ts: state.messageTs,
        text,
      });
    } catch {
      // Slack API 에러 무시 (rate limit 등)
    }
  }
}
```

**Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/sinks/slackSink.test.ts`
Expected: PASS (5 tests)

**Step 5: 커밋**

```bash
git add src/sinks/slackSink.ts src/sinks/slackSink.test.ts
git commit -m "feat: add SlackSink — 3-second debounced streaming updates to Slack"
```

---

### Task 6: handler.ts에 SlackSink 연결

**Files:**
- Modify: `src/slack/listeners/handler.ts`

**Step 1: handler.ts에서 SlackSink를 사용하도록 변경**

1. `handleMessage()` 시작 시 SlackSink 인스턴스 생성 (또는 싱글턴)
2. "생각 중..." 메시지 게시 후 `sink.startSession(sessionId, channelId, thinkingMsgTs)` 호출
3. 기존 진행 콜백은 유지 (하위 호환)
4. 완료 시 `agent:complete` 이벤트가 SlackSink를 통해 자동으로 메시지 교체

> 기존 `chat.update()` 직접 호출은 SlackSink가 `agent:complete`를 처리하므로 제거 가능하지만,
> Phase 1에서는 안전하게 양쪽 모두 유지하고, Phase 3 이후 정리한다.

**Step 2: 수동 테스트**

봇에게 DM으로 복잡한 요청을 보내고:
- "생각 중..." 메시지가 3초마다 진행 상황으로 업데이트되는지 확인
- thinking 요약, tool 사용 현황이 표시되는지 확인
- 최종 응답으로 정상 교체되는지 확인

**Step 3: 커밋**

```bash
git add src/slack/listeners/handler.ts
git commit -m "feat: connect SlackSink to handler for real-time Slack streaming"
```

---

## Phase 3: WebSocket 서버

> Express 서버에 WebSocket을 통합하고, WebSocketSink가 토큰 단위로 스트리밍한다.

### Task 7: ws 패키지 설치 + WebSocket 서버

**Files:**
- Create: `src/web/ws.ts`
- Modify: `src/web/server.ts`

**Step 1: ws 패키지 설치**

```bash
npm install ws
npm install -D @types/ws
```

**Step 2: WebSocket 서버 구현**

```typescript
// src/web/ws.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { getEventBus } from '../events/eventBus.js';
import { logger } from '../utils/logger.js';

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });
  const bus = getEventBus();

  wss.on('connection', (ws) => {
    logger.info('[WebSocket] 클라이언트 연결됨');

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        // Phase 5에서 message:incoming 처리 추가
        logger.debug('[WebSocket] 수신:', data);
      } catch {
        logger.warn('[WebSocket] 잘못된 메시지 형식');
      }
    });

    ws.on('close', () => {
      logger.info('[WebSocket] 클라이언트 연결 해제');
    });
  });

  // EventBus → 모든 WebSocket 클라이언트에 브로드캐스트
  bus.on('agent:stream', (payload) => {
    broadcast({ event: 'agent:stream', ...payload });
  });

  bus.on('agent:complete', (payload) => {
    broadcast({ event: 'agent:complete', ...payload });
  });

  bus.on('session:update', (payload) => {
    broadcast({ event: 'session:update', ...payload });
  });

  bus.on('message:outgoing', (payload) => {
    if (payload.target === 'web' || payload.target === 'all') {
      broadcast({ event: 'message:outgoing', message: payload.message });
    }
  });

  return wss;
}

function broadcast(data: unknown): void {
  if (!wss) return;
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}
```

**Step 3: server.ts에 WebSocket 통합**

`startWebServer()` 함수에서 `server.listen()` 반환값에 `setupWebSocket(httpServer)` 호출을 추가한다. Express의 `app.listen()`은 `http.Server`를 반환하므로 이를 활용한다.

```typescript
// server.ts 변경 사항:
// import { setupWebSocket } from './ws.js';
//
// startWebServer() 내부:
// const httpServer = app.listen(port, ...);
// setupWebSocket(httpServer);
```

**Step 4: 커밋**

```bash
git add src/web/ws.ts src/web/server.ts package.json package-lock.json
git commit -m "feat: add WebSocket server integrated with Express and EventBus"
```

---

### Task 8: WebSocketSink — 토큰 단위 스트리밍

**Files:**
- Create: `src/sinks/webSocketSink.ts`
- Create: `src/sinks/webSocketSink.test.ts`

**Step 1: WebSocketSink 테스트 작성**

```typescript
// src/sinks/webSocketSink.test.ts
import { describe, it, expect, vi } from 'vitest';
import { WebSocketSink } from './webSocketSink.js';
import { EventBus } from '../events/eventBus.js';

describe('WebSocketSink', () => {
  it('agent:stream 이벤트를 즉시 브로드캐스트', () => {
    const bus = new EventBus();
    const mockBroadcast = vi.fn();
    const sink = new WebSocketSink(bus, mockBroadcast);

    bus.emit('agent:stream', {
      sessionId: 's1',
      type: 'token',
      data: { content: '안녕' },
    });

    expect(mockBroadcast).toHaveBeenCalledTimes(1);
    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'agent:stream', type: 'token' }),
    );

    sink.dispose();
  });

  it('agent:complete 이벤트를 브로드캐스트', () => {
    const bus = new EventBus();
    const mockBroadcast = vi.fn();
    const sink = new WebSocketSink(bus, mockBroadcast);

    bus.emit('agent:complete', {
      sessionId: 's1',
      result: { text: '완료', toolsUsed: [] },
    });

    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'agent:complete' }),
    );

    sink.dispose();
  });
});
```

**Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/sinks/webSocketSink.test.ts`
Expected: FAIL

**Step 3: WebSocketSink 구현**

```typescript
// src/sinks/webSocketSink.ts
import type { EventBus } from '../events/eventBus.js';
import type { EventMap } from '../events/types.js';

type BroadcastFn = (data: unknown) => void;

export class WebSocketSink {
  constructor(
    private bus: EventBus,
    private broadcast: BroadcastFn,
  ) {
    this.bus.on('agent:stream', this.handleStream);
    this.bus.on('agent:complete', this.handleComplete);
    this.bus.on('session:update', this.handleSessionUpdate);
  }

  dispose(): void {
    this.bus.off('agent:stream', this.handleStream);
    this.bus.off('agent:complete', this.handleComplete);
    this.bus.off('session:update', this.handleSessionUpdate);
  }

  private handleStream = (payload: EventMap['agent:stream']): void => {
    this.broadcast({
      event: 'agent:stream',
      sessionId: payload.sessionId,
      type: payload.type,
      data: payload.data,
    });
  };

  private handleComplete = (payload: EventMap['agent:complete']): void => {
    this.broadcast({
      event: 'agent:complete',
      sessionId: payload.sessionId,
      result: payload.result,
    });
  };

  private handleSessionUpdate = (payload: EventMap['session:update']): void => {
    this.broadcast({
      event: 'session:update',
      sessionId: payload.sessionId,
      status: payload.status,
    });
  };
}
```

**Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/sinks/webSocketSink.test.ts`
Expected: PASS (2 tests)

**Step 5: 커밋**

```bash
git add src/sinks/webSocketSink.ts src/sinks/webSocketSink.test.ts
git commit -m "feat: add WebSocketSink — token-level streaming to dashboard"
```

---

## Phase 4: 대시보드 실시간 채팅 UI

> React 대시보드에 실시간 채팅 페이지를 추가한다.

### Task 9: WebSocket 클라이언트 hook

**Files:**
- Create: `src/web/frontend/hooks/useWebSocket.ts`
- Create: `src/web/frontend/hooks/useChatStream.ts`

**Step 1: useWebSocket hook 구현**

```typescript
// src/web/frontend/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback, useState } from 'react';

type MessageHandler = (data: unknown) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // 3초 후 재연결 시도
      setTimeout(() => {
        // 컴포넌트가 아직 마운트된 경우에만
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 3000);
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch { /* 무시 */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [onMessage]);

  return { connected, send };
}
```

**Step 2: useChatStream hook 구현**

```typescript
// src/web/frontend/hooks/useChatStream.ts
import { useCallback, useReducer } from 'react';
import { useWebSocket } from './useWebSocket.js';

interface StreamState {
  sessions: Map<string, SessionStream>;
}

interface SessionStream {
  tokens: string;
  thinking: string[];
  tools: Array<{ name: string; status: 'running' | 'done' }>;
  completed: boolean;
  finalText?: string;
}

type StreamAction =
  | { type: 'token'; sessionId: string; content: string }
  | { type: 'thinking'; sessionId: string; summary: string }
  | { type: 'tool_use'; sessionId: string; toolName: string }
  | { type: 'tool_result'; sessionId: string; toolName: string }
  | { type: 'complete'; sessionId: string; text: string }
  | { type: 'reset'; sessionId: string };

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  const sessions = new Map(state.sessions);
  const current = sessions.get(action.sessionId) ?? {
    tokens: '',
    thinking: [],
    tools: [],
    completed: false,
  };

  switch (action.type) {
    case 'token':
      sessions.set(action.sessionId, { ...current, tokens: current.tokens + action.content });
      break;
    case 'thinking':
      sessions.set(action.sessionId, {
        ...current,
        thinking: [...current.thinking, action.summary],
      });
      break;
    case 'tool_use':
      sessions.set(action.sessionId, {
        ...current,
        tools: [...current.tools, { name: action.toolName, status: 'running' }],
      });
      break;
    case 'tool_result':
      sessions.set(action.sessionId, {
        ...current,
        tools: current.tools.map((t) =>
          t.name === action.toolName ? { ...t, status: 'done' as const } : t,
        ),
      });
      break;
    case 'complete':
      sessions.set(action.sessionId, {
        ...current,
        completed: true,
        finalText: action.text,
      });
      break;
    case 'reset':
      sessions.delete(action.sessionId);
      break;
  }

  return { sessions };
}

export function useChatStream() {
  const [state, dispatch] = useReducer(streamReducer, { sessions: new Map() });

  const handleMessage = useCallback((data: any) => {
    switch (data.event) {
      case 'agent:stream':
        if (data.type === 'token' && data.data?.content) {
          dispatch({ type: 'token', sessionId: data.sessionId, content: data.data.content });
        } else if (data.type === 'thinking' && data.data?.thinkingSummary) {
          dispatch({ type: 'thinking', sessionId: data.sessionId, summary: data.data.thinkingSummary });
        } else if (data.type === 'tool_use' && data.data?.toolName) {
          dispatch({ type: 'tool_use', sessionId: data.sessionId, toolName: data.data.toolName });
        } else if (data.type === 'tool_result' && data.data?.toolName) {
          dispatch({ type: 'tool_result', sessionId: data.sessionId, toolName: data.data.toolName });
        }
        break;
      case 'agent:complete':
        if (data.result?.text) {
          dispatch({ type: 'complete', sessionId: data.sessionId, text: data.result.text });
        }
        break;
    }
  }, []);

  const { connected, send } = useWebSocket(handleMessage);

  return { streams: state.sessions, connected, send };
}
```

**Step 3: 커밋**

```bash
git add src/web/frontend/hooks/useWebSocket.ts src/web/frontend/hooks/useChatStream.ts
git commit -m "feat: add useWebSocket and useChatStream hooks for real-time dashboard"
```

---

### Task 10: 실시간 채팅 페이지 UI

**Files:**
- Create: `src/web/frontend/pages/ChatPage.tsx`
- Create: `src/web/frontend/components/chat/ChatMessage.tsx`
- Create: `src/web/frontend/components/chat/StreamingIndicator.tsx`
- Create: `src/web/frontend/components/chat/ThinkingPanel.tsx`
- Modify: `src/web/frontend/App.tsx` (라우트 추가)

**Step 1: ChatMessage 컴포넌트**

대화 메시지 하나를 렌더링. 사용자/봇 구분, 마크다운 렌더링.

**Step 2: StreamingIndicator 컴포넌트**

스트리밍 중인 토큰을 실시간으로 표시. 커서 깜빡임 애니메이션.

**Step 3: ThinkingPanel 컴포넌트**

접을 수 있는 thinking 과정 패널. Tool 사용 상태 (실행 중/완료).

**Step 4: ChatPage 조합**

- `useChatStream()` hook으로 실시간 데이터 수신
- 세션 목록 사이드바 (활성 세션 선택)
- 선택된 세션의 메시지 + 스트리밍 표시
- 하단 입력창 (Phase 5에서 활성화)

**Step 5: App.tsx 라우트 추가**

```typescript
// App.tsx에 추가
import { ChatPage } from './pages/ChatPage.js';
// ...
<Route path="/chat" element={<ChatPage />} />
```

**Step 6: 커밋**

```bash
git add src/web/frontend/pages/ChatPage.tsx \
  src/web/frontend/components/chat/ChatMessage.tsx \
  src/web/frontend/components/chat/StreamingIndicator.tsx \
  src/web/frontend/components/chat/ThinkingPanel.tsx \
  src/web/frontend/App.tsx
git commit -m "feat: add real-time chat page with streaming UI components"
```

---

## Phase 5: 양방향 미러링

> 대시보드에서 메시지를 입력하면 Brain Agent로 전달되고, Slack에도 미러링된다.

### Task 11: WebSocketSource — 대시보드 입력 → EventBus

**Files:**
- Create: `src/sources/webSocketSource.ts`
- Modify: `src/web/ws.ts`

**Step 1: WebSocketSource 구현**

```typescript
// src/sources/webSocketSource.ts
import { v4 as uuid } from 'uuid';
import { getEventBus } from '../events/eventBus.js';
import type { IncomingMessage } from '../events/types.js';
import { logger } from '../utils/logger.js';

export interface WebChatMessage {
  type: 'chat:send';
  text: string;
  channelId?: string;  // Slack 채널 미러링용
  threadTs?: string;    // 기존 스레드 이어가기
}

export function handleWebSocketMessage(raw: unknown): void {
  const data = raw as WebChatMessage;
  if (data.type !== 'chat:send' || !data.text) return;

  const bus = getEventBus();
  const message: IncomingMessage = {
    id: uuid(),
    source: 'web',
    text: data.text,
    userId: 'owner',        // 대시보드 접근 = Owner
    channelId: data.channelId ?? 'web-direct',
    threadTs: data.threadTs ?? `web-${Date.now()}`,
    isOwner: true,
    mode: 'dm',             // 대시보드 채팅은 항상 DM(감독) 모드
  };

  logger.info(`[WebSocketSource] 대시보드 메시지 수신: ${data.text.slice(0, 50)}`);
  bus.emit('message:incoming', { source: 'web', message });
}
```

**Step 2: ws.ts에서 WebSocketSource 연결**

ws.ts의 `ws.on('message')` 핸들러에서 `handleWebSocketMessage(data)`를 호출한다.

**Step 3: 커밋**

```bash
git add src/sources/webSocketSource.ts src/web/ws.ts
git commit -m "feat: add WebSocketSource — dashboard input to EventBus"
```

---

### Task 12: message:incoming 이벤트 처리 — Brain/Agent 라우팅 실행

**Files:**
- Modify: `src/slack/listeners/handler.ts` (또는 새 파일 `src/events/messageHandler.ts`)

**Step 1: EventBus message:incoming 구독 → handleMessage 연결**

`message:incoming` 이벤트를 구독하여, web 소스에서 온 메시지도 Brain/Agent 라우팅을 거치도록 한다.

핵심 로직:
1. `message:incoming` 이벤트 수신
2. `routeMessage()` 호출
3. 라우팅 결정에 따라 `queryBrain()` 또는 `queryAgent()` 실행
4. 결과를 `agent:complete` 이벤트로 발행
5. web 소스일 경우 SlackSink도 동작 (Slack에 미러링)

**Step 2: web 소스 메시지의 Slack 미러링**

web에서 온 메시지가 `channelId`를 포함하면:
- 응답을 해당 Slack 채널/스레드에도 `slack_post`로 전송
- SlackSink가 `agent:complete`를 수신하여 자동 처리

**Step 3: 커밋**

```bash
git add src/slack/listeners/handler.ts
git commit -m "feat: handle web-source messages via EventBus for bidirectional mirroring"
```

---

### Task 13: 대시보드 채팅 입력 활성화

**Files:**
- Modify: `src/web/frontend/pages/ChatPage.tsx`

**Step 1: 입력창 WebSocket 전송 연결**

ChatPage 하단 입력창에서 `send({ type: 'chat:send', text, channelId, threadTs })`를 호출하도록 한다.

**Step 2: Slack 채널 선택 드롭다운**

- 활성 세션의 채널 목록을 표시
- 새 대화 시작 또는 기존 Slack 스레드 이어가기 선택

**Step 3: 수동 E2E 테스트**

1. 대시보드에서 메시지 입력
2. Brain Agent 응답이 대시보드에 스트리밍되는지 확인
3. 동시에 Slack 채널/DM에도 미러링되는지 확인
4. Slack에서 답장 → 대시보드에도 표시되는지 확인

**Step 4: 커밋**

```bash
git add src/web/frontend/pages/ChatPage.tsx
git commit -m "feat: enable chat input with Slack bidirectional mirroring"
```

---

### Task 14: SlackSource — Slack 이벤트 → EventBus 발행

**Files:**
- Create: `src/sources/slackSource.ts`
- Modify: `src/slack/listeners/appMention.ts`
- Modify: `src/slack/listeners/directMessage.ts`

**Step 1: SlackSource 구현**

```typescript
// src/sources/slackSource.ts
import { v4 as uuid } from 'uuid';
import { getEventBus } from '../events/eventBus.js';
import type { IncomingMessage } from '../events/types.js';

export function emitSlackIncoming(params: {
  text: string;
  userId: string;
  channelId: string;
  threadTs: string;
  isOwner: boolean;
  mode: 'channel' | 'thread' | 'dm';
  attachments?: IncomingMessage['attachments'];
  threadMessages?: IncomingMessage['threadMessages'];
}): void {
  const bus = getEventBus();
  const message: IncomingMessage = {
    id: uuid(),
    source: 'slack',
    ...params,
  };
  bus.emit('message:incoming', { source: 'slack', message });
}
```

**Step 2: appMention.ts와 directMessage.ts에서 emitSlackIncoming 호출**

기존 `handleMessage()` 호출 직전에 `emitSlackIncoming()`을 호출하여 WebSocket 대시보드에도 Slack 메시지가 전파되도록 한다. `handleMessage()` 호출은 그대로 유지.

**Step 3: 커밋**

```bash
git add src/sources/slackSource.ts src/slack/listeners/appMention.ts src/slack/listeners/directMessage.ts
git commit -m "feat: add SlackSource — emit Slack events to EventBus for dashboard mirroring"
```

---

### Task 15: 최종 통합 테스트 + 정리

**Files:**
- All modified files

**Step 1: 전체 테스트 실행**

Run: `npx vitest run`
Expected: 모든 테스트 통과

**Step 2: 수동 E2E 테스트 체크리스트**

- [ ] Slack DM → Brain 라우팅 → 실시간 진행 표시 (3초 갱신) → 최종 응답
- [ ] Slack 채널 멘션 → 1회성 응답
- [ ] Slack 스레드 이어가기 → Sub Agent resume
- [ ] 대시보드 채팅 → Brain 라우팅 → 토큰 단위 스트리밍
- [ ] 대시보드 입력 → Slack 미러링
- [ ] Slack 메시지 → 대시보드 실시간 표시
- [ ] thinking/tool 과정이 대시보드에 실시간 표시
- [ ] WebSocket 재연결 (서버 재시작 후)

**Step 3: handler.ts 정리**

Phase 1에서 양쪽 유지했던 기존 `chat.update()` 직접 호출을 정리한다. SlackSink가 `agent:complete`를 통해 처리하므로 중복 제거.

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete v4 architecture — EventBus, streaming, bidirectional mirroring"
```

---

## 요약

| Phase | Tasks | 핵심 산출물 |
|-------|-------|------------|
| 1: EventBus + Router | 1-3 | `eventBus.ts`, `messageRouter.ts`, handler 리팩터링 |
| 2: Slack 스트리밍 | 4-6 | `slackSink.ts`, agent SDK 이벤트 발행 |
| 3: WebSocket | 7-8 | `ws.ts`, `webSocketSink.ts` |
| 4: 대시보드 채팅 | 9-10 | `useWebSocket`, `useChatStream`, ChatPage |
| 5: 양방향 미러링 | 11-14 | `webSocketSource.ts`, `slackSource.ts`, 입력 활성화 |
| 통합 | 15 | 전체 테스트 + 정리 |
