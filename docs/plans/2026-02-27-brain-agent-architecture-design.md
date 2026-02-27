# Clackbot v3: Brain Agent Architecture Design

> 2026-02-27 | 승인됨

## 1. 개요

Clackbot을 단일 에이전트에서 **Brain + Sub Agent 멀티 에이전트 아키텍처**로 전환한다. Claude Code Agent SDK의 `query()`, Skills, Agents 시스템을 활용하여 진짜 "개인 비서"로 진화시킨다.

### 핵심 변경

| 현재 (v2) | 목표 (v3) |
|-----------|-----------|
| 단일 Agent, 스레드별 세션 | Brain Agent + Sub Agents |
| 메모리: 단일 memory.md | 구조화된 메모리 (memory, sessions, knowledge, channels) |
| 하드코딩된 라우팅 | Skill 기반 라우팅 (brain-router) |
| 기본 대시보드 | 활동 타임라인 + 세션 관리 + 메모리 뷰어 |
| 대화 기록만 저장 | 활동 로그, 메모리 스냅샷까지 추적 |

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    Slack (Socket Mode)               │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              Message Router (Bolt App)                │
│  - 스레드에 활성 Sub Agent 있으면 → Sub Agent resume │
│  - 새 메시지/DM → Brain Agent                        │
└──────────┬───────────────────────┬───────────────────┘
           │                       │
           ▼                       ▼
┌─────────────────────┐  ┌─────────────────────────────┐
│   🧠 Brain Agent    │  │   ⚙️ Sub Agent (per thread) │
│                     │  │                             │
│  query() 매번 호출  │  │  query() + resume           │
│  Skills로 행동 규칙 │  │  .claude/agents/*.md 정의   │
│  글로벌 메모리 관리 │  │  Task 도구로 호출됨         │
│  Task로 Sub 생성    │  │  독립 컨텍스트              │
└─────────────────────┘  └─────────────────────────────┘
           │                       │
           ▼                       ▼
┌──────────────────────────────────────────────────────┐
│              Persistent Storage                       │
│  📁 .clackbot/brain/ (md 파일)                       │
│  🗃️ SQLite (세션, 활동, 메모리 스냅샷)               │
└──────────────────────────────────────────────────────┘
```

---

## 3. Brain Agent 상세

### System Prompt 구성

| 순서 | 소스 | 내용 |
|------|------|------|
| 1 | `customSystemPrompt` | 코어 메모리 (`brain/memory.md`) + 활성 세션 요약 (`brain/sessions.md`) |
| 2 | Skills (자동 디스커버리) | `brain-router`, `memory-manager` 등 |
| 3 | CLAUDE.md | 프로젝트 규칙 |

### query() 호출

```typescript
query({
  prompt: slackMessage,
  options: {
    cwd: clackbotDir,
    settingSources: ["user", "project"],  // skill + agent 디스커버리
    allowedTools: ["Skill", "Task", "Read", "Write", "Bash", ...],
    agents: loadedAgents,                 // .claude/agents/ 에서 로드 (또는 자동 디스커버리)
    mcpServers: { slack: ..., arbor: ..., ... },
    customSystemPrompt: buildBrainPrompt(coreMemory, activeSessions),
  }
})
```

### Brain 도구

| 도구 | 용도 |
|------|------|
| `Task` (내장) | Sub Agent 생성 (`subagent_type`으로 에이전트 지정) |
| `Skill` (내장) | Skill 발동 (brain-router 등) |
| `memory_read/write` (MCP) | brain/ 디렉토리 md 파일 읽기/쓰기 |
| `memory_search` (MCP) | 전체 메모리 검색 |
| `list_sessions` (MCP) | 활성 Sub Agent 세션 조회 |
| `kill_session` (MCP) | Sub Agent 세션 종료 |
| `slack_read_channel` (MCP) | 채널 히스토리 읽기 (간단한 조회) |
| `slack_post` / `slack_send_dm` (MCP) | 직접 응답 |

---

## 4. Sub Agent 상세

### 정의: `.claude/agents/*.md`

```markdown
---
name: channel-analyst
description: Use when analyzing Slack channel history, summarizing conversations, or extracting user activities
tools: Read, Grep, mcp__slack__read_channel, mcp__slack__read_thread, mcp__slack__post
model: sonnet
---

You are a Slack channel analysis specialist.
Given a task and target channels, you:
1. Read channel history using slack_read_channel
2. Filter and analyze relevant messages
3. Summarize findings in clear Korean
4. Post results to the requesting thread
```

### Sub Agent 세션 관리

- 스레드(thread_ts) 귀속
- `resume` 파라미터로 대화 이어감
- 자동 리셋: 50메시지 / 30분
- 완료/실패 시 Brain 메모리에 결과 기록

### Sub Agent가 Brain에 보고

Sub Agent 완료 시 결과가 Brain의 `Task` 도구 응답으로 반환됨.
Brain이 이를 받아서:
1. Slack 스레드에 게시
2. `brain/tasks.md`에 결과 기록
3. `agent_sessions` DB 업데이트

---

## 5. Skill 정의

### `.claude/skills/brain-router/SKILL.md`

```yaml
---
name: brain-router
description: "Use when receiving any Slack message - decides whether to answer directly or spawn a sub-agent for complex tasks"
---
```

메시지를 받으면:
1. 메모리 확인 (memory_read)
2. 단순 질문/인사 → 직접 답변
3. 채널 분석, 보고서, 복합 작업 → 적절한 agent를 Task로 호출
4. 결과를 메모리에 기록

### `.claude/skills/memory-manager/SKILL.md`

```yaml
---
name: memory-manager
description: "Use when needing to update, organize, or query Brain's persistent memory files"
---
```

메모리 업데이트 규칙:
- 안정적 사실만 저장 (추측 X)
- 기존 정보와 충돌 시 질문
- 파일별 200줄 이내 유지
- 중요도 낮은 정보는 knowledge.md로 이동

---

## 6. 메모리 구조

### 항상 로드 (시스템 프롬프트 주입, 각 ~200줄 이내)

| 파일 | 내용 |
|------|------|
| `brain/memory.md` | 사용자 프로필, 선호, 핵심 패턴 |
| `brain/sessions.md` | 활성 Sub Agent 세션 요약 (3-5줄씩) |

### 도구로 on-demand 조회

| 파일 | 내용 |
|------|------|
| `brain/knowledge.md` | 학습된 지식 (채널 맥락, 업무 패턴) |
| `brain/tasks.md` | 작업 히스토리 (진행중/완료) |
| `brain/channels/{name}.md` | 채널별 맥락, 주요 인물, 토픽 |

---

## 7. 데이터 모델 (SQLite)

### agent_sessions (기존 slack_sessions 확장)

```sql
CREATE TABLE agent_sessions (
  id TEXT PRIMARY KEY,
  thread_ts TEXT,
  agent_type TEXT NOT NULL,        -- 'brain' | 'channel-analyst' | ...
  skill_used TEXT,
  status TEXT DEFAULT 'active',    -- 'active' | 'completed' | 'failed' | 'expired'
  resume_id TEXT,
  task_description TEXT,
  assigned_channels TEXT,          -- JSON array
  cwd TEXT,
  message_count INTEGER DEFAULT 0,
  tools_used TEXT,                 -- JSON array
  created_at INTEGER,
  last_active_at INTEGER,
  completed_at INTEGER,
  result_summary TEXT
);
```

### agent_activities (활동 타임라인)

```sql
CREATE TABLE agent_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES agent_sessions(id),
  agent_type TEXT NOT NULL,
  activity_type TEXT NOT NULL,     -- 'tool_use' | 'skill_invoke' | 'agent_spawn' | 'memory_update'
  tool_name TEXT,
  detail TEXT,                     -- JSON
  channel_id TEXT,
  created_at INTEGER
);
```

### memory_snapshots (메모리 변경 이력)

```sql
CREATE TABLE memory_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  changed_by TEXT,                 -- 'brain' | 'user' | 'sub-agent:channel-analyst'
  created_at INTEGER
);
```

---

## 8. 대시보드

### 페이지 구성

| 페이지 | 내용 |
|--------|------|
| **홈** | Brain 상태, 최근 활동 타임라인, 활성 세션 요약 |
| **세션 관리** | 활성/완료 세션 목록, 작업 상세, 도구 사용 통계, 세션 종료 |
| **Brain 메모리** | md 파일 트리 뷰어, 내용 표시, 변경 이력 (memory_snapshots) |
| **Skills & Agents** | Skill 목록 + Agent 목록 + MCP 서버 상태, 사용 통계 |
| **대화 이력** | 기존 기능 유지 (세션별 메시지 조회, 검색) |
| **설정** | 기존 기능 유지 + Brain 메모리 설정 |

### API 엔드포인트 (신규/변경)

```
GET  /api/sessions                  활성/완료 세션 목록
GET  /api/sessions/:id              세션 상세
POST /api/sessions/:id/kill         세션 종료
GET  /api/activities                활동 타임라인 (페이징)
GET  /api/activities?session=:id    세션별 활동
GET  /api/brain/memory              메모리 파일 트리
GET  /api/brain/memory/:path        메모리 파일 내용
GET  /api/brain/memory/:path/history  메모리 변경 이력
GET  /api/agents                    Agent 정의 목록 + 사용 통계
GET  /api/skills                    Skill 목록
```

---

## 9. 전체 데이터 흐름 예시

```
사용자: "@clackbot #a, #b 분석해서 주간보고 올려줘"

1. Bolt App 수신
2. Message Router → 활성 Sub Agent 없음 → Brain Agent 호출
3. Brain query() 시작
   - customSystemPrompt: memory.md + sessions.md
   - settingSources로 skills/agents 자동 디스커버리
4. Brain이 brain-router skill 발동 (자동)
5. Brain 판단: "채널 분석 + 보고서 → weekly-reporter agent"
6. Brain → Task(subagent_type: "weekly-reporter",
              prompt: "#a, #b 이번 주 활동 분석 후 Arbor 등록...")
7. weekly-reporter (독립 컨텍스트):
   → slack_read_channel(#a, 7일)
   → slack_read_channel(#b, 7일)
   → 분석/정리
   → mcp__arbor__create_report(...)
   → 결과 반환
8. Brain 수신:
   → Slack 스레드에 결과 게시 (slack_post)
   → memory_write: tasks.md에 "주간보고 완료" 기록
   → DB: agent_sessions + agent_activities 저장
```

---

## 10. 기술 스택 변경 요약

| 변경 | 상세 |
|------|------|
| Agent SDK 활용 강화 | `settingSources`, `agents` 옵션, `Task`/`Skill` 도구 활성화 |
| Skills 도입 | `.claude/skills/` 에 brain-router, memory-manager |
| Agents 도입 | `.claude/agents/` 에 channel-analyst, weekly-reporter 등 |
| 메모리 구조화 | `.clackbot/brain/` 디렉토리, 코어 + on-demand 분리 |
| DB 확장 | agent_sessions, agent_activities, memory_snapshots |
| 대시보드 확장 | 타임라인, 세션 관리, 메모리 뷰어 추가 |
| Message Router 리팩토링 | Brain vs Sub Agent 라우팅 로직 |
