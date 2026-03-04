# Clackbot v4.0.0 Patch Notes

> `main` (v2.x) → `feat/brain-agent-v3` (v4.0.0) 전체 변경 사항

---

## 1. Brain Agent 멀티에이전트 시스템 (v3.0.0)

### Brain Agent
- Brain Agent 모듈 추가 (`src/agent/brain.ts`) — 글로벌 메모리 + 라우팅 담당
- Brain 메모리 파일 시스템 (`.clackbot/brain/`) — memory.md, sessions.md, knowledge.md, tasks.md
- Brain 메모리 MCP 도구 — read/write/search/list/sessions
- Brain-router 스킬 (`.claude/skills/brain-router/SKILL.md`) — Brain이 Sub Agent 생성 결정

### Sub Agent 시스템
- Sub Agent 정의 (`.claude/agents/`) — channel-analyst, weekly-reporter, task-organizer
- `slack_read_thread` 내장 도구 — Sub Agent용 스레드 읽기
- Agent Session & Activity CRUD (`src/store/agentSessions.ts`) — SQLite 영속 세션 관리
- Brain 메모리 스냅샷 저장소 (`src/store/brainMemory.ts`)

### 메시지 라우팅
- MessageRouter (`src/router/messageRouter.ts`) — 순수 함수 라우팅 (사이드 이펙트 없음)
- Handler 리팩토링 — Brain/Sub Agent 분기, 프로젝트 컨텍스트 주입

---

## 2. 대시보드 React 마이그레이션 (v3.0.0 → v4.0.0)

### Vue → React 전환
- Vue 3 SPA 제거, React 19 + TypeScript + Tailwind CSS + shadcn/ui로 완전 교체
- Hash Router 기반 SPA, TanStack React Query (30초 stale, 자동 무효화)
- Dark mode 지원

### 핵심 페이지
| 페이지 | 설명 |
|--------|------|
| 대시보드 (`/`) | 상태 카드, 최근 활동, 최근 대화 |
| 실시간 채팅 (`/chat`) | Slack 양방향 미러링, 토큰 스트리밍, Slack/Web 출처 배지 |
| 에이전트 관제 (`/agents`) | 실시간 스트리밍 모니터, 이벤트 타임라인, 세션 킬 |
| 세션 (`/sessions`, `/projects/:name/sessions`) | 상태 필터, 프로젝트별 필터링, 활동 로그 |
| 대화 이력 (`/conversations`, `/projects/:name/conversations`) | 검색, 페이지네이션, 프로젝트별 필터링 |
| 메모리 (`/projects/:name/memory`) | 파일 트리, 편집기, 실시간 변경 감지 |
| 도구 & 에이전트 (`/tools`) | 내장 도구, MCP 서버, Agents, Skills 목록 |
| 활동 로그 (`/activity`) | 전체 활동 타임라인 (도구, 스킬, 에이전트, 메모리) |
| 설정 (`/settings`) | 성격 프리셋, 세션 설정, 소유자 설정, 연결 정보 |

### shadcn/ui 컴포넌트
Badge, Button, Card, Collapsible, Dialog, Input, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Tabs, Textarea, Tooltip

---

## 3. EventBus 실시간 아키텍처 (v4.0.0)

### 핵심 인프라
- **EventBus** (`src/events/eventBus.ts`) — 타입 안전 중앙 이벤트 허브
- **이벤트 타입**: `message:incoming`, `message:outgoing`, `agent:stream`, `agent:complete`, `session:update`, `activity:new`, `memory:update`

### Source (입력)
- **SlackSource** (`src/sources/slackSource.ts`) — Slack Bolt 이벤트 → EventBus
- **WebSocketSource** (`src/sources/webSocketSource.ts`) — 대시보드 WebSocket → EventBus

### Sink (출력)
- **SlackSink** (`src/sinks/slackSink.ts`) — EventBus → Slack (3초 디바운스 chat.update)
- **WebSocketSink** (`src/sinks/webSocketSink.ts`) — EventBus → WebSocket (토큰 단위)

### WebSocket 서버
- Express HTTP 서버에 WebSocket 서버 통합 (`src/web/ws.ts`)
- 자동 재연결 (3초), ref 기반 핸들러로 안정화
- 모든 EventBus 이벤트 실시간 브로드캐스트

### 메시지 핸들러
- Web 소스 메시지 처리 (`src/events/messageHandler.ts`)
- Brain sessionId 통일로 메시지 중복 제거

---

## 4. 대시보드 Phase 2 기능 강화

### 프로젝트 관리 UI
- 프로젝트 생성 다이얼로그 (디렉토리 브라우저 + CLAUDE.md/Git 배지 + 새 폴더 생성)
- 프로젝트 수정/삭제 (사이드바 hover 시 Pencil/Trash2 아이콘)
- `POST /api/projects/browse/mkdir` — 새 폴더 생성 API

### 프로젝트별 필터링
- Sessions API: `?project=<name>` → `WHERE cwd LIKE ?` 필터
- Conversations API: `?project=<name>` → `WHERE project_id = ?` 필터
- 프론트엔드: URL `:name` 파라미터를 API에 전달

### 전체 세션/대화 접근
- `/sessions`, `/conversations` 글로벌 라우트 추가
- 사이드바에 "전체 세션", "전체 대화" 링크

### 설정 페이지 강화
- **세션 설정**: maxMessages (1-1000), timeoutMinutes (1-1440)
- **소유자 설정**: ownerUserId 입력

---

## 5. 버그 수정

| 버그 | 원인 | 수정 |
|------|------|------|
| React error #31 (앱 크래시) | `activity.detail`이 객체인데 JSX에 직접 렌더링 | `typeof` 체크 + `JSON.stringify` 폴백 |
| 실시간 채팅 메시지 중복 | `brain.ts`와 `handler.ts`의 sessionId 불일치 | `agent:complete` 시 brain 반환 sessionId 사용 |
| 대화 이력 NaN 날짜 | Store가 `lastAt` 반환, 프론트엔드가 `lastMessageAt` 참조 | `lastAt` 폴백 추가 |
| WebSocket 연결 끊김 루프 | `onMessage` 핸들러가 useEffect 의존성에 포함 | ref 패턴으로 변경 + 3초 자동 재연결 |
| 사용자 메시지 미표시 | Chat 페이지가 `message:incoming` 이벤트 미구독 | 이벤트 구독 + Slack/Web 출처 배지 |

---

## 6. 테스트

| 테스트 파일 | 테스트 수 |
|------------|----------|
| `eventBus.test.ts` | 8 |
| `messageRouter.test.ts` | 7 |
| `slackSink.test.ts` | 5 |
| `webSocketSink.test.ts` | 4 |
| `conversations.test.ts` | 3 |
| `agentSessions.test.ts` | 14 |
| `brainMemory.test.ts` | 8 |
| `projectContext.test.ts` | 11 |
| `brain.test.ts` | 13 |
| `brain.integration.test.ts` | 4 (2 skipped) |
| `slackFormat.test.ts` | 28 |
| **합계** | **103 passed, 2 skipped** |

---

## 7. 미커밋 파일 (커밋 필요)

다음 파일들이 아직 staging 안 됨 — v4 실시간 기능의 핵심 조각:

### 에이전트 관제 컴포넌트
- `AgentControlCenter.tsx` — 실시간 에이전트 모니터링 페이지
- `AgentCard.tsx` — 에이전트 세션 카드 (LIVE 배지, 스트리밍 미리보기)
- `AgentStreamViewer.tsx` — 토큰 스트리밍 뷰어
- `AgentEventTimeline.tsx` — 실시간 이벤트 타임라인

### 실시간 인프라
- `AgentStreamContext.tsx` — WebSocket 스트리밍 React Context
- `LiveStreamPanel.tsx` — 세션 상세에서 라이브 스트리밍 표시

### 기타 수정
- `package.json` — v4.0.0 버전
- `src/events/types.ts` — 스트리밍 이벤트 타입 정의
- `src/web/ws.ts` — WebSocket 이벤트 브로드캐스트 확장
- `StatusCards.tsx` — WebSocket 연결 상태 카드
- `MemoryEditor.tsx` / `MemoryTree.tsx` — 실시간 변경 감지
- `SessionDetail.tsx` / `SessionList.tsx` — 라이브 스트리밍 표시
- `Memory.tsx` — 메모리 페이지 강화
- `src/web/api/memory.ts` — 메모리 API 확장

---

## 파일 통계

- **변경 파일**: 124개
- **추가 라인**: ~13,449
- **삭제 라인**: ~2,959
- **순 추가**: ~10,490 라인
