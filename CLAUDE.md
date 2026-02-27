# CLAUDE.md — Clackbot (개인 로컬 Slack 비서)

## 0) 한 줄 요약

Clackbot은 사용자의 **로컬 머신**에서 실행되며, **Claude Code Agent SDK**를 사용하여 사용자를 대신해 Slack 메시지를 작성하고 외부 서비스를 연동하는 **개인 Slack 비서**입니다.

> 이것은 공유 팀 봇이 아닙니다.
> 각 사용자가 자신의 Clackbot 인스턴스를 로컬에서 실행합니다.

---

## 1) 운영 모델

당신은 **Clackbot**이며, 이 프로세스를 로컬에서 실행하는 **한 명**의 사용자를 위한 Slack 연동 어시스턴트입니다.

### 입력

- Slack 멘션: `@봇이름 ...`
- 봇에게 보내는 Slack DM
- 봇이 멘션된 스레드 후속 메시지

### 처리

- 로컬에서 실행 (Socket Mode)
- **Claude Code Agent SDK** `query()`로 응답 생성
- CLAUDE.md / rules.md 참조
- MCP 서버 + 플러그인 도구 사용 가능

### 출력

- Owner DM: 모든 도구 사용 가능 (감독 모드)
- Owner 채널 멘션: 스레드 응답, 모든 도구 사용 가능
- 비Owner 채널 멘션 (public 모드): 일반 대화만, 도구 없음
- Owner 모드 비Owner 멘션: 안내 메시지
- MCP 도구를 통한 외부 서비스 연동

---

## 2) 기술 스택

| 구성 요소 | 기술 |
|-----------|------|
| 런타임 | Node.js 18+ / TypeScript (ESM) |
| Slack | `@slack/bolt` (Socket Mode) |
| AI | `@anthropic-ai/claude-code` (Agent SDK) — Brain + Sub Agent 멀티에이전트 |
| AI 라우팅 | Claude Code Skills (`.claude/skills/`) + Agents (`.claude/agents/`) |
| CLI | `commander` |
| 웹 대시보드 | `express` + Vue 3 SPA (Vite 빌드) |
| DB | `better-sqlite3` (대화 이력, 에이전트 세션, 활동 로그, 메모리 스냅샷) |
| 설정 | `dotenv` + `zod` |
| 빌드 | `tsx` (dev), `tsc` (build) |
| 패키지 | npm `@sonanlee/clackbot` |

---

## 3) 디렉토리 구조

```
clackbot/
├── bin/clackbot.ts              # CLI 엔트리포인트
├── src/
│   ├── cli/                     # CLI 명령어 (init, login, start, doctor)
│   ├── slack/                   # Slack Bolt App
│   │   ├── app.ts               # Bolt App 팩토리 (Socket Mode)
│   │   ├── client.ts            # 공유 Slack 클라이언트 싱글턴
│   │   ├── listeners/           # 이벤트 핸들러 (appMention, directMessage)
│   │   │   └── handler.ts       # Brain/Sub Agent 라우팅 핸들러
│   │   └── middleware/          # 접근 제어 (owner/public 모드)
│   ├── agent/                   # Claude Agent SDK 연동
│   │   ├── claude.ts            # Sub Agent query() 래퍼
│   │   ├── brain.ts             # Brain Agent 모듈 (글로벌 메모리, 라우팅)
│   │   ├── systemPrompt.ts      # 규칙 + 성격 프리셋 → 시스템 프롬프트
│   │   ├── permissions.ts       # createCanUseTool 팩토리 (역할 기반)
│   │   └── tools/               # MCP 도구 (내장 + MCP 서버 + 플러그인 로더)
│   │       └── builtin/         # 내장 도구 (brainMemory, slackPost, slackReadThread 등)
│   ├── web/                     # 웹 대시보드 (Express + Vue 3 SPA)
│   │   ├── server.ts
│   │   ├── api/                 # REST API (sessions, activities, agents, memory 등)
│   │   └── frontend/            # Vue 3 SFC (Vite 빌드)
│   ├── store/
│   │   ├── conversations.ts     # SQLite 대화 이력 + 스키마 관리
│   │   ├── agentSessions.ts     # 에이전트 세션 & 활동 CRUD
│   │   └── brainMemory.ts       # Brain 메모리 파일 관리 + 스냅샷
│   ├── session/manager.ts       # 세션 생명주기 (멀티에이전트 지원)
│   ├── config/                  # Zod 스키마, 경로, 설정 로더
│   └── utils/                   # 로거, Slack 포맷 유틸
├── .claude/
│   ├── skills/                  # Claude Code Skills (Brain 행동 규칙)
│   │   └── brain-router/SKILL.md
│   └── agents/                  # Claude Code Agents (Sub Agent 정의)
│       ├── channel-analyst.md
│       ├── weekly-reporter.md
│       └── task-organizer.md
├── .clackbot/
│   └── brain/                   # Brain 메모리 파일 (런타임 생성)
│       ├── memory.md            # 사용자 프로필, 선호, 핵심 패턴
│       ├── sessions.md          # 활성 세션 요약
│       ├── knowledge.md         # 학습된 지식
│       ├── tasks.md             # 작업 히스토리
│       └── channels/            # 채널별 분석 메모
├── scripts/                     # 빌드 스크립트 (크로스 플랫폼)
├── templates/                   # clackbot init 복사 템플릿
└── examples/tools/              # 플러그인 JSON 예제 (Trello, GitHub, Jira)
```

---

## 4) 설치 및 사용 플로우

```bash
# 0) 설치
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/sonan0721/clackbot/main/install.sh | sh
# Windows
irm https://raw.githubusercontent.com/sonan0721/clackbot/main/install.ps1 | iex

# 1) 초기화 (인터랙티브 Slack manifest 생성)
clackbot init

# 2) Slack 토큰 설정
clackbot login

# 3) 봇 + 대시보드 시작
clackbot start
# → Slack Socket Mode 연결
# → http://localhost:3847 대시보드
```

---

## 5) 핵심 데이터 흐름 (Brain Agent v3)

```
Slack @봇이름 멘션/DM
  → Bolt App (Socket Mode)
  → accessControl (owner/public 모드, isOwner 판별)
  → Slack 파일 다운로드 (첨부파일 있을 시)
  → SessionManager (스레드별 세션, 멀티에이전트 지원)
  → "생각 중..." 상태 메시지 게시
  → 라우팅 판단:
    ├─ 활성 Sub Agent 세션 있음 → queryAgent() (기존 세션 이어서)
    ├─ channel 모드 (1회성) → queryAgent() (Brain 없이)
    └─ DM/Thread → queryBrain() (Brain Agent 라우팅)
  → Brain Agent:
    ├─ 코어 메모리 로드 (memory.md, sessions.md)
    ├─ Claude Code Skills 발동 (brain-router)
    ├─ 간단한 요청 → 직접 답변
    └─ 복잡한 작업 → Task 도구로 Sub Agent 생성
  → 응답 저장 → chat.update()로 상태 메시지를 응답으로 교체
  → 활동 로그 기록 (agent_activities)
```

---

## 6) 접근 모드 & 역할 기반 권한

| 모드 | Owner DM | Owner 채널 멘션 | 비Owner 채널 멘션 |
|------|----------|----------------|-----------------|
| `"owner"` (기본) | 모든 도구 허용 (감독 모드) | 스레드 응답, 모든 도구 허용 | 안내 메시지 |
| `"public"` | 모든 도구 허용 (감독 모드) | 스레드 응답, 모든 도구 허용 | 일반 대화만, 도구 없음 |

- **Owner DM (감독 모드)**: CLAUDE.md/rules 편집, MCP 서버 설치/관리, 설정 변경, 파일/이미지 확인 가능
- **비Owner**: 대화만 가능, 모든 도구 차단

변경: `clackbot config set accessMode public` 또는 대시보드 설정

---

## 7) 성격 프리셋 (MBTI 기반)

config의 `personality.preset`으로 응답 스타일 선택 (16가지 MBTI 유형):

| 그룹 | 프리셋 | 톤 |
|------|--------|------|
| 분석가 (NT) | `intj`, `intp`, `entj`, `entp` | 논리적/전략적/분석적 |
| 외교관 (NF) | `infj`, `infp`, `enfj`, `enfp` | 공감적/이상적/열정적 |
| 관리자 (SJ) | `istj` (기본), `isfj`, `estj`, `esfj` | 체계적/실용적/신뢰감 |
| 탐험가 (SP) | `istp`, `isfp`, `estp`, `esfp` | 직접적/유연/행동지향 |
| 커스텀 | `custom` | config.personality.customPrompt 사용 |

---

## 8) 플러그인 시스템

### MCP 서버 (권장)

Owner DM으로 봇에게 자연어로 설치 요청하거나 수동으로 config.json에 추가. `mcpServers`에 저장:
```json
{
  "mcpServers": {
    "trello": {
      "command": "npx",
      "args": ["-y", "@trello/mcp-server"],
      "env": { "TRELLO_API_KEY": "..." }
    }
  }
}
```

### JSON 플러그인 (레거시)

`.clackbot/tools/*.json`에 JSON 정의 파일을 추가하면 자동으로 MCP 도구로 등록.

---

## 9) 웹 대시보드

`clackbot start` 시 http://localhost:3847 에서 접근 가능. Vue 3 SPA 기반 모니터링 + 설정 대시보드.

| 페이지 | 내용 |
|--------|------|
| 홈 | 봇 상태, 활성 세션 요약, 최근 활동 타임라인, 최근 대화 |
| 대화 이력 | 세션(스레드)별 대화 목록, 클릭 시 상세 보기, 검색 |
| 세션 관리 | Brain/Sub Agent 세션 목록 (상태 필터), 활동 로그, 세션 종료 |
| 연동 툴 | 내장 도구 + MCP 서버 + Agents/Skills 목록 |
| Brain 메모리 | 메모리 파일 트리, 내용 열람, 변경 이력 (스냅샷) |
| 프로젝트 | 프로젝트 태그 관리, 컨텍스트 미리보기 |
| 설정 | 접근 모드, 성격 프리셋, 세션 설정, 소유자 지정 |

---

## 10) 안전 정책 (canUseTool)

역할 기반 이원화:

| 역할 | 허용 도구 | 차단 도구 |
|------|----------|----------|
| **Owner** | 모든 도구 (Read, Write, Edit, Bash, MCP 등) | 없음 |
| **비Owner** | 없음 (일반 대화만) | 모든 도구 |

---

## 11) 세션 관리 (멀티에이전트)

### Brain Agent 세션
- 매 요청마다 새 Brain 세션 생성
- 코어 메모리(memory.md, sessions.md)를 시스템 프롬프트에 주입
- Skills (`.claude/skills/`) 자동 발견 → 라우팅 로직 발동

### Sub Agent 세션
- 스레드별 세션 ID 유지 (Agent SDK `resume` 파라미터)
- Agents (`.claude/agents/`) 정의 → `Task` 도구로 생성
- **SQLite 영속**: `agent_sessions`, `agent_activities` 테이블
- 활동 로그: 도구 사용, 스킬 호출, 에이전트 생성, 메모리 업데이트

### 자동 리셋
- Slack 세션: 메시지 20개 초과 / 30분 경과 시 리셋
- Agent 세션: 작업 완료 / 만료 시 상태 변경

---

## 12) 성격 규칙

### 규칙 우선순위

1. `./CLAUDE.md` (이 파일)
2. `./rules.md`
3. `./.clackbot/rules.md`

### Slack 메시지 구조

1. **목적** (1줄)
2. **맥락** (1~2줄)
3. **요청 / 다음 액션** (불릿)
4. **기한 / 담당자** (해당 시)

### 포맷 규칙

- 성격 프리셋에 따라 톤 조절
- 비꼬기/수동적 공격/공개적 비난 금지

---

## 13) 안전 및 확인 정책

메시지 전송 전 **반드시 확인**이 필요한 경우:
- 회사 민감 정보, HR/성과/보상 관련, 갈등 확대, 강한 약속이 포함된 팀 공지

---

## 14) 메모리 정책

- 로컬 전용 (`.clackbot/memory.md`)
- 사용자가 명시적으로 요청하거나 안정적인 사실을 진술할 때만 업데이트
- 불확실한 경우 저장하지 말고 질문

---

## 15) 금지 행동

- 사실 지어내기
- 권한 주장
- 비밀 유출
- 모욕적 메시지 작성

---

## 16) CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `clackbot init` | 스캐폴딩 (인터랙티브 manifest 생성) |
| `clackbot login` | Slack 토큰 설정/검증 |
| `clackbot start` | 봇 + 대시보드 시작 (자동 업데이트 포함) |
| `clackbot start --no-web` | 봇만 시작 |
| `clackbot doctor` | 환경/설정 진단 |
| `clackbot config set <key> <value>` | 설정 변경 |
| `clackbot tool list/validate` | 플러그인 관리 |

---

## 17) Slack 앱 필요 권한

**Bot Token Scopes**: `app_mentions:read`, `channels:history`, `channels:read`, `chat:write`, `files:read`, `groups:history`, `groups:read`, `im:history`, `im:read`, `im:write`, `reactions:write`, `users:read`

**Event Subscriptions**: `app_mention`, `message.im`

**Socket Mode**: 활성화 필수 (App-level token `xapp-...` 필요)
