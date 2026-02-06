# Clackbot: Claude Code Agent SDK로 만든 개인 Slack AI 비서

> 터미널 3줄이면 내 Slack에 AI 비서가 생깁니다.

## TL;DR

**Clackbot**은 로컬에서 실행되는 개인 Slack AI 비서입니다. Claude Code Agent SDK 기반으로, Slack에서 `@봇이름`을 멘션하면 AI가 응답합니다. MCP 서버를 연동하면 Trello, GitHub, Jira 같은 외부 서비스까지 자연어로 제어할 수 있습니다.

```bash
curl -fsSL https://raw.githubusercontent.com/sonan0721/clackbot/main/install.sh | sh
clackbot init
clackbot login
clackbot start
```

GitHub: https://github.com/sonan0721/clackbot

---

## 왜 만들었나

ChatGPT, Claude 같은 AI를 쓸 때마다 브라우저 탭을 열고, 컨텍스트를 복붙하고, 답변을 다시 Slack에 옮기는 과정이 번거로웠습니다. "그냥 Slack에서 바로 물어보면 안 되나?"라는 생각에서 시작했습니다.

기존 Slack AI 봇들의 문제:
- **서버가 필요하다** — AWS, Heroku 등에 배포해야 하고, 비용이 든다
- **API 키를 서버에 올려야 한다** — 보안 걱정
- **커스터마이징이 어렵다** — 성격, 도구, 프롬프트를 내 맘대로 못 바꾼다

Clackbot의 접근:
- **100% 로컬 실행** — 내 컴퓨터에서 돌아간다. 서버 비용 없음
- **Socket Mode** — 공개 URL 불필요. 방화벽 안에서도 작동
- **Claude Code Agent SDK** — 단순 API 호출이 아닌, 에이전트 기능 (도구 사용, 세션 유지, 멀티턴)

---

## 핵심 기능

### 1. Slack 네이티브 AI 비서

Slack에서 `@봇이름 내일 회의 아젠다 정리해줘` 하면 바로 답변이 옵니다. DM도 됩니다. 스레드에서 대화를 이어가면 컨텍스트를 기억합니다.

- owner 모드: 나만 쓸 수 있음 (기본)
- public 모드: 팀원 누구나 채널에서 사용 가능

### 2. MCP 서버로 외부 서비스 연동

대시보드에서 "trello 연동해줘"라고 입력하면, AI가 알아서 MCP 서버를 찾아 설치합니다. 설치 후에는:

```
@봇이름 Trello 보드에서 이번 주 할 일 정리해줘
@봇이름 GitHub 이슈 #42 코멘트 달아줘
```

이런 식으로 Slack 안에서 외부 서비스를 자연어로 제어할 수 있습니다.

### 3. 성격 커스터마이징

봇의 성격을 4가지 프리셋에서 고를 수 있습니다:

| 프리셋 | 느낌 |
|--------|------|
| Professional | "요약하면 3가지입니다: ..." |
| Friendly | "좋은 질문이에요! 같이 살펴볼까요?" |
| Detailed | "이 기능의 배경을 먼저 설명드리면..." |
| Custom | 내가 직접 프롬프트 작성 |

### 4. 웹 대시보드

`http://localhost:3847`에서 봇 상태, 대화 이력, 연동 툴, 설정을 관리합니다.

- 대화 이력을 스레드별로 그룹핑하여 보기
- MCP 서버를 인터랙티브 콘솔에서 검색/설치
- 접근 모드, 성격, 세션 설정을 브라우저에서 변경

---

## 아키텍처

```
┌─────────────┐     ┌─────────────────────────┐
│   Slack      │     │  로컬 머신               │
│              │ WSS │                         │
│  @봇 메시지  ├─────►  Bolt App (Socket Mode) │
│              │     │       │                 │
│  ◄───────────┤     │       ▼                 │
│   AI 응답    │     │  Claude Code Agent SDK  │
│              │     │   + MCP 서버들           │
└─────────────┘     │       │                 │
                    │       ▼                 │
                    │  SQLite (대화 이력)      │
                    │  Express (대시보드)      │
                    └─────────────────────────┘
```

핵심 설계 결정:
- **Socket Mode**: Slack이 봇에 WebSocket으로 연결. 공개 엔드포인트 불필요
- **Agent SDK**: `query()` 한 번 호출로 멀티턴 에이전트 동작 (도구 호출, 세션 resume)
- **MCP 프로토콜**: 표준화된 도구 인터페이스로 어떤 서비스든 플러그인 가능

---

## 설치 — 5분

### 사전 준비

- Node.js 18+
- [Claude Code](https://code.claude.com/docs/ko/setup) 설치 및 로그인

### 설치 및 실행

```bash
# 1. 설치 (macOS/Linux)
curl -fsSL https://raw.githubusercontent.com/sonan0721/clackbot/main/install.sh | sh

# Windows
irm https://raw.githubusercontent.com/sonan0721/clackbot/main/install.ps1 | iex

# 2. 초기화 — Slack 앱 manifest 자동 생성
clackbot init

# 3. Slack 토큰 입력 — 자동 검증
clackbot login

# 4. 실행
clackbot start
```

`clackbot init`이 Slack App Manifest를 생성해주므로, [Slack API](https://api.slack.com/apps)에서 "From an app manifest"로 앱을 만들면 됩니다. 권한 설정을 수동으로 할 필요 없습니다.

---

## 기술 스택

| 구성 요소 | 기술 | 선택 이유 |
|-----------|------|-----------|
| AI | Claude Code Agent SDK | 에이전트 기능 (도구, 세션, MCP) 내장 |
| Slack | @slack/bolt + Socket Mode | 서버 배포 없이 로컬 실행 |
| 웹 | Express + Vanilla JS | 프레임워크 의존성 최소화 |
| DB | better-sqlite3 | 설치 간편, 서버 불필요 |
| 설정 | Zod | 런타임 타입 검증 |

---

## 로드맵

- [ ] 이미지/파일 첨부 처리
- [ ] 슬래시 커맨드 지원
- [ ] 정기 리포트 (cron)
- [ ] 멀티 워크스페이스

---

## 마무리

Clackbot은 "AI를 쓰기 위해 브라우저를 열어야 한다"는 마찰을 없앱니다. 이미 하루 종일 Slack을 쓰고 있으니, 거기서 바로 AI에게 물어보는 게 자연스럽습니다.

로컬 실행이라 서버 비용도 없고, Socket Mode라 보안도 안심입니다. MCP 서버를 붙이면 Slack이 곧 업무 허브가 됩니다.

한번 써보세요:
```bash
curl -fsSL https://raw.githubusercontent.com/sonan0721/clackbot/main/install.sh | sh
```

GitHub: https://github.com/sonan0721/clackbot

피드백, 이슈, PR 환영합니다.
