import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDbPath } from '../config/paths.js';
import { logger } from '../utils/logger.js';

// 대화 이력 저장/조회 (SQLite)

let db: Database.Database | null = null;

/** DB 초기화 */
export function initDatabase(cwd?: string): Database.Database {
  if (db) return db;

  const dbPath = getDbPath(cwd);
  db = new Database(dbPath);

  // WAL 모드 (성능 향상)
  db.pragma('journal_mode = WAL');

  // 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      thread_ts TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      input_text TEXT NOT NULL,
      output_text TEXT,
      tools_used TEXT,
      project_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 인덱스
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_thread ON conversations(thread_ts);
    CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
  `);

  logger.debug(`대화 DB 초기화: ${dbPath}`);
  return db;
}

/** DB 연결 닫기 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export interface ConversationRecord {
  channelId: string;
  threadTs: string;
  userId: string;
  userName?: string;
  inputText: string;
  outputText?: string;
  toolsUsed?: string[];
}

/** 대화 기록 저장 */
export function saveConversation(record: ConversationRecord): string {
  const database = initDatabase();
  const id = uuidv4();

  const stmt = database.prepare(`
    INSERT INTO conversations (id, channel_id, thread_ts, user_id, user_name, input_text, output_text, tools_used, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    record.channelId,
    record.threadTs,
    record.userId,
    record.userName ?? null,
    record.inputText,
    record.outputText ?? null,
    record.toolsUsed ? JSON.stringify(record.toolsUsed) : null,
    null,
  );

  return id;
}

export interface ConversationListItem {
  id: string;
  channelId: string;
  threadTs: string;
  userId: string;
  userName: string | null;
  inputText: string;
  outputText: string | null;
  toolsUsed: string[];
  createdAt: string;
}

/** 대화 이력 조회 (페이지네이션) */
export function getConversations(options: {
  limit?: number;
  offset?: number;
  search?: string;
}): { items: ConversationListItem[]; total: number } {
  const database = initDatabase();
  const { limit = 50, offset = 0, search } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push('(input_text LIKE ? OR output_text LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 전체 개수
  const countRow = database.prepare(`SELECT COUNT(*) as count FROM conversations ${where}`).get(...params) as { count: number };
  const total = countRow.count;

  // 데이터 조회
  const rows = database.prepare(
    `SELECT * FROM conversations ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as Array<{
    id: string;
    channel_id: string;
    thread_ts: string;
    user_id: string;
    user_name: string | null;
    input_text: string;
    output_text: string | null;
    tools_used: string | null;
    project_id: string | null;
    created_at: string;
  }>;

  const items: ConversationListItem[] = rows.map(row => ({
    id: row.id,
    channelId: row.channel_id,
    threadTs: row.thread_ts,
    userId: row.user_id,
    userName: row.user_name,
    inputText: row.input_text,
    outputText: row.output_text,
    toolsUsed: row.tools_used ? JSON.parse(row.tools_used) : [],
    createdAt: row.created_at,
  }));

  return { items, total };
}

// 세션(스레드) 요약 타입
export interface SessionSummary {
  threadTs: string;
  channelId: string;
  userId: string;
  firstMessage: string;
  messageCount: number;
  firstAt: string;
  lastAt: string;
}

/** 세션(스레드) 목록 조회 — thread_ts로 그룹핑 */
export function getConversationSessions(options: {
  limit?: number;
  offset?: number;
  search?: string;
}): { sessions: SessionSummary[]; total: number } {
  const database = initDatabase();
  const { limit = 20, offset = 0, search } = options;

  // 검색 조건이 있으면 해당 thread_ts만 필터
  let threadFilter = '';
  const params: unknown[] = [];

  if (search) {
    threadFilter = `WHERE thread_ts IN (
      SELECT DISTINCT thread_ts FROM conversations
      WHERE input_text LIKE ? OR output_text LIKE ?
    )`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }

  // 전체 세션 수
  const countRow = database.prepare(
    `SELECT COUNT(DISTINCT thread_ts) as count FROM conversations ${
      search ? 'WHERE input_text LIKE ? OR output_text LIKE ?' : ''
    }`
  ).get(...(search ? [`%${search}%`, `%${search}%`] : [])) as { count: number };
  const total = countRow.count;

  // 세션 목록
  const rows = database.prepare(`
    SELECT thread_ts, channel_id, user_id,
           MIN(input_text) as first_message,
           COUNT(*) as message_count,
           MIN(created_at) as first_at,
           MAX(created_at) as last_at
    FROM conversations
    ${threadFilter}
    GROUP BY thread_ts
    ORDER BY last_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<{
    thread_ts: string;
    channel_id: string;
    user_id: string;
    first_message: string;
    message_count: number;
    first_at: string;
    last_at: string;
  }>;

  const sessions: SessionSummary[] = rows.map(row => ({
    threadTs: row.thread_ts,
    channelId: row.channel_id,
    userId: row.user_id,
    firstMessage: row.first_message,
    messageCount: row.message_count,
    firstAt: row.first_at,
    lastAt: row.last_at,
  }));

  return { sessions, total };
}

/** 특정 세션의 모든 메시지 조회 */
export function getSessionMessages(threadTs: string): ConversationListItem[] {
  const database = initDatabase();

  const rows = database.prepare(
    `SELECT * FROM conversations WHERE thread_ts = ? ORDER BY created_at ASC`
  ).all(threadTs) as Array<{
    id: string;
    channel_id: string;
    thread_ts: string;
    user_id: string;
    user_name: string | null;
    input_text: string;
    output_text: string | null;
    tools_used: string | null;
    project_id: string | null;
    created_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    channelId: row.channel_id,
    threadTs: row.thread_ts,
    userId: row.user_id,
    userName: row.user_name,
    inputText: row.input_text,
    outputText: row.output_text,
    toolsUsed: row.tools_used ? JSON.parse(row.tools_used) : [],
    createdAt: row.created_at,
  }));
}

/** 단일 대화 조회 */
export function getConversation(id: string): ConversationListItem | null {
  const database = initDatabase();

  const row = database.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as {
    id: string;
    channel_id: string;
    thread_ts: string;
    user_id: string;
    user_name: string | null;
    input_text: string;
    output_text: string | null;
    tools_used: string | null;
    project_id: string | null;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    channelId: row.channel_id,
    threadTs: row.thread_ts,
    userId: row.user_id,
    userName: row.user_name,
    inputText: row.input_text,
    outputText: row.output_text,
    toolsUsed: row.tools_used ? JSON.parse(row.tools_used) : [],
    createdAt: row.created_at,
  };
}
