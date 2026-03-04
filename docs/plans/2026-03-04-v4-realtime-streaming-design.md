# Clackbot v4 디자인: 실시간 스트리밍 + 라우터 + 대시보드 채팅

> 날짜: 2026-03-04
> 영감: [Estelle2](https://github.com/sirgrey8209/estelle2) — Claude Code 원격 제어 시스템

---

## 배경

Clackbot v3 (Brain Agent)는 "생각 중..." 메시지를 올린 뒤 완료 시 `chat.update()`로 교체하는 방식이다. Estelle2의 실시간 스트리밍, 순수 함수 라우터, 멀티디바이스 동기화 패턴에서 영감을 받아 세 가지 영역을 개선한다.

---

## 1. 전체 아키텍처 (v4)

```
                    ┌─────────────────────────────────────┐
                    │           EventBus (중앙)             │
                    │  message:incoming                    │
                    │  message:outgoing                    │
                    │  agent:stream (token/thinking/tool)  │
                    │  agent:complete                      │
                    │  session:update                      │
                    └──┬──────────┬──────────┬─────────────┘
                       │          │          │
              ┌────────▼──┐  ┌───▼────┐  ┌──▼───────────┐
              │ SlackSource│  │WebSocket│  │ MessageRouter│
              │ (Bolt App) │  │ Source  │  │ (순수 함수)   │
              └────────────┘  └────────┘  └──────────────┘
                                              │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                         queryBrain()    queryAgent()    directReply()
                              │                │
                              ▼                ▼
                        Agent SDK query() — 스트리밍 이벤트
                              │
                              ▼
                    EventBus: agent:stream →
                      ├─ SlackSink (3초 chat.update)
                      └─ WebSocketSink (토큰 단위)
```

### 핵심 컴포넌트

| 컴포넌트 | 역할 |
|----------|------|
| **EventBus** | 모든 메시지/이벤트의 중앙 허브 (타입 안전 EventEmitter) |
| **MessageRouter** | 순수 함수로 라우팅 결정 (입력→결정, 사이드 이펙트 없음) |
| **SlackSource** | Slack Bolt App에서 이벤트 수신 → EventBus 발행 |
| **WebSocketSource** | 대시보드 WebSocket에서 메시지 수신 → EventBus 발행 |
| **SlackSink** | EventBus 구독 → 3초 디바운스 `chat.update()` |
| **WebSocketSink** | EventBus 구독 → 토큰 단위 실시간 스트리밍 |

---

## 2. EventBus 설계

```typescript
// src/events/eventBus.ts
type EventMap = {
  'message:incoming':  { source: 'slack' | 'web'; message: IncomingMessage }
  'message:outgoing':  { target: 'slack' | 'web' | 'all'; message: OutgoingMessage }
  'agent:stream':      { sessionId: string; type: 'token' | 'thinking' | 'tool_use' | 'tool_result'; data: StreamData }
  'agent:complete':    { sessionId: string; result: AgentResult }
  'session:update':    { sessionId: string; status: SessionStatus }
}
```

- Node.js `EventEmitter` 기반, 타입 안전한 래퍼
- 모든 컴포넌트가 EventBus를 통해서만 통신
- 로깅/디버깅을 위한 이벤트 히스토리 옵션

---

## 3. MessageRouter (순수 함수)

```typescript
// src/router/messageRouter.ts
interface RouteDecision {
  action: 'brain' | 'agent_resume' | 'direct_reply' | 'reject'
  sessionId?: string
  mode: 'dm' | 'thread' | 'channel'
  permissions: PermissionSet
}

function routeMessage(message: IncomingMessage, sessions: ActiveSessions): RouteDecision
```

### 현재 handler.ts → 리팩터링

- `handler.ts`의 절차적 라우팅 로직을 `routeMessage()` 순수 함수로 추출
- 입력(메시지 + 세션 상태) → 출력(라우팅 결정), 사이드 이펙트 없음
- 단위 테스트로 모든 라우팅 시나리오 검증 가능
- `handler.ts`는 EventBus 구독 + `routeMessage()` 호출 + 실행만 담당

---

## 4. 실시간 스트리밍

### Slack (SlackSink)

- Agent SDK `query()` 스트리밍 이벤트 → EventBus `agent:stream`
- **3초 디바운스**로 `chat.update()` 호출 (Slack rate limit 준수)
- Thinking → 요약 표시 (예: "🧠 *채널 히스토리 분석 중...*")
- Tool use → 도구명 표시 (예: "🔧 *slack_read_channel 실행 중...*")
- 완료 시 최종 응답으로 교체

### 대시보드 (WebSocketSink)

- WebSocket으로 **토큰 단위** 실시간 스트리밍
- Thinking 전체 과정 표시 (접을 수 있는 UI)
- Tool use/result 실시간 표시
- 타이핑 인디케이터

---

## 5. 대시보드 채팅 + Slack 양방향 미러링

### 대시보드 → Slack

1. 대시보드에서 메시지 입력
2. WebSocket → EventBus `message:incoming` (source: 'web')
3. MessageRouter → Brain/Agent 라우팅
4. 응답 생성 → EventBus `message:outgoing` (target: 'all')
5. SlackSink → 해당 Slack 채널/DM에 메시지 전송
6. WebSocketSink → 대시보드에 스트리밍

### Slack → 대시보드

1. Slack 이벤트 수신
2. EventBus `message:incoming` (source: 'slack')
3. 라우팅 + 응답 생성
4. WebSocketSink → 연결된 대시보드에 실시간 전파

### 세션 동기화

- 대시보드 접속 시 활성 세션 목록 + 최근 메시지 로드
- 이후 WebSocket으로 실시간 동기화

---

## 6. 새 디렉토리 구조 (추가분)

```
src/
├── events/
│   └── eventBus.ts              # 타입 안전 EventBus
├── router/
│   └── messageRouter.ts         # 순수 함수 라우팅
├── sources/
│   ├── slackSource.ts           # Slack → EventBus
│   └── webSocketSource.ts       # WebSocket → EventBus
├── sinks/
│   ├── slackSink.ts             # EventBus → Slack (3초 디바운스)
│   └── webSocketSink.ts         # EventBus → WebSocket (토큰 단위)
└── web/
    └── ws.ts                    # WebSocket 서버 (Express 통합)
```

---

## 7. 구현 순서 (권장)

1. **Phase 1: EventBus + MessageRouter** — 핵심 인프라, 기존 동작 유지하면서 리팩터링
2. **Phase 2: 실시간 스트리밍 (Slack)** — 3초 디바운스 chat.update + thinking/tool 표시
3. **Phase 3: WebSocket 서버** — Express에 WebSocket 통합
4. **Phase 4: 대시보드 실시간 채팅** — WebSocket 클라이언트 UI + 스트리밍 표시
5. **Phase 5: 양방향 미러링** — 대시보드 입력 → Slack 미러링, 세션 동기화

---

## 8. Estelle2에서 차용한 패턴

| Estelle2 패턴 | Clackbot 적용 |
|---------------|---------------|
| Relay (상태 없는 라우터) | MessageRouter (순수 함수) |
| Pylon (상태 관리) | Brain Agent + SessionManager |
| WebSocket 실시간 스트리밍 | WebSocketSink + 대시보드 채팅 |
| Pure Function 아키텍처 | routeMessage() 순수 함수 |
| 멀티디바이스 동기화 | Slack ↔ 대시보드 양방향 미러링 |
