import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { getLocalDir } from '../../config/paths.js';
import { Supervisor, type SupervisorEvent } from '../../agent/supervisor.js';
import {
  saveSupervisorSession,
  updateSupervisorSession,
  deleteSupervisorSession,
  getSupervisorSessions,
  saveSupervisorMessage,
  getSupervisorMessages,
} from '../../store/conversations.js';
import { logger } from '../../utils/logger.js';

// SSE + 다중 세션 + 파일 편집 API — 슈퍼바이저

const router = Router();

// ─── 다중 세션 관리 ───

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: string
}

interface SupervisorSession {
  id: string
  title: string
  messages: ChatMessage[]
  supervisor: Supervisor
  createdAt: string
  updatedAt: string
  sseClients: Set<Response>
}

const sessions = new Map<string, SupervisorSession>();
let sessionCounter = 0;

interface CreateSessionOptions {
  id?: string;
  title?: string;
  messages?: ChatMessage[];
  createdAt?: string;
  updatedAt?: string;
  persistToDb?: boolean;
}

function createSession(opts: CreateSessionOptions = {}): SupervisorSession {
  const id = opts.id ?? `sv-${++sessionCounter}-${Date.now()}`;
  const now = new Date().toISOString();
  const session: SupervisorSession = {
    id,
    title: opts.title ?? '새 대화',
    messages: opts.messages ?? [],
    supervisor: new Supervisor(),
    createdAt: opts.createdAt ?? now,
    updatedAt: opts.updatedAt ?? now,
    sseClients: new Set(),
  };

  // 이벤트 포워딩
  session.supervisor.on('event', (event: SupervisorEvent) => {
    // 메시지 저장
    if (event.type === 'text') {
      const msg: ChatMessage = {
        role: 'assistant',
        content: event.data,
        timestamp: new Date().toISOString(),
      };
      session.messages.push(msg);
      saveSupervisorMessage(session.id, msg.role, msg.content, msg.timestamp);
    } else if (event.type === 'tool_call') {
      const msg: ChatMessage = {
        role: 'tool',
        content: event.data,
        timestamp: new Date().toISOString(),
      };
      session.messages.push(msg);
      saveSupervisorMessage(session.id, msg.role, msg.content, msg.timestamp);
    }
    session.updatedAt = new Date().toISOString();
    updateSupervisorSession(session.id, { updatedAt: session.updatedAt });

    // SSE 브로드캐스트
    const data = JSON.stringify(event);
    for (const client of session.sseClients) {
      client.write(`data: ${data}\n\n`);
    }

    // CLAUDE.md 변경 감지 — 모든 세션의 클라이언트에 알림
    if (event.type === 'file_changed') {
      broadcastAll(event);
    }
  });

  // DB에 세션 저장 (복원 시에는 이미 DB에 있으므로 skip)
  if (opts.persistToDb !== false) {
    saveSupervisorSession(id, session.title);
  }

  sessions.set(id, session);
  return session;
}

/** 서버 시작 시 DB에서 세션 복원 */
export function initSupervisorSessions(): void {
  const dbSessions = getSupervisorSessions();
  for (const s of dbSessions) {
    const messages = getSupervisorMessages(s.id);
    createSession({
      id: s.id,
      title: s.title,
      messages,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      persistToDb: false,
    });
  }
  logger.info(`슈퍼바이저 세션 ${dbSessions.length}개 DB에서 복원`);
}

/** 모든 세션의 모든 클라이언트에 이벤트 전송 */
function broadcastAll(event: SupervisorEvent): void {
  const data = JSON.stringify(event);
  for (const session of sessions.values()) {
    for (const client of session.sseClients) {
      client.write(`data: ${data}\n\n`);
    }
  }
}

// ─── 세션 API ───

// GET /api/supervisor/sessions — 세션 목록
router.get('/sessions', (_req: Request, res: Response) => {
  const list = Array.from(sessions.values()).map(s => ({
    id: s.id,
    title: s.title,
    messageCount: s.messages.length,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
  // 최신 순 정렬
  list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json({ sessions: list });
});

// POST /api/supervisor/sessions — 새 세션 생성
router.post('/sessions', (_req: Request, res: Response) => {
  const session = createSession();
  res.json({ id: session.id });
});

// DELETE /api/supervisor/sessions/:id — 세션 삭제
router.delete('/sessions/:id', (req: Request, res: Response) => {
  const session = sessions.get(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    return;
  }

  // SSE 클라이언트 정리
  for (const client of session.sseClients) {
    client.end();
  }
  sessions.delete(req.params.id as string);
  deleteSupervisorSession(req.params.id as string);
  res.json({ status: 'ok' });
});

// GET /api/supervisor/sessions/:id/events — 세션별 SSE 스트림
router.get('/sessions/:id/events', (req: Request, res: Response) => {
  const session = sessions.get(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', data: '' })}\n\n`);

  session.sseClients.add(res);

  req.on('close', () => {
    session.sseClients.delete(res);
  });
});

// POST /api/supervisor/sessions/:id/send — 메시지 전송
router.post('/sessions/:id/send', async (req: Request, res: Response) => {
  const session = sessions.get(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    return;
  }

  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: '메시지가 필요합니다.' });
    return;
  }

  // 제목 자동 설정 (첫 메시지)
  if (session.messages.length === 0) {
    session.title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
    updateSupervisorSession(session.id, { title: session.title });
  }

  // 사용자 메시지 저장
  const userMsg: ChatMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(userMsg);
  session.updatedAt = new Date().toISOString();
  saveSupervisorMessage(session.id, userMsg.role, userMsg.content, userMsg.timestamp);
  updateSupervisorSession(session.id, { updatedAt: session.updatedAt });

  // 사용자 입력 SSE echo
  const echoData = JSON.stringify({ type: 'text', data: `\n> ${message}\n` });
  for (const client of session.sseClients) {
    client.write(`data: ${echoData}\n\n`);
  }

  res.json({ status: 'ok' });

  // 에이전트 호출 (백그라운드)
  session.supervisor.send(message).catch((err) => {
    const errEvent: SupervisorEvent = {
      type: 'error',
      data: err instanceof Error ? err.message : String(err),
    };
    const errData = JSON.stringify(errEvent);
    for (const client of session.sseClients) {
      client.write(`data: ${errData}\n\n`);
    }
  });
});

// GET /api/supervisor/sessions/:id/messages — 메시지 히스토리
router.get('/sessions/:id/messages', (req: Request, res: Response) => {
  const session = sessions.get(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    return;
  }
  res.json({ messages: session.messages });
});

// ─── 파일 편집 엔드포인트 (CLAUDE.md만) ───

const ALLOWED_FILES: Record<string, string> = {
  'claude-md': 'CLAUDE.md',
};

function resolveFilePath(slug: string): string | null {
  const relativePath = ALLOWED_FILES[slug];
  if (!relativePath) return null;
  return path.resolve(getLocalDir(), relativePath);
}

// GET /api/supervisor/files — 파일 목록
router.get('/files', (_req: Request, res: Response) => {
  const files = Object.entries(ALLOWED_FILES).map(([slug, relativePath]) => {
    const fullPath = path.resolve(getLocalDir(), relativePath);
    return {
      slug,
      path: relativePath,
      exists: fs.existsSync(fullPath),
    };
  });
  res.json({ files });
});

// GET /api/supervisor/files/:slug — 파일 읽기
router.get('/files/:slug', (req: Request, res: Response) => {
  const fullPath = resolveFilePath(req.params.slug as string);
  if (!fullPath) {
    res.status(404).json({ error: '허용되지 않은 파일입니다.' });
    return;
  }

  if (!fs.existsSync(fullPath)) {
    res.json({ content: '', exists: false });
    return;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ content, exists: true });
  } catch {
    res.status(500).json({ error: '파일 읽기 실패' });
  }
});

// PUT /api/supervisor/files/:slug — 파일 저장
router.put('/files/:slug', (req: Request, res: Response) => {
  const fullPath = resolveFilePath(req.params.slug as string);
  if (!fullPath) {
    res.status(404).json({ error: '허용되지 않은 파일입니다.' });
    return;
  }

  const { content } = req.body;
  if (typeof content !== 'string') {
    res.status(400).json({ error: 'content(문자열)가 필요합니다.' });
    return;
  }

  try {
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ message: '파일이 저장되었습니다.' });
  } catch {
    res.status(500).json({ error: '파일 저장 실패' });
  }
});

export default router;
