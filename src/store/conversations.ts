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
  projectId?: string;
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
    record.projectId ?? null,
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
  projectId: string | null;
  createdAt: string;
}

/** 대화 이력 조회 (페이지네이션) */
export function getConversations(options: {
  channelId?: string;
  limit?: number;
  offset?: number;
  search?: string;
}): { items: ConversationListItem[]; total: number } {
  const database = initDatabase();
  const { channelId, limit = 50, offset = 0, search } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (channelId) {
    conditions.push('channel_id = ?');
    params.push(channelId);
  }

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
    projectId: row.project_id,
    createdAt: row.created_at,
  }));

  return { items, total };
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
    projectId: row.project_id,
    createdAt: row.created_at,
  };
}
