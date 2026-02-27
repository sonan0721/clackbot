# Clackbot v3: Brain Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clackbot을 단일 에이전트에서 Brain + Sub Agent 멀티 에이전트 아키텍처로 전환한다.

**Architecture:** Brain Agent가 글로벌 메모리(md 파일)를 관리하며 모든 메시지를 수신. 복잡한 작업은 `.claude/agents/`에 정의된 Sub Agent를 `Task` 도구로 생성. Claude Code Skills로 Brain의 라우팅/메모리 관리 행동을 정의.

**Tech Stack:** Node.js 18+ / TypeScript ESM / `@anthropic-ai/claude-code` Agent SDK / `@slack/bolt` / `better-sqlite3` / Vue 3 / Express

**Design doc:** `docs/plans/2026-02-27-brain-agent-architecture-design.md`

---

## Phase 1: Foundation — DB Schema & Brain Memory

### Task 1: Extend SQLite schema with new tables

**Files:**
- Modify: `src/store/conversations.ts:11-77` (initDatabase function)
- Test: `src/store/conversations.test.ts` (create new)

**Step 1: Write failing test for new tables**

```typescript
// src/store/conversations.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabase } from './conversations.js';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('initDatabase', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'clackbot-test-'));
  });

  it('creates agent_sessions table', () => {
    const db = initDatabase(cwd);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_sessions'").all();
    expect(tables).toHaveLength(1);
  });

  it('creates agent_activities table', () => {
    const db = initDatabase(cwd);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_activities'").all();
    expect(tables).toHaveLength(1);
  });

  it('creates memory_snapshots table', () => {
    const db = initDatabase(cwd);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_snapshots'").all();
    expect(tables).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/conversations.test.ts`
Expected: FAIL — tables don't exist yet

**Step 3: Add new tables to initDatabase**

In `src/store/conversations.ts`, add to `initDatabase()` after existing CREATE TABLE statements (~line 77):

```typescript
// agent_sessions — Brain + Sub Agent 세션 추적
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    thread_ts TEXT,
    agent_type TEXT NOT NULL,
    skill_used TEXT,
    status TEXT DEFAULT 'active',
    resume_id TEXT,
    task_description TEXT,
    assigned_channels TEXT,
    cwd TEXT,
    message_count INTEGER DEFAULT 0,
    tools_used TEXT,
    created_at INTEGER,
    last_active_at INTEGER,
    completed_at INTEGER,
    result_summary TEXT
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_sessions_thread ON agent_sessions(thread_ts)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status)`);

// agent_activities — 활동 타임라인
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES agent_sessions(id),
    agent_type TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    tool_name TEXT,
    detail TEXT,
    channel_id TEXT,
    created_at INTEGER
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_session ON agent_activities(session_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_created ON agent_activities(created_at)`);

// memory_snapshots — 메모리 변경 이력
db.exec(`
  CREATE TABLE IF NOT EXISTS memory_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    changed_by TEXT,
    created_at INTEGER
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_file ON memory_snapshots(file_path)`);
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/conversations.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/conversations.ts src/store/conversations.test.ts
git commit -m "feat: add agent_sessions, agent_activities, memory_snapshots tables"
```

---

### Task 2: Create agent session store CRUD

**Files:**
- Create: `src/store/agentSessions.ts`
- Create: `src/store/agentSessions.test.ts`

**Step 1: Write failing tests**

```typescript
// src/store/agentSessions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initDatabase } from './conversations.js';
import {
  createAgentSession,
  getAgentSession,
  getActiveSessions,
  updateAgentSession,
  getSessionActivities,
  logActivity,
} from './agentSessions.js';

describe('agentSessions', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'clackbot-test-'));
    initDatabase(cwd);
  });

  it('creates and retrieves a session', () => {
    const session = createAgentSession({
      threadTs: '1234.5678',
      agentType: 'channel-analyst',
      taskDescription: '#dev 채널 분석',
      assignedChannels: ['C0123'],
    });
    expect(session.id).toBeDefined();
    expect(session.status).toBe('active');

    const found = getAgentSession(session.id);
    expect(found?.agentType).toBe('channel-analyst');
  });

  it('lists active sessions', () => {
    createAgentSession({ threadTs: '1.1', agentType: 'brain' });
    createAgentSession({ threadTs: '2.2', agentType: 'channel-analyst' });
    const active = getActiveSessions();
    expect(active).toHaveLength(2);
  });

  it('updates session status', () => {
    const s = createAgentSession({ threadTs: '1.1', agentType: 'brain' });
    updateAgentSession(s.id, { status: 'completed', resultSummary: '완료' });
    const found = getAgentSession(s.id);
    expect(found?.status).toBe('completed');
    expect(found?.resultSummary).toBe('완료');
  });

  it('logs and retrieves activities', () => {
    const s = createAgentSession({ threadTs: '1.1', agentType: 'brain' });
    logActivity({
      sessionId: s.id,
      agentType: 'brain',
      activityType: 'tool_use',
      toolName: 'slack_read_channel',
      detail: { channel: '#dev' },
    });
    const activities = getSessionActivities(s.id);
    expect(activities).toHaveLength(1);
    expect(activities[0].toolName).toBe('slack_read_channel');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/agentSessions.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Implement agentSessions store**

```typescript
// src/store/agentSessions.ts
import { v4 as uuid } from 'uuid';
import { getDb } from './conversations.js';

export interface AgentSession {
  id: string;
  threadTs?: string;
  agentType: string;
  skillUsed?: string;
  status: 'active' | 'completed' | 'failed' | 'expired';
  resumeId?: string;
  taskDescription?: string;
  assignedChannels?: string[];
  cwd?: string;
  messageCount: number;
  toolsUsed: string[];
  createdAt: number;
  lastActiveAt: number;
  completedAt?: number;
  resultSummary?: string;
}

export interface AgentActivity {
  id: number;
  sessionId: string;
  agentType: string;
  activityType: 'tool_use' | 'skill_invoke' | 'agent_spawn' | 'memory_update';
  toolName?: string;
  detail?: Record<string, unknown>;
  channelId?: string;
  createdAt: number;
}

export function createAgentSession(params: {
  threadTs?: string;
  agentType: string;
  skillUsed?: string;
  taskDescription?: string;
  assignedChannels?: string[];
  cwd?: string;
  resumeId?: string;
}): AgentSession {
  const db = getDb();
  const now = Date.now();
  const id = uuid();

  db.prepare(`
    INSERT INTO agent_sessions (id, thread_ts, agent_type, skill_used, status, resume_id,
      task_description, assigned_channels, cwd, message_count, tools_used, created_at, last_active_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, '[]', ?, ?)
  `).run(
    id, params.threadTs ?? null, params.agentType, params.skillUsed ?? null,
    params.resumeId ?? null, params.taskDescription ?? null,
    params.assignedChannels ? JSON.stringify(params.assignedChannels) : null,
    params.cwd ?? null, now, now
  );

  return getAgentSession(id)!;
}

export function getAgentSession(id: string): AgentSession | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : undefined;
}

export function getAgentSessionByThread(threadTs: string): AgentSession | undefined {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM agent_sessions WHERE thread_ts = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(threadTs) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : undefined;
}

export function getActiveSessions(): AgentSession[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM agent_sessions WHERE status = 'active' ORDER BY last_active_at DESC").all();
  return (rows as Record<string, unknown>[]).map(mapRow);
}

export function getAllSessions(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): { sessions: AgentSession[]; total: number } {
  const db = getDb();
  const where = options?.status ? `WHERE status = '${options.status}'` : '';
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM agent_sessions ${where}`).get() as { cnt: number }).cnt;
  const rows = db.prepare(
    `SELECT * FROM agent_sessions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(options?.limit ?? 50, options?.offset ?? 0);
  return { sessions: (rows as Record<string, unknown>[]).map(mapRow), total };
}

export function updateAgentSession(id: string, updates: Partial<{
  status: string;
  resumeId: string;
  messageCount: number;
  toolsUsed: string[];
  resultSummary: string;
  completedAt: number;
}>): void {
  const db = getDb();
  const sets: string[] = ['last_active_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
  if (updates.resumeId !== undefined) { sets.push('resume_id = ?'); values.push(updates.resumeId); }
  if (updates.messageCount !== undefined) { sets.push('message_count = ?'); values.push(updates.messageCount); }
  if (updates.toolsUsed !== undefined) { sets.push('tools_used = ?'); values.push(JSON.stringify(updates.toolsUsed)); }
  if (updates.resultSummary !== undefined) { sets.push('result_summary = ?'); values.push(updates.resultSummary); }
  if (updates.completedAt !== undefined) { sets.push('completed_at = ?'); values.push(updates.completedAt); }

  values.push(id);
  db.prepare(`UPDATE agent_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function logActivity(params: {
  sessionId: string;
  agentType: string;
  activityType: string;
  toolName?: string;
  detail?: Record<string, unknown>;
  channelId?: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO agent_activities (session_id, agent_type, activity_type, tool_name, detail, channel_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.sessionId, params.agentType, params.activityType,
    params.toolName ?? null, params.detail ? JSON.stringify(params.detail) : null,
    params.channelId ?? null, Date.now()
  );
}

export function getSessionActivities(sessionId: string): AgentActivity[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM agent_activities WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId);
  return (rows as Record<string, unknown>[]).map(mapActivityRow);
}

export function getRecentActivities(limit = 50, offset = 0): AgentActivity[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM agent_activities ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
  return (rows as Record<string, unknown>[]).map(mapActivityRow);
}

function mapRow(row: Record<string, unknown>): AgentSession {
  return {
    id: row.id as string,
    threadTs: row.thread_ts as string | undefined,
    agentType: row.agent_type as string,
    skillUsed: row.skill_used as string | undefined,
    status: row.status as AgentSession['status'],
    resumeId: row.resume_id as string | undefined,
    taskDescription: row.task_description as string | undefined,
    assignedChannels: row.assigned_channels ? JSON.parse(row.assigned_channels as string) : undefined,
    cwd: row.cwd as string | undefined,
    messageCount: row.message_count as number,
    toolsUsed: row.tools_used ? JSON.parse(row.tools_used as string) : [],
    createdAt: row.created_at as number,
    lastActiveAt: row.last_active_at as number,
    completedAt: row.completed_at as number | undefined,
    resultSummary: row.result_summary as string | undefined,
  };
}

function mapActivityRow(row: Record<string, unknown>): AgentActivity {
  return {
    id: row.id as number,
    sessionId: row.session_id as string,
    agentType: row.agent_type as string,
    activityType: row.activity_type as AgentActivity['activityType'],
    toolName: row.tool_name as string | undefined,
    detail: row.detail ? JSON.parse(row.detail as string) : undefined,
    channelId: row.channel_id as string | undefined,
    createdAt: row.created_at as number,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/agentSessions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/agentSessions.ts src/store/agentSessions.test.ts
git commit -m "feat: add agent session and activity store CRUD"
```

---

### Task 3: Create brain memory directory & memory snapshot store

**Files:**
- Create: `src/store/brainMemory.ts`
- Create: `src/store/brainMemory.test.ts`
- Modify: `src/config/paths.ts` (add brain paths)

**Step 1: Write failing tests**

```typescript
// src/store/brainMemory.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initDatabase } from './conversations.js';
import {
  initBrainMemory,
  readBrainFile,
  writeBrainFile,
  listBrainFiles,
  searchBrainMemory,
  getMemoryHistory,
} from './brainMemory.js';

describe('brainMemory', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'clackbot-test-'));
    mkdirSync(join(cwd, '.clackbot'), { recursive: true });
    initDatabase(cwd);
  });

  it('initializes brain directory with default files', () => {
    initBrainMemory(cwd);
    const files = listBrainFiles(cwd);
    expect(files).toContain('memory.md');
    expect(files).toContain('sessions.md');
  });

  it('writes and reads brain files', () => {
    initBrainMemory(cwd);
    writeBrainFile(cwd, 'memory.md', '# 테스트 메모리\n- 항목1', 'brain');
    const content = readBrainFile(cwd, 'memory.md');
    expect(content).toContain('# 테스트 메모리');
  });

  it('saves memory snapshots on write', () => {
    initBrainMemory(cwd);
    writeBrainFile(cwd, 'memory.md', 'v1', 'brain');
    writeBrainFile(cwd, 'memory.md', 'v2', 'user');
    const history = getMemoryHistory('memory.md');
    expect(history).toHaveLength(2);
    expect(history[0].changedBy).toBe('user');
    expect(history[1].changedBy).toBe('brain');
  });

  it('searches across all brain files', () => {
    initBrainMemory(cwd);
    writeBrainFile(cwd, 'memory.md', '주간보고는 금요일', 'brain');
    writeBrainFile(cwd, 'knowledge.md', '팀 미팅은 월요일', 'brain');
    const results = searchBrainMemory(cwd, '금요일');
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe('memory.md');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/brainMemory.test.ts`
Expected: FAIL

**Step 3: Add brain paths to config**

In `src/config/paths.ts`, add:

```typescript
export function getBrainDir(cwd?: string): string {
  return join(getClackbotDir(cwd), 'brain');
}

export function getBrainFilePath(cwd: string, fileName: string): string {
  return join(getBrainDir(cwd), fileName);
}
```

**Step 4: Implement brainMemory store**

```typescript
// src/store/brainMemory.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { getBrainDir } from '../config/paths.js';
import { getDb } from './conversations.js';

const DEFAULT_FILES: Record<string, string> = {
  'memory.md': '# Brain 메모리\n\n사용자 프로필, 선호, 핵심 패턴을 기록합니다.\n',
  'sessions.md': '# 활성 세션\n\n현재 진행 중인 Sub Agent 세션 요약.\n',
  'knowledge.md': '# 학습된 지식\n\n채널 맥락, 업무 패턴, 반복 작업 등.\n',
  'tasks.md': '# 작업 히스토리\n\n완료/진행중 작업 로그.\n',
};

export function initBrainMemory(cwd: string): void {
  const brainDir = getBrainDir(cwd);
  mkdirSync(brainDir, { recursive: true });
  mkdirSync(join(brainDir, 'channels'), { recursive: true });

  for (const [file, content] of Object.entries(DEFAULT_FILES)) {
    const path = join(brainDir, file);
    if (!existsSync(path)) {
      writeFileSync(path, content, 'utf-8');
    }
  }
}

export function readBrainFile(cwd: string, fileName: string): string {
  const path = join(getBrainDir(cwd), fileName);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

export function writeBrainFile(cwd: string, fileName: string, content: string, changedBy: string): void {
  const brainDir = getBrainDir(cwd);
  const path = join(brainDir, fileName);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf-8');

  // 스냅샷 저장
  const db = getDb();
  db.prepare(`
    INSERT INTO memory_snapshots (file_path, content, changed_by, created_at)
    VALUES (?, ?, ?, ?)
  `).run(fileName, content, changedBy, Date.now());
}

export function listBrainFiles(cwd: string): string[] {
  const brainDir = getBrainDir(cwd);
  if (!existsSync(brainDir)) return [];
  return collectFiles(brainDir, brainDir);
}

function collectFiles(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full, baseDir));
    } else if (entry.endsWith('.md')) {
      results.push(relative(baseDir, full));
    }
  }
  return results;
}

export function searchBrainMemory(cwd: string, query: string): Array<{ file: string; line: string; lineNumber: number }> {
  const files = listBrainFiles(cwd);
  const results: Array<{ file: string; line: string; lineNumber: number }> = [];

  for (const file of files) {
    const content = readBrainFile(cwd, file);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query.toLowerCase())) {
        results.push({ file, line: lines[i], lineNumber: i + 1 });
      }
    }
  }
  return results;
}

export function getMemoryHistory(filePath: string, limit = 20): Array<{
  id: number;
  content: string;
  changedBy: string;
  createdAt: number;
}> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM memory_snapshots WHERE file_path = ? ORDER BY created_at DESC LIMIT ?'
  ).all(filePath, limit) as Record<string, unknown>[];

  return rows.map(r => ({
    id: r.id as number,
    content: r.content as string,
    changedBy: r.changed_by as string,
    createdAt: r.created_at as number,
  }));
}

/** 코어 메모리 로드 (시스템 프롬프트 주입용) */
export function loadCoreMemory(cwd: string): string {
  const memory = readBrainFile(cwd, 'memory.md');
  const sessions = readBrainFile(cwd, 'sessions.md');

  let result = '';
  if (memory) result += `## Brain 메모리\n${memory}\n\n`;
  if (sessions) result += `## 활성 세션\n${sessions}\n\n`;
  return result;
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/store/brainMemory.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/store/brainMemory.ts src/store/brainMemory.test.ts src/config/paths.ts
git commit -m "feat: add brain memory store with snapshots and search"
```

---

## Phase 2: Brain Agent Core

### Task 4: Create enhanced brain memory MCP tools

**Files:**
- Create: `src/agent/tools/builtin/brainMemory.ts`
- Modify: `src/agent/tools/loader.ts:206-276` (register brain tools in getMcpServers)

**Step 1: Implement brain memory MCP tools**

```typescript
// src/agent/tools/builtin/brainMemory.ts
import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import {
  readBrainFile,
  writeBrainFile,
  listBrainFiles,
  searchBrainMemory,
  loadCoreMemory,
} from '../../store/brainMemory.js';
import {
  getActiveSessions,
  updateAgentSession,
} from '../../store/agentSessions.js';

let currentCwd = '';
export function setBrainCwd(cwd: string) { currentCwd = cwd; }

export const brainMemoryReadTool = tool(
  'brain_memory_read',
  'Brain의 메모리 파일을 읽습니다. 파일명: memory.md, sessions.md, knowledge.md, tasks.md, channels/{name}.md',
  { file: z.string().describe('읽을 파일명 (예: memory.md, knowledge.md, channels/dev.md)') },
  async ({ file }) => {
    const content = readBrainFile(currentCwd, file);
    if (!content) return { content: [{ type: 'text' as const, text: `파일을 찾을 수 없습니다: ${file}` }] };
    return { content: [{ type: 'text' as const, text: content }] };
  }
);

export const brainMemoryWriteTool = tool(
  'brain_memory_write',
  'Brain의 메모리 파일에 내용을 씁니다. 안정적 사실만 저장하세요.',
  {
    file: z.string().describe('쓸 파일명 (예: memory.md, tasks.md)'),
    content: z.string().describe('파일에 쓸 전체 내용'),
  },
  async ({ file, content }) => {
    writeBrainFile(currentCwd, file, content, 'brain');
    return { content: [{ type: 'text' as const, text: `${file} 업데이트 완료` }] };
  }
);

export const brainMemorySearchTool = tool(
  'brain_memory_search',
  'Brain의 모든 메모리 파일에서 키워드를 검색합니다.',
  { query: z.string().describe('검색할 키워드') },
  async ({ query }) => {
    const results = searchBrainMemory(currentCwd, query);
    if (results.length === 0) return { content: [{ type: 'text' as const, text: '검색 결과 없음' }] };
    const text = results.map(r => `[${r.file}:${r.lineNumber}] ${r.line}`).join('\n');
    return { content: [{ type: 'text' as const, text }] };
  }
);

export const brainMemoryListTool = tool(
  'brain_memory_list',
  'Brain 메모리의 모든 파일 목록을 반환합니다.',
  {},
  async () => {
    const files = listBrainFiles(currentCwd);
    return { content: [{ type: 'text' as const, text: files.join('\n') }] };
  }
);

export const brainListSessionsTool = tool(
  'brain_list_sessions',
  '활성 중인 Sub Agent 세션 목록을 조회합니다.',
  {},
  async () => {
    const sessions = getActiveSessions();
    if (sessions.length === 0) return { content: [{ type: 'text' as const, text: '활성 세션 없음' }] };
    const text = sessions.map(s =>
      `[${s.id.slice(0, 8)}] ${s.agentType} | ${s.taskDescription ?? '(설명 없음)'} | 메시지 ${s.messageCount}개`
    ).join('\n');
    return { content: [{ type: 'text' as const, text }] };
  }
);

export const brainKillSessionTool = tool(
  'brain_kill_session',
  'Sub Agent 세션을 종료합니다.',
  { sessionId: z.string().describe('종료할 세션 ID') },
  async ({ sessionId }) => {
    updateAgentSession(sessionId, { status: 'expired', completedAt: Date.now() });
    return { content: [{ type: 'text' as const, text: `세션 ${sessionId} 종료됨` }] };
  }
);
```

**Step 2: Register brain tools in loader.ts**

In `src/agent/tools/loader.ts`, update `getMcpServers()` to include brain tools alongside existing builtin tools. Import brain tools and add them to the `createSdkMcpServer()` call.

**Step 3: Run existing tests + manual verification**

Run: `npx vitest run`
Expected: All existing tests still pass

**Step 4: Commit**

```bash
git add src/agent/tools/builtin/brainMemory.ts src/agent/tools/loader.ts
git commit -m "feat: add brain memory MCP tools (read/write/search/list/sessions)"
```

---

### Task 5: Create Slack thread reading tool

**Files:**
- Create: `src/agent/tools/builtin/slackReadThread.ts`
- Modify: `src/agent/tools/loader.ts` (register)

**Step 1: Implement slack_read_thread tool**

```typescript
// src/agent/tools/builtin/slackReadThread.ts
import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';

let slackClient: any = null;
export function setSlackClientForThread(client: any) { slackClient = client; }

export const slackReadThreadTool = tool(
  'slack_read_thread',
  'Slack 스레드의 모든 메시지를 읽습니다.',
  {
    channel: z.string().describe('채널 ID'),
    thread_ts: z.string().describe('스레드의 parent message timestamp'),
    limit: z.number().optional().describe('최대 메시지 수 (기본 100)'),
  },
  async ({ channel, thread_ts, limit }) => {
    if (!slackClient) return { content: [{ type: 'text' as const, text: 'Slack 클라이언트 미연결' }] };
    const result = await slackClient.conversations.replies({
      channel,
      ts: thread_ts,
      limit: limit ?? 100,
    });
    const messages = (result.messages ?? []).map((m: any) =>
      `[${m.user ?? 'bot'}] ${m.text}`
    ).join('\n');
    return { content: [{ type: 'text' as const, text: messages || '메시지 없음' }] };
  }
);
```

**Step 2: Register in loader.ts, commit**

```bash
git add src/agent/tools/builtin/slackReadThread.ts src/agent/tools/loader.ts
git commit -m "feat: add slack_read_thread tool for sub agents"
```

---

### Task 6: Create Brain Agent module

**Files:**
- Create: `src/agent/brain.ts`
- Create: `src/agent/brain.test.ts`

**Step 1: Write failing test**

```typescript
// src/agent/brain.test.ts
import { describe, it, expect } from 'vitest';
import { buildBrainSystemPrompt, buildBrainQueryOptions } from './brain.js';

describe('buildBrainSystemPrompt', () => {
  it('includes core memory in prompt', () => {
    const prompt = buildBrainSystemPrompt('# 테스트 메모리', '# 세션 없음');
    expect(prompt).toContain('# 테스트 메모리');
    expect(prompt).toContain('# 세션 없음');
  });

  it('includes Brain role description', () => {
    const prompt = buildBrainSystemPrompt('', '');
    expect(prompt).toContain('Brain Agent');
  });
});

describe('buildBrainQueryOptions', () => {
  it('includes settingSources for skill discovery', () => {
    const opts = buildBrainQueryOptions({ cwd: '/tmp/test', mcpServers: {} });
    expect(opts.settingSources).toContain('project');
  });

  it('includes Task and Skill in allowedTools', () => {
    const opts = buildBrainQueryOptions({ cwd: '/tmp/test', mcpServers: {} });
    expect(opts.allowedTools).toContain('Task');
    expect(opts.allowedTools).toContain('Skill');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/agent/brain.test.ts`
Expected: FAIL

**Step 3: Implement brain agent module**

```typescript
// src/agent/brain.ts
import { query, type Options } from '@anthropic-ai/claude-code';
import { loadCoreMemory, readBrainFile } from '../store/brainMemory.js';
import { createAgentSession, updateAgentSession, logActivity } from '../store/agentSessions.js';
import { getMcpServers } from './tools/loader.js';
import { setBrainCwd } from './tools/builtin/brainMemory.js';
import { loadConfig } from '../config/index.js';
import { formatToolActivity } from './claude.js';

export function buildBrainSystemPrompt(coreMemory: string, activeSessions: string): string {
  return `당신은 Clackbot의 Brain Agent입니다.

## 역할
- 사용자의 모든 Slack 메시지를 수신하는 글로벌 비서
- 간단한 질문은 직접 답변
- 복잡한 작업(채널 분석, 보고서 작성 등)은 Task 도구로 적절한 Sub Agent 생성
- 모든 작업 결과를 메모리에 기록

## 사용 가능한 도구
- brain_memory_read/write/search/list: Brain 메모리 관리
- brain_list_sessions / brain_kill_session: Sub Agent 세션 관리
- slack_read_channel / slack_post / slack_send_dm: Slack 연동
- Task: Sub Agent 생성 (subagent_type으로 에이전트 지정)
- Skill: 행동 규칙 발동

## 판단 기준
- 인사, 간단한 질문, 상태 확인 → 직접 답변
- 채널 분석, 정리, 보고서, 외부 서비스 연동 → Sub Agent 생성
- 메모리 업데이트가 필요한 정보 → brain_memory_write 호출

## Brain 메모리 (코어)
${coreMemory || '(비어 있음)'}

## 활성 세션
${activeSessions || '(활성 세션 없음)'}
`;
}

export function buildBrainQueryOptions(params: {
  cwd: string;
  mcpServers: Record<string, unknown>;
  canUseTool?: Options['canUseTool'];
}): Options & { settingSources: string[] } {
  return {
    cwd: params.cwd,
    customSystemPrompt: undefined, // 호출 시 설정
    settingSources: ['user', 'project'],
    allowedTools: [
      'Skill', 'Task', 'Read', 'Write',
      'mcp__clackbot__brain_memory_read',
      'mcp__clackbot__brain_memory_write',
      'mcp__clackbot__brain_memory_search',
      'mcp__clackbot__brain_memory_list',
      'mcp__clackbot__brain_list_sessions',
      'mcp__clackbot__brain_kill_session',
      'mcp__clackbot__slack_post',
      'mcp__clackbot__slack_send_dm',
      'mcp__clackbot__slack_read_channel',
    ],
    mcpServers: params.mcpServers as Record<string, any>,
    canUseTool: params.canUseTool,
    maxTurns: 15,
  };
}

export interface BrainQueryParams {
  prompt: string;
  cwd: string;
  threadTs?: string;
  isOwner: boolean;
  onProgress?: (status: string) => void;
}

export interface BrainQueryResult {
  text: string;
  toolsUsed: string[];
  sessionId: string;
}

export async function queryBrain(params: BrainQueryParams): Promise<BrainQueryResult> {
  const { prompt, cwd, threadTs, onProgress } = params;

  setBrainCwd(cwd);

  // 코어 메모리 로드
  const coreMemory = loadCoreMemory(cwd);
  const activeSessions = readBrainFile(cwd, 'sessions.md');
  const systemPrompt = buildBrainSystemPrompt(coreMemory, activeSessions);

  // Brain 세션 생성 (매번 새로)
  const session = createAgentSession({
    threadTs,
    agentType: 'brain',
    taskDescription: prompt.slice(0, 200),
  });

  // MCP 서버 로드
  const mcpServers = getMcpServers(cwd);

  // query 옵션
  const options = buildBrainQueryOptions({ cwd, mcpServers });
  (options as any).customSystemPrompt = systemPrompt;

  let responseText = '';
  const toolsUsed: string[] = [];

  const q = query({
    prompt,
    options: options as Options,
  });

  for await (const message of q) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          responseText = block.text;
        } else if (block.type === 'tool_use') {
          const toolName = block.name;
          if (!toolsUsed.includes(toolName)) toolsUsed.push(toolName);

          logActivity({
            sessionId: session.id,
            agentType: 'brain',
            activityType: toolName === 'Task' ? 'agent_spawn' : 'tool_use',
            toolName,
            detail: { input: block.input },
          });

          if (onProgress) {
            onProgress(formatToolActivity(toolName, block.input as Record<string, unknown>));
          }
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        // 최종 응답 텍스트 추출
        const lastAssistant = message.messages
          ?.filter((m: any) => m.role === 'assistant')
          .pop();
        if (lastAssistant) {
          for (const block of lastAssistant.content) {
            if (block.type === 'text') responseText = block.text;
          }
        }
      }
    }
  }

  // 세션 업데이트
  updateAgentSession(session.id, {
    status: 'completed',
    toolsUsed,
    completedAt: Date.now(),
  });

  return { text: responseText, toolsUsed, sessionId: session.id };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/agent/brain.test.ts`
Expected: PASS (unit tests for prompt/options builders)

**Step 5: Commit**

```bash
git add src/agent/brain.ts src/agent/brain.test.ts
git commit -m "feat: add Brain Agent module with query wrapper"
```

---

### Task 7: Create Skills and Agents files

**Files:**
- Create: `.claude/skills/brain-router/SKILL.md`
- Create: `.claude/agents/channel-analyst.md`
- Create: `.claude/agents/weekly-reporter.md`
- Create: `.claude/agents/task-organizer.md`

**Step 1: Create brain-router skill**

```markdown
<!-- .claude/skills/brain-router/SKILL.md -->
---
name: brain-router
description: "Use when receiving any Slack message - decides whether to answer directly or spawn a sub-agent for complex tasks like channel analysis, report writing, or multi-step operations"
---

# Brain Router

You are the Brain Agent of Clackbot. When you receive a Slack message, follow this routing logic:

## Direct Answer (no Sub Agent needed)
- 인사, 안부 ("안녕", "뭐해?")
- 간단한 질문 ("회의 몇시?", "오늘 날짜?")
- 메모리 조회 ("내가 지난에 뭐라고 했지?")
- 상태 확인 ("활성 세션 뭐 있어?")
- 간단한 메모 저장 ("이거 기억해줘: ...")

→ 직접 답변하고, 필요하면 brain_memory_write로 기록

## Sub Agent 필요 (Task 도구 사용)
- 채널 분석 ("'#dev 이번 주 정리해줘") → channel-analyst
- 보고서 작성 ("주간보고 올려줘") → weekly-reporter
- 작업 정리 ("할일 목록 만들어줘") → task-organizer
- 복합 작업 (여러 채널 + 외부 서비스) → 적절한 agent

→ Task(subagent_type: "agent-name", prompt: "구체적 지시사항...")

## Sub Agent 호출 시 반드시 포함
1. 명확한 작업 설명
2. 대상 채널 ID (있으면)
3. Brain 메모리에서 관련 컨텍스트
4. 결과 형식 지정

## 작업 완료 후
1. Slack 스레드에 결과 게시
2. brain_memory_write로 tasks.md 업데이트
3. 중요한 학습이 있으면 knowledge.md 업데이트
```

**Step 2: Create agent definitions**

```markdown
<!-- .claude/agents/channel-analyst.md -->
---
name: channel-analyst
description: Use when analyzing Slack channel history, summarizing conversations, or extracting user activities from channels
tools: mcp__clackbot__slack_read_channel, mcp__clackbot__slack_read_thread, mcp__clackbot__slack_post
model: sonnet
---

You are a Slack channel analysis specialist for Clackbot.

## Your Task
Given a task description with target channels, you:
1. Read channel history using slack_read_channel
2. Filter messages by relevance (user activity, topic, date range)
3. Analyze and categorize the content
4. Summarize findings in clear, structured Korean

## Output Format
- 핵심 요약 (3-5줄)
- 주요 활동 목록 (시간순)
- 참여한 대화/스레드 요약
- 필요 시 액션 아이템

## Rules
- 한국어로 응답
- Slack mrkdwn 형식 사용 (*bold*, _italic_, `code`)
- 불필요한 정보 제거, 핵심만 정리
```

```markdown
<!-- .claude/agents/weekly-reporter.md -->
---
name: weekly-reporter
description: Use when creating weekly reports, summarizing weekly activities across channels, or posting reports to external services like Arbor
tools: mcp__clackbot__slack_read_channel, mcp__clackbot__slack_post, Bash, Read, Write
model: sonnet
---

You are a weekly report specialist for Clackbot.

## Your Task
1. Read specified channels' history for the past week
2. Extract and summarize the user's activities
3. Format into a weekly report
4. Post to the specified service (Arbor, Slack, etc.)

## Report Format
- 이번 주 핵심 성과 (3-5개)
- 채널별 활동 요약
- 진행 중인 작업
- 다음 주 계획 (파악 가능한 경우)

## Rules
- 한국어로 작성
- 간결하고 구체적으로
- 수치나 결과물 위주로 정리
```

```markdown
<!-- .claude/agents/task-organizer.md -->
---
name: task-organizer
description: Use when organizing tasks, creating todo lists, tracking action items, or managing work items
tools: mcp__clackbot__brain_memory_read, mcp__clackbot__brain_memory_write, mcp__clackbot__slack_post
model: sonnet
---

You are a task organization specialist for Clackbot.

## Your Task
1. Parse the user's request for tasks/action items
2. Read existing tasks from brain memory (tasks.md)
3. Organize, prioritize, and update the task list
4. Report back with the updated task summary

## Rules
- 한국어로 응답
- 우선순위: 긴급/중요 매트릭스 사용
- 완료된 작업은 아카이브 (tasks.md 하단으로)
```

**Step 3: Commit**

```bash
git add .claude/skills/brain-router/SKILL.md .claude/agents/channel-analyst.md .claude/agents/weekly-reporter.md .claude/agents/task-organizer.md
git commit -m "feat: add brain-router skill and sub agent definitions"
```

---

## Phase 3: Message Router Refactoring

### Task 8: Refactor message handler for Brain/Sub Agent routing

**Files:**
- Modify: `src/slack/listeners/handler.ts`
- Modify: `src/slack/listeners/appMention.ts`
- Modify: `src/slack/listeners/directMessage.ts`

**Step 1: Refactor handler.ts**

The current `handleMessage()` in `handler.ts` calls `queryAgent()` directly. Refactor to:
1. Check if thread has active Sub Agent session → resume Sub Agent
2. Otherwise → call `queryBrain()` instead of `queryAgent()`

Key changes:
- Import `queryBrain` from `../agent/brain.js`
- Import `getAgentSessionByThread` from `../../store/agentSessions.js`
- Import `initBrainMemory` from `../../store/brainMemory.js`
- At start: check `getAgentSessionByThread(threadTs)` for active sub agent
- If active sub agent: call existing `queryAgent()` with that session's resume ID
- If no active sub agent: call `queryBrain()` for Brain routing
- Save conversation + activity logs after response

**Step 2: Update appMention.ts and directMessage.ts**

Minimal changes — these pass parameters to `handleMessage()` which now routes internally.
Add `initBrainMemory(cwd)` call on first message to ensure brain directory exists.

**Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Manual integration test**

Start bot with `npx tsx bin/clackbot.ts start`, send a DM, verify Brain Agent responds.

**Step 5: Commit**

```bash
git add src/slack/listeners/handler.ts src/slack/listeners/appMention.ts src/slack/listeners/directMessage.ts
git commit -m "feat: refactor message handler for Brain/Sub Agent routing"
```

---

### Task 9: Update session manager for multi-agent sessions

**Files:**
- Modify: `src/session/manager.ts`
- Modify: `src/session/types.ts`

**Step 1: Extend Session type**

Add `agentType` field to `Session` interface in `types.ts`:
```typescript
export interface Session {
  id: string;
  threadTs: string;
  agentType: 'brain' | string;  // 'brain' or sub agent type
  resumeId?: string;
  messageCount: number;
  createdAt: number;
  lastActiveAt: number;
}
```

**Step 2: Update SessionManager**

`SessionManager` now delegates to `agentSessions` store instead of raw SQLite for session tracking. The `getOrCreate` method checks `agent_sessions` table for active sessions by threadTs.

**Step 3: Run tests, commit**

```bash
git add src/session/manager.ts src/session/types.ts
git commit -m "feat: update session manager for multi-agent support"
```

---

## Phase 4: Dashboard Backend

### Task 10: Add session management API

**Files:**
- Create: `src/web/api/sessions.ts`
- Modify: `src/web/server.ts` (mount router)

**Step 1: Implement sessions API**

```typescript
// src/web/api/sessions.ts
import { Router } from 'express';
import {
  getAllSessions,
  getAgentSession,
  updateAgentSession,
  getSessionActivities,
} from '../../store/agentSessions.js';

const router = Router();

// GET /api/sessions — 세션 목록
router.get('/', (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const result = getAllSessions({ status, limit, offset });
  res.json(result);
});

// GET /api/sessions/:id — 세션 상세
router.get('/:id', (req, res) => {
  const session = getAgentSession(req.params.id);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
  const activities = getSessionActivities(req.params.id);
  res.json({ ...session, activities });
});

// POST /api/sessions/:id/kill — 세션 종료
router.post('/:id/kill', (req, res) => {
  updateAgentSession(req.params.id, { status: 'expired', completedAt: Date.now() });
  res.json({ ok: true });
});

export default router;
```

**Step 2: Mount in server.ts, commit**

```bash
git add src/web/api/sessions.ts src/web/server.ts
git commit -m "feat: add session management API endpoints"
```

---

### Task 11: Add activity timeline API

**Files:**
- Create: `src/web/api/activities.ts`
- Modify: `src/web/server.ts`

**Step 1: Implement activities API**

```typescript
// src/web/api/activities.ts
import { Router } from 'express';
import { getRecentActivities, getSessionActivities } from '../../store/agentSessions.js';

const router = Router();

// GET /api/activities — 최근 활동 타임라인
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const sessionId = req.query.session as string | undefined;

  if (sessionId) {
    res.json(getSessionActivities(sessionId));
  } else {
    res.json(getRecentActivities(limit, offset));
  }
});

export default router;
```

**Step 2: Mount, commit**

```bash
git add src/web/api/activities.ts src/web/server.ts
git commit -m "feat: add activity timeline API"
```

---

### Task 12: Add brain memory API

**Files:**
- Modify: `src/web/api/memory.ts` (expand existing)

**Step 1: Expand memory API**

Add to existing `src/web/api/memory.ts`:

```typescript
// GET /api/brain/memory — 메모리 파일 트리
router.get('/brain', (req, res) => {
  const files = listBrainFiles(cwd);
  res.json({ files });
});

// GET /api/brain/memory/:path — 메모리 파일 내용
router.get('/brain/:path(*)', (req, res) => {
  const content = readBrainFile(cwd, req.params.path);
  res.json({ path: req.params.path, content });
});

// GET /api/brain/memory/:path/history — 변경 이력
router.get('/brain/:path(*)/history', (req, res) => {
  const history = getMemoryHistory(req.params.path);
  res.json(history);
});
```

**Step 2: Commit**

```bash
git add src/web/api/memory.ts
git commit -m "feat: add brain memory API endpoints"
```

---

### Task 13: Add agents & skills listing API

**Files:**
- Create: `src/web/api/agents.ts`
- Modify: `src/web/server.ts`

**Step 1: Implement agents API**

```typescript
// src/web/api/agents.ts
import { Router } from 'express';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const router = Router();

// GET /api/agents — Agent 정의 목록
router.get('/', (req, res) => {
  const cwd = process.cwd();
  const agentsDir = join(cwd, '.claude', 'agents');
  const agents = loadMarkdownDefinitions(agentsDir);
  res.json(agents);
});

// GET /api/skills — Skill 목록
router.get('/skills', (req, res) => {
  const cwd = process.cwd();
  const skillsDir = join(cwd, '.claude', 'skills');
  const skills = loadSkillDefinitions(skillsDir);
  res.json(skills);
});

function loadMarkdownDefinitions(dir: string) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = readFileSync(join(dir, f), 'utf-8');
      const frontmatter = parseFrontmatter(content);
      return { file: f, ...frontmatter, body: content };
    });
}

function loadSkillDefinitions(dir: string) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => existsSync(join(dir, f, 'SKILL.md')))
    .map(name => {
      const content = readFileSync(join(dir, name, 'SKILL.md'), 'utf-8');
      const frontmatter = parseFrontmatter(content);
      return { name, ...frontmatter, body: content };
    });
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) result[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
  }
  return result;
}

export default router;
```

**Step 2: Mount, commit**

```bash
git add src/web/api/agents.ts src/web/server.ts
git commit -m "feat: add agents and skills listing API"
```

---

## Phase 5: Dashboard Frontend

### Task 14: Add sessions management page

**Files:**
- Create: `src/web/frontend/views/SessionsView.vue`
- Modify: `src/web/frontend/router.ts` (add route)

**Step 1: Create SessionsView component**

Vue 3 SFC with:
- 세션 목록 (활성/완료/전체 필터)
- 각 세션 카드: agent_type, task_description, status, message_count, tools_used
- 클릭 시 상세 (activities 타임라인)
- 활성 세션 종료 버튼

**Step 2: Add route**

```typescript
{ path: '/sessions', name: 'sessions', component: () => import('./views/SessionsView.vue') }
```

**Step 3: Build and verify**

Run: `npx vite build src/web/frontend`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/web/frontend/views/SessionsView.vue src/web/frontend/router.ts
git commit -m "feat: add sessions management dashboard page"
```

---

### Task 15: Add activity timeline to home page

**Files:**
- Modify: `src/web/frontend/views/HomeView.vue`

**Step 1: Update HomeView**

Add activity timeline section:
- Fetch `/api/activities?limit=20`
- Display as time-ordered list: timestamp, agent_type icon, activity description
- Fetch `/api/sessions?status=active` for active session summary

**Step 2: Build, commit**

```bash
git add src/web/frontend/views/HomeView.vue
git commit -m "feat: add activity timeline to home dashboard"
```

---

### Task 16: Add brain memory viewer page

**Files:**
- Create: `src/web/frontend/views/BrainMemoryView.vue`
- Modify: `src/web/frontend/router.ts`

**Step 1: Create BrainMemoryView**

- 좌측: 파일 트리 (`/api/brain/memory`)
- 우측: 선택된 파일 내용 표시 (markdown rendered)
- 하단: 변경 이력 (`/api/brain/memory/:path/history`)

**Step 2: Add route, build, commit**

```bash
git add src/web/frontend/views/BrainMemoryView.vue src/web/frontend/router.ts
git commit -m "feat: add brain memory viewer dashboard page"
```

---

### Task 17: Add agents & skills page

**Files:**
- Modify: `src/web/frontend/views/ToolsView.vue` (or create new AgentsView.vue)

**Step 1: Update or create agents page**

- Skills 목록: name, description
- Agents 목록: name, description, tools, model
- MCP 서버 상태 (기존 기능 유지)

**Step 2: Build, commit**

```bash
git add src/web/frontend/views/ToolsView.vue src/web/frontend/router.ts
git commit -m "feat: add agents and skills to dashboard"
```

---

## Phase 6: Integration & Polish

### Task 18: Update sidebar navigation

**Files:**
- Modify: `src/web/frontend/components/AppSidebar.vue`

Add new navigation items: 세션 관리, Brain 메모리. Reorder to match new dashboard structure.

**Step 1: Update, build, commit**

```bash
git add src/web/frontend/components/AppSidebar.vue
git commit -m "feat: update sidebar navigation for v3 dashboard"
```

---

### Task 19: Initialize brain memory on bot start

**Files:**
- Modify: `src/cli/start.ts`

**Step 1: Add initBrainMemory call**

In `start.ts`, after `initDatabase()`, call `initBrainMemory(cwd)` to ensure brain directory and default files exist on first boot.

**Step 2: Test manually, commit**

```bash
git add src/cli/start.ts
git commit -m "feat: initialize brain memory on bot start"
```

---

### Task 20: End-to-end integration test

**Files:**
- Create: `src/agent/brain.integration.test.ts`

**Step 1: Write integration test**

Test the full flow:
1. Initialize brain memory
2. Call `queryBrain()` with a simple prompt
3. Verify response text is not empty
4. Verify session was created in DB
5. Verify activity was logged

Note: This test requires ANTHROPIC_API_KEY / Claude Code subscription to run. Mark as `.skip` in CI.

**Step 2: Run, verify, commit**

```bash
git add src/agent/brain.integration.test.ts
git commit -m "test: add brain agent end-to-end integration test"
```

---

### Task 21: Update CLAUDE.md for v3

**Files:**
- Modify: `CLAUDE.md`

Update sections:
- 기술 스택에 Skills/Agents 추가
- 디렉토리 구조에 `.claude/skills/`, `.claude/agents/`, `.clackbot/brain/` 추가
- 데이터 흐름을 Brain Agent 기반으로 업데이트
- 새 대시보드 페이지 설명

**Step 1: Update, commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for v3 Brain Agent architecture"
```

---

## Task Dependencies

```
Task 1 (DB schema)
  → Task 2 (agent session store)
  → Task 3 (brain memory store)
    → Task 4 (brain memory MCP tools)
    → Task 5 (slack thread tool)
      → Task 6 (brain agent module)
        → Task 7 (skills & agents files)
          → Task 8 (handler refactoring)
          → Task 9 (session manager update)
            → Task 10-13 (dashboard APIs) [parallel]
              → Task 14-17 (dashboard frontend) [parallel]
                → Task 18 (sidebar)
                → Task 19 (init on start)
                → Task 20 (integration test)
                → Task 21 (docs)
```

## Summary

| Phase | Tasks | 설명 |
|-------|-------|------|
| 1. Foundation | 1-3 | DB 스키마, 세션 스토어, 메모리 스토어 |
| 2. Brain Core | 4-7 | MCP 도구, Brain 모듈, Skills/Agents |
| 3. Router | 8-9 | 메시지 라우팅 리팩토링 |
| 4. Dashboard API | 10-13 | 세션, 활동, 메모리, 에이전트 API |
| 5. Dashboard UI | 14-17 | 세션 관리, 타임라인, 메모리 뷰어 |
| 6. Integration | 18-21 | 네비게이션, 초기화, 테스트, 문서 |
