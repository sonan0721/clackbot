# Clackbot — 개인 로컬 Slack 비서

Clackbot은 로컬 머신에서 실행되며, Claude Code Agent SDK를 사용하여 Slack 메시지에 응답하고 외부 서비스를 연동하는 **개인 Slack 비서**입니다.

## 특징

- **개인 비서** — 각 사용자가 자신의 인스턴스를 로컬에서 실행
- **Socket Mode** — 공개 URL 불필요, 로컬에서 바로 실행
- **Claude Agent SDK** — 강력한 AI 기반 응답 생성
- **플러그인 시스템** — JSON 파일 하나로 Trello, GitHub, Jira 등 외부 서비스 연동
- **웹 대시보드** — 대화 이력, 연동 툴 현황, 설정 관리
- **멀티 프로젝트** — 채널별 프로젝트 매핑, 프로젝트별 규칙 적용
- **접근 제어** — 소유자 전용(기본) / 공개 모드 선택

---

## 빠른 시작

### 1. Slack 앱 생성

1. [Slack API](https://api.slack.com/apps)에서 **Create New App** > **From scratch**
2. **Socket Mode** 활성화 (Settings > Socket Mode > Enable Socket Mode)
3. App-Level Token 생성 (`connections:write` 스코프)
4. **OAuth & Permissions**에서 Bot Token Scopes 추가:
   - `app_mentions:read`, `channels:history`, `channels:read`, `chat:write`
   - `groups:history`, `groups:read`, `im:history`, `im:read`, `im:write`
   - `reactions:write`, `users:read`
5. **Event Subscriptions** 활성화 후 이벤트 추가:
   - `app_mention`, `message.im`
6. 워크스페이스에 앱 설치 → Bot Token (`xoxb-...`) 확인

### 2. Clackbot 설치 및 설정

```bash
# 프로젝트 디렉토리에서 초기화
npx @sonanlee/clackbot init

# Slack 토큰 설정 (대화형)
npx @sonanlee/clackbot login

# 또는 .env 파일 직접 편집
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_APP_TOKEN=xapp-...
# ANTHROPIC_API_KEY=sk-ant-...
```

### 3. 봇 실행

```bash
# 봇 + 웹 대시보드 시작
npx @sonanlee/clackbot start

# 대시보드 없이 봇만 시작
npx @sonanlee/clackbot start --no-web

# 포트 지정
npx @sonanlee/clackbot start --port 4000
```

실행 후:
- Slack에서 `@봇이름 안녕` 메시지를 보내면 응답이 옵니다
- `http://localhost:3847` 에서 대시보드를 확인할 수 있습니다

---

## CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `clackbot init` | 프로젝트 초기화 (.clackbot/ 폴더, .env.example 생성) |
| `clackbot login` | Slack 토큰 입력 → 검증 → config 저장 |
| `clackbot start` | Slack 봇 + 웹 대시보드 동시 시작 |
| `clackbot start --no-web` | 대시보드 없이 봇만 시작 |
| `clackbot start --port <N>` | 대시보드 포트 지정 (기본: 3847) |
| `clackbot doctor` | 환경/설정 진단 |
| `clackbot config set <key> <value>` | 설정 변경 |
| `clackbot project add <id> <dir>` | 프로젝트 등록 |
| `clackbot project list` | 프로젝트 목록 |
| `clackbot project map <id> <channelId>` | 프로젝트에 Slack 채널 매핑 |
| `clackbot tool list` | 등록된 플러그인 목록 |
| `clackbot tool validate` | 플러그인 JSON 검증 |

---

## 디렉토리 구조

### 패키지 구조

```
clackbot/
├── bin/clackbot.ts              # CLI 엔트리포인트
├── src/
│   ├── cli/                     # CLI 명령어
│   │   ├── index.ts             # commander 프로그램 정의
│   │   ├── init.ts              # clackbot init
│   │   ├── login.ts             # clackbot login
│   │   ├── start.ts             # clackbot start
│   │   └── doctor.ts            # clackbot doctor
│   ├── slack/                   # Slack Bolt App
│   │   ├── app.ts               # Socket Mode 앱 팩토리
│   │   ├── listeners/
│   │   │   ├── appMention.ts    # @봇이름 멘션 처리
│   │   │   ├── directMessage.ts # DM 처리
│   │   │   └── handler.ts       # 공통 메시지 핸들러
│   │   └── middleware/
│   │       └── accessControl.ts # 접근 모드 (owner/public)
│   ├── agent/                   # Claude Agent SDK 연동
│   │   ├── claude.ts            # query() 래퍼
│   │   ├── systemPrompt.ts      # 규칙 파일 → 시스템 프롬프트
│   │   ├── permissions.ts       # canUseTool 안전 정책
│   │   └── tools/
│   │       ├── loader.ts        # 플러그인 JSON → MCP 도구 변환
│   │       └── builtin/         # 내장 도구 (slack_post, memory)
│   ├── web/                     # 웹 대시보드
│   │   ├── server.ts            # Express 서버
│   │   ├── api/                 # REST API
│   │   └── public/              # SPA 프론트엔드
│   ├── store/conversations.ts   # SQLite 대화 이력
│   ├── projects/                # 멀티 프로젝트 관리
│   ├── session/manager.ts       # 세션 생명주기
│   └── config/                  # 설정 로더 + Zod 스키마
├── templates/                   # init 복사 템플릿
└── examples/tools/              # 플러그인 예제
```

### 사용자 로컬 (.clackbot init 후)

```
프로젝트/
├── .clackbot/
│   ├── config.json              # 봇 설정
│   ├── memory.md                # 봇 메모리
│   ├── conversations.db         # 대화 이력 (SQLite)
│   └── tools/                   # 커스텀 플러그인
│       └── trello.json
├── .env                         # Slack/API 토큰
└── CLAUDE.md                    # 프로젝트 규칙 (선택)
```

---

## 작동 원리

```
Slack에서 @봇이름 멘션 또는 DM
        │
        ▼
Bolt App (Socket Mode, WebSocket)
        │
        ▼
접근 제어 (owner/public 모드)
        │
        ▼
프로젝트 매핑 (채널 → 프로젝트 디렉토리)
        │
        ▼
세션 관리 (스레드별 세션, 자동 리셋)
        │
        ▼
스레드 컨텍스트 조회 (Slack conversations.replies)
        │
        ▼
Claude Code Agent SDK query()
  - 시스템 프롬프트: CLAUDE.md + rules.md + memory.md
  - MCP 도구: 내장(slack_post, memory) + 플러그인
  - 안전 정책: canUseTool (Read/Grep 허용, Write/Bash 차단)
  - 세션 유지: resume 파라미터
        │
        ▼
응답을 Slack 스레드에 전송 + SQLite에 대화 기록 저장
```

---

## 접근 모드

| 모드 | 동작 |
|------|------|
| `owner` (기본) | config의 `ownerUserId`만 사용 가능. 다른 사용자에게 안내 메시지 표시 |
| `public` | 누구나 `@봇이름` 멘션으로 사용 가능 |

```bash
# 접근 모드 변경
clackbot config set accessMode public

# 소유자 ID 설정
clackbot config set ownerUserId U0123456789
```

---

## 플러그인 툴

`.clackbot/tools/` 디렉토리에 JSON 파일을 추가하면 자동으로 MCP 도구로 등록됩니다.

### 예제: Trello 연동

`.clackbot/tools/trello.json`:
```json
{
  "name": "trello",
  "description": "Trello 보드/카드 관리",
  "auth": {
    "type": "api_key",
    "envVars": ["TRELLO_API_KEY", "TRELLO_TOKEN"]
  },
  "tools": [
    {
      "name": "trello_create_card",
      "description": "Trello 리스트에 새 카드를 생성합니다",
      "method": "POST",
      "url": "https://api.trello.com/1/cards",
      "params": {
        "idList": { "type": "string", "description": "리스트 ID", "required": true },
        "name": { "type": "string", "description": "카드 제목", "required": true },
        "desc": { "type": "string", "description": "카드 설명" }
      },
      "authParams": {
        "key": "$TRELLO_API_KEY",
        "token": "$TRELLO_TOKEN"
      }
    }
  ]
}
```

`.env`에 인증 정보 추가:
```
TRELLO_API_KEY=your_api_key
TRELLO_TOKEN=your_token
```

이제 Slack에서 `@봇이름 Trello에 카드 만들어줘` 라고 하면 됩니다.

### 플러그인 검증

```bash
clackbot tool validate
# ✓ trello.json: 유효함
```

`examples/tools/` 디렉토리에 Trello, GitHub Issues, Jira 예제가 포함되어 있습니다.

---

## 멀티 프로젝트

여러 프로젝트를 등록하고 Slack 채널에 매핑할 수 있습니다. 매핑된 채널에서 봇을 멘션하면 해당 프로젝트의 CLAUDE.md와 rules.md가 시스템 프롬프트에 포함됩니다.

```bash
# 프로젝트 등록
clackbot project add my-game /Users/me/projects/my-game
clackbot project add backend /Users/me/projects/backend

# 채널 매핑
clackbot project map my-game C04ABC123
clackbot project map backend C04DEF456
```

---

## 웹 대시보드

`clackbot start` 실행 시 `http://localhost:3847`에서 대시보드에 접근할 수 있습니다.

| 페이지 | 내용 |
|--------|------|
| 홈 | 봇 상태, 워크스페이스 정보, 최근 대화 요약 |
| 대화 이력 | 채널별/스레드별 대화 목록, 전문 검색 |
| 연동 툴 | 내장 도구 + 플러그인 목록, 인증 상태 확인 |
| 프로젝트 | 등록된 프로젝트 관리, 채널 매핑 |
| 설정 | 접근 모드, 세션 설정, 봇 정보 조회/수정 |

---

## 세션 관리

- 스레드별로 세션이 유지됩니다 (Claude Agent SDK의 `resume` 파라미터)
- 다음 조건에서 자동 리셋됩니다:
  - 메시지 20개 초과
  - 30분 경과
- 설정에서 조정 가능: `clackbot config set` 또는 대시보드 설정

---

## 안전 정책

Clackbot은 Claude에게 다음 도구만 허용합니다:

| 허용 | 차단 |
|------|------|
| Read, Grep, Glob | Write, Edit |
| WebSearch, WebFetch | Bash, NotebookEdit |
| 모든 MCP 도구 (mcp__*) | 알 수 없는 도구 |

이는 봇이 파일을 수정하거나 명령어를 실행하는 것을 방지합니다.

---

## 진단

```bash
clackbot doctor
```

다음 항목을 확인합니다:
- Node.js 버전 (18+)
- .clackbot/ 디렉토리
- config.json 유효성
- .env 파일
- Slack Bot/App 토큰
- Anthropic API Key
- 봇 이름/ID
- Slack 연결 테스트
- 플러그인 툴 개수

---

## 개발

```bash
# 의존성 설치
npm install

# TypeScript 빌드
npm run build

# 개발 모드 (tsx)
npm run dev -- start
```

---

## 라이선스

MIT
