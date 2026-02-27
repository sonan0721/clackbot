import { v4 as uuidv4 } from 'uuid';
import { initDatabase } from './conversations.js';

// ─── Agent 세션 & 활동 CRUD ───

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

// ─── DB Row 타입 (snake_case) ───

interface AgentSessionRow {
  id: string;
  thread_ts: string | null;
  agent_type: string;
  skill_used: string | null;
  status: string;
  resume_id: string | null;
  task_description: string | null;
  assigned_channels: string | null;
  cwd: string | null;
  message_count: number;
  tools_used: string | null;
  created_at: number;
  last_active_at: number;
  completed_at: number | null;
  result_summary: string | null;
}

interface AgentActivityRow {
  id: number;
  session_id: string;
  agent_type: string;
  activity_type: string;
  tool_name: string | null;
  detail: string | null;
  channel_id: string | null;
  created_at: number;
}

// ─── Row → TypeScript 변환 헬퍼 ───

function rowToSession(row: AgentSessionRow): AgentSession {
  return {
    id: row.id,
    threadTs: row.thread_ts ?? undefined,
    agentType: row.agent_type,
    skillUsed: row.skill_used ?? undefined,
    status: row.status as AgentSession['status'],
    resumeId: row.resume_id ?? undefined,
    taskDescription: row.task_description ?? undefined,
    assignedChannels: row.assigned_channels ? JSON.parse(row.assigned_channels) : undefined,
    cwd: row.cwd ?? undefined,
    messageCount: row.message_count,
    toolsUsed: row.tools_used ? JSON.parse(row.tools_used) : [],
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    completedAt: row.completed_at ?? undefined,
    resultSummary: row.result_summary ?? undefined,
  };
}

function rowToActivity(row: AgentActivityRow): AgentActivity {
  return {
    id: row.id,
    sessionId: row.session_id,
    agentType: row.agent_type,
    activityType: row.activity_type as AgentActivity['activityType'],
    toolName: row.tool_name ?? undefined,
    detail: row.detail ? JSON.parse(row.detail) : undefined,
    channelId: row.channel_id ?? undefined,
    createdAt: row.created_at,
  };
}

// ─── Session CRUD ───

export interface CreateAgentSessionParams {
  agentType: string;
  threadTs?: string;
  skillUsed?: string;
  taskDescription?: string;
  assignedChannels?: string[];
  cwd?: string;
}

/** 새 에이전트 세션 생성 */
export function createAgentSession(params: CreateAgentSessionParams): AgentSession {
  const database = initDatabase();
  const id = uuidv4();
  const now = Date.now();

  database.prepare(`
    INSERT INTO agent_sessions
      (id, thread_ts, agent_type, skill_used, status, task_description, assigned_channels, cwd, message_count, tools_used, created_at, last_active_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 0, '[]', ?, ?)
  `).run(
    id,
    params.threadTs ?? null,
    params.agentType,
    params.skillUsed ?? null,
    params.taskDescription ?? null,
    params.assignedChannels ? JSON.stringify(params.assignedChannels) : null,
    params.cwd ?? null,
    now,
    now,
  );

  return {
    id,
    threadTs: params.threadTs,
    agentType: params.agentType,
    skillUsed: params.skillUsed,
    status: 'active',
    taskDescription: params.taskDescription,
    assignedChannels: params.assignedChannels,
    cwd: params.cwd,
    messageCount: 0,
    toolsUsed: [],
    createdAt: now,
    lastActiveAt: now,
  };
}

/** ID로 세션 조회 */
export function getAgentSession(id: string): AgentSession | null {
  const database = initDatabase();
  const row = database.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(id) as AgentSessionRow | undefined;
  if (!row) return null;
  return rowToSession(row);
}

/** 스레드의 활성 세션 조회 */
export function getAgentSessionByThread(threadTs: string): AgentSession | null {
  const database = initDatabase();
  const row = database.prepare(
    "SELECT * FROM agent_sessions WHERE thread_ts = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(threadTs) as AgentSessionRow | undefined;
  if (!row) return null;
  return rowToSession(row);
}

/** 모든 활성 세션 목록 */
export function getActiveSessions(): AgentSession[] {
  const database = initDatabase();
  const rows = database.prepare(
    "SELECT * FROM agent_sessions WHERE status = 'active' ORDER BY last_active_at DESC"
  ).all() as AgentSessionRow[];
  return rows.map(rowToSession);
}

/** 세션 목록 조회 (페이지네이션 + 상태 필터) */
export function getAllSessions(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): { items: AgentSession[]; total: number } {
  const database = initDatabase();
  const { status, limit = 50, offset = 0 } = options ?? {};

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = database.prepare(
    `SELECT COUNT(*) as count FROM agent_sessions ${where}`
  ).get(...params) as { count: number };
  const total = countRow.count;

  const rows = database.prepare(
    `SELECT * FROM agent_sessions ${where} ORDER BY last_active_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as AgentSessionRow[];

  return {
    items: rows.map(rowToSession),
    total,
  };
}

export interface UpdateAgentSessionParams {
  status?: 'active' | 'completed' | 'failed' | 'expired';
  resumeId?: string;
  messageCount?: number;
  toolsUsed?: string[];
  resultSummary?: string;
  completedAt?: number;
}

/** 세션 업데이트 */
export function updateAgentSession(id: string, updates: UpdateAgentSessionParams): void {
  const database = initDatabase();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.status !== undefined) {
    sets.push('status = ?');
    params.push(updates.status);
  }
  if (updates.resumeId !== undefined) {
    sets.push('resume_id = ?');
    params.push(updates.resumeId);
  }
  if (updates.messageCount !== undefined) {
    sets.push('message_count = ?');
    params.push(updates.messageCount);
  }
  if (updates.toolsUsed !== undefined) {
    sets.push('tools_used = ?');
    params.push(JSON.stringify(updates.toolsUsed));
  }
  if (updates.resultSummary !== undefined) {
    sets.push('result_summary = ?');
    params.push(updates.resultSummary);
  }
  if (updates.completedAt !== undefined) {
    sets.push('completed_at = ?');
    params.push(updates.completedAt);
  }

  // 항상 last_active_at 갱신
  sets.push('last_active_at = ?');
  params.push(Date.now());

  if (sets.length === 0) return;

  params.push(id);
  database.prepare(`UPDATE agent_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

// ─── Activity CRUD ───

export interface LogActivityParams {
  sessionId: string;
  agentType: string;
  activityType: 'tool_use' | 'skill_invoke' | 'agent_spawn' | 'memory_update';
  toolName?: string;
  detail?: Record<string, unknown>;
  channelId?: string;
}

/** 활동 기록 추가 */
export function logActivity(params: LogActivityParams): AgentActivity {
  const database = initDatabase();
  const now = Date.now();

  const result = database.prepare(`
    INSERT INTO agent_activities (session_id, agent_type, activity_type, tool_name, detail, channel_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.sessionId,
    params.agentType,
    params.activityType,
    params.toolName ?? null,
    params.detail ? JSON.stringify(params.detail) : null,
    params.channelId ?? null,
    now,
  );

  return {
    id: Number(result.lastInsertRowid),
    sessionId: params.sessionId,
    agentType: params.agentType,
    activityType: params.activityType,
    toolName: params.toolName,
    detail: params.detail,
    channelId: params.channelId,
    createdAt: now,
  };
}

/** 세션의 활동 목록 조회 (시간순) */
export function getSessionActivities(sessionId: string): AgentActivity[] {
  const database = initDatabase();
  const rows = database.prepare(
    'SELECT * FROM agent_activities WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as AgentActivityRow[];
  return rows.map(rowToActivity);
}

/** 최근 활동 조회 (전체 세션, 최신순) */
export function getRecentActivities(limit = 50, offset = 0): AgentActivity[] {
  const database = initDatabase();
  const rows = database.prepare(
    'SELECT * FROM agent_activities ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as AgentActivityRow[];
  return rows.map(rowToActivity);
}
