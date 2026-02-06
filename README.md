# Clackbot — 개인 로컬 Slack 비서

Clackbot은 로컬 머신에서 실행되며, **Claude Code Agent SDK**를 사용하여 Slack 메시지에 응답하고 외부 서비스를 연동하는 **개인 Slack 비서**입니다.

## 특징

- **개인 비서** — 각 사용자가 자신의 인스턴스를 로컬에서 실행
- **Socket Mode** — 공개 URL 불필요, 방화벽 안에서도 바로 실행
- **Claude Agent SDK** — Claude Code의 에이전트 기능으로 강력한 AI 응답
- **성격 프리셋** — Professional / Friendly / Detailed / Custom 중 선택
- **MCP 서버 연동** — 대시보드 콘솔에서 자연어로 플러그인 검색/설치
- **웹 대시보드** — 대화 이력, 연동 툴, 설정 관리를 브라우저에서
- **접근 제어** — 소유자 전용(기본) / 공개 모드 선택
- **크로스 플랫폼** — macOS, Linux, Windows 지원

---

## 빠른 시작

### 1. 사전 준비

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Claude Code** — [설치 가이드](https://code.claude.com/docs/ko/setup)

### 2. Clackbot 설치

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/sonan0721/clackbot/main/install.sh | sh

# Windows (PowerShell)
irm https://raw.githubusercontent.com/sonan0721/clackbot/main/install.ps1 | iex
```

### 3. 초기화

```bash
clackbot init
```

인터랙티브하게 Slack 앱 이름과 봇 이름을 입력하면, Slack App Manifest를 자동 생성합니다.
생성된 manifest를 [Slack API](https://api.slack.com/apps) > **Create New App** > **From an app manifest** 에서 붙여넣으세요.

### 4. Slack 토큰 설정

```bash
clackbot login
```

Bot Token (`xoxb-...`)과 App Token (`xapp-...`)을 입력하면 자동 검증 후 저장됩니다.

### 5. 봇 실행

```bash
# 봇 + 웹 대시보드 시작
clackbot start

# 대시보드 없이 봇만 시작
clackbot start --no-web

# 포트 지정
clackbot start --port 4000
```

실행 후:
- Slack에서 `@봇이름 안녕` 메시지를 보내면 응답이 옵니다
- `http://localhost:3847` 에서 대시보드를 확인할 수 있습니다

### 업데이트

`clackbot start` 시 자동으로 업데이트를 확인합니다. 수동 업데이트는 설치 스크립트를 다시 실행하면 됩니다.

### 삭제

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/sonan0721/clackbot/main/uninstall.sh | sh

# Windows (PowerShell)
irm https://raw.githubusercontent.com/sonan0721/clackbot/main/uninstall.ps1 | iex
```

---

## CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `clackbot init` | 프로젝트 초기화 (Slack manifest 생성 포함) |
| `clackbot login` | Slack 토큰 입력 / 검증 / config 저장 |
| `clackbot start` | Slack 봇 + 웹 대시보드 시작 |
| `clackbot start --no-web` | 대시보드 없이 봇만 시작 |
| `clackbot start --port <N>` | 대시보드 포트 지정 (기본: 3847) |
| `clackbot doctor` | 환경/설정 진단 |
| `clackbot config set <key> <value>` | 설정 변경 |
| `clackbot tool list` | 등록된 플러그인 목록 |
| `clackbot tool validate` | 플러그인 JSON 검증 |

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
세션 관리 (스레드별 세션, 자동 리셋)
        │
        ▼
스레드 컨텍스트 조회 (Slack conversations.replies)
        │
        ▼
Claude Code Agent SDK query()
  - 시스템 프롬프트: CLAUDE.md + rules.md + 성격 프리셋
  - MCP 도구: 내장(slack_post, memory) + MCP 서버 + 플러그인
  - 안전 정책: canUseTool (Read/Grep 허용, Write/Bash 차단)
  - 세션 유지: resume 파라미터
        │
        ▼
응답을 Slack에 전송 + SQLite에 대화 기록 저장
```

---

## 접근 모드

| 모드 | 동작 |
|------|------|
| `owner` (기본) | 소유자만 사용 가능. 다른 사용자에게 안내 메시지 표시 |
| `public` | 누구나 `@봇이름` 멘션으로 사용 가능. 채널에 직접 응답 |

```bash
clackbot config set accessMode public
```

---

## 성격 프리셋

대시보드 설정 또는 config에서 봇의 응답 스타일을 선택할 수 있습니다.

| 프리셋 | 설명 |
|--------|------|
| `professional` (기본) | 간결하고 명확. 3~5줄. 불릿 포인트. |
| `friendly` | 친근한 동료 톤. 이모지 적절히 사용. |
| `detailed` | 꼼꼼하고 상세. 배경 설명 포함. 단계별 안내. |
| `custom` | 사용자가 직접 작성한 프롬프트 사용 |

---

## MCP 서버 연동

대시보드의 **연동 툴** 페이지에서 자연어로 MCP 서버를 검색/설치할 수 있습니다.

```
> trello 연동해줘

▸ npm에서 MCP 서버 검색 중...
✓ @trello/mcp-server 발견
설치하시겠습니까?

> yes

▸ 설치 중...
✓ 설치 완료. config.json에 저장됨.
```

설치된 MCP 서버는 `config.json`의 `mcpServers`에 저장되며, 봇 재시작 시 자동 로드됩니다.

### JSON 플러그인 (레거시)

`.clackbot/tools/` 디렉토리에 JSON 파일을 추가하는 방식도 지원합니다.

```bash
clackbot tool list      # 등록된 플러그인 목록
clackbot tool validate  # 플러그인 JSON 검증
```

`examples/tools/` 디렉토리에 Trello, GitHub, Jira 예제가 포함되어 있습니다.

---

## 웹 대시보드

`clackbot start` 실행 시 `http://localhost:3847`에서 접근 가능합니다.

| 페이지 | 내용 |
|--------|------|
| 홈 | 봇 상태, 워크스페이스, 최근 대화 요약 |
| 대화 이력 | 세션(스레드)별 대화 목록, 클릭 시 상세 보기, 검색 |
| 연동 툴 | 내장 도구 + MCP 서버 목록, 인터랙티브 설치 콘솔 |
| 설정 | 접근 모드, 성격 프리셋, 세션 설정, 소유자 지정 |

---

## 세션 관리

- 스레드별로 세션이 유지됩니다 (Agent SDK의 `resume` 파라미터)
- 자동 리셋 조건:
  - 메시지 20개 초과
  - 30분 경과
- 대시보드 설정에서 조정 가능

---

## 안전 정책

| 허용 | 차단 |
|------|------|
| Read, Grep, Glob | Write, Edit |
| WebSearch, WebFetch | Bash, NotebookEdit |
| 모든 MCP 도구 (mcp__*) | 알 수 없는 도구 |

---

## 디렉토리 구조

```
clackbot/
├── bin/clackbot.ts              # CLI 엔트리포인트
├── src/
│   ├── cli/                     # CLI 명령어 (init, login, start, doctor)
│   ├── slack/                   # Slack Bolt App
│   │   ├── app.ts               # Socket Mode 앱 팩토리
│   │   ├── listeners/           # 이벤트 핸들러 (appMention, directMessage)
│   │   └── middleware/          # 접근 제어 (owner/public)
│   ├── agent/                   # Claude Agent SDK 연동
│   │   ├── claude.ts            # query() 래퍼
│   │   ├── systemPrompt.ts      # 규칙 + 성격 프리셋 → 시스템 프롬프트
│   │   ├── permissions.ts       # canUseTool 안전 정책
│   │   ├── installer.ts         # 플러그인 설치 에이전트
│   │   └── tools/               # MCP 도구 로더 (내장 + MCP 서버 + 플러그인)
│   ├── web/                     # 웹 대시보드 (Express + SPA)
│   │   ├── server.ts
│   │   ├── api/                 # REST API + SSE
│   │   └── public/              # 프론트엔드
│   ├── store/conversations.ts   # SQLite 대화 이력
│   ├── session/manager.ts       # 세션 생명주기
│   └── config/                  # Zod 스키마, 경로, 설정 로더
├── scripts/                     # 빌드 스크립트 (크로스 플랫폼)
├── templates/                   # init 복사 템플릿
└── examples/tools/              # 플러그인 JSON 예제
```

---

## 개발

```bash
npm install
npm run build
npm run dev -- start
```

---

## 라이선스

MIT
