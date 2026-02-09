import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { getLocalDir, getRulesDir } from '../../config/paths.js';
import { Supervisor, type SupervisorEvent } from '../../agent/supervisor.js';

// SSE + 사용자 입력 + 파일 편집 API — 슈퍼바이저 콘솔

const router = Router();

// 싱글턴 슈퍼바이저 에이전트
let supervisor: Supervisor | null = null;

// SSE 클라이언트 목록
const sseClients: Set<Response> = new Set();

// 규칙 파일 slug → .clackbot/ 내 상대 경로 매핑
const ALLOWED_FILES: Record<string, string> = {
  'claude-md': 'CLAUDE.md',
  'rules-md': 'rules.md',
};

function getSupervisor(): Supervisor {
  if (!supervisor) {
    supervisor = new Supervisor();
    supervisor.on('event', (event: SupervisorEvent) => {
      broadcast(event);
    });
  }
  return supervisor;
}

function broadcast(event: SupervisorEvent): void {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

// ─── 콘솔 엔드포인트 ───

// GET /api/supervisor/events — SSE 스트림
router.get('/events', (_req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // 초기 연결 확인
  res.write(`data: ${JSON.stringify({ type: 'connected', data: '' })}\n\n`);

  sseClients.add(res);

  _req.on('close', () => {
    sseClients.delete(res);
  });
});

// POST /api/supervisor/send — 메시지 전송
router.post('/send', async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: '메시지가 필요합니다.' });
    return;
  }

  const sv = getSupervisor();

  // 사용자 입력을 SSE로 echo
  broadcast({ type: 'text', data: `\n> ${message}\n` });

  // 비동기로 에이전트 실행 (SSE로 스트리밍)
  res.json({ status: 'ok' });

  // 에이전트 호출 (백그라운드)
  sv.send(message).catch((err) => {
    broadcast({ type: 'error', data: err instanceof Error ? err.message : String(err) });
  });
});

// POST /api/supervisor/reset — 세션 리셋
router.post('/reset', (_req: Request, res: Response) => {
  if (supervisor) {
    supervisor.reset();
  }
  res.json({ status: 'ok' });
});

// ─── 파일 편집 엔드포인트 ───

function resolveFilePath(slug: string): string | null {
  const relativePath = ALLOWED_FILES[slug];
  if (!relativePath) return null;
  return path.resolve(getLocalDir(), relativePath);
}

// GET /api/supervisor/files — 규칙 파일 목록 및 존재 여부
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

// GET /api/supervisor/files/:slug — 파일 내용 읽기
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
  } catch (error) {
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
    // 부모 디렉토리 자동 생성
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ message: '파일이 저장되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '파일 저장 실패' });
  }
});

// ─── rules/ 폴더 관리 엔드포인트 ───

/** 디렉토리에서 .md 파일 재귀 탐색 */
function scanMdFiles(dir: string, base: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanMdFiles(fullPath, base));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(path.relative(base, fullPath));
      }
    }
  } catch {
    // 읽기 실패 시 무시
  }
  return results.sort();
}

/** filename 인코딩: `/` → `--` (path traversal 방지) */
function decodeRulesFilename(encoded: string): string | null {
  // `--`를 `/`로 변환
  const decoded = encoded.replace(/--/g, '/');
  // path traversal 방지
  if (decoded.includes('..') || decoded.startsWith('/')) return null;
  // .md 확장자 강제
  if (!decoded.endsWith('.md')) return null;
  return decoded;
}

function resolveRulesPath(filename: string): string | null {
  const decoded = decodeRulesFilename(filename);
  if (!decoded) return null;
  const rulesDir = getRulesDir();
  const resolved = path.resolve(rulesDir, decoded);
  // rules/ 디렉토리 내에 있는지 검증
  if (!resolved.startsWith(path.resolve(rulesDir))) return null;
  return resolved;
}

// GET /api/supervisor/rules — rules/ 내 .md 파일 목록
router.get('/rules', (_req: Request, res: Response) => {
  const rulesDir = getRulesDir();
  const files = scanMdFiles(rulesDir, rulesDir);
  res.json({
    files: files.map(f => ({
      filename: f.replace(/\//g, '--'),
      path: f,
    })),
  });
});

// GET /api/supervisor/rules/:filename — 규칙 파일 내용 읽기
router.get('/rules/:filename', (req: Request, res: Response) => {
  const fullPath = resolveRulesPath(req.params.filename as string);
  if (!fullPath) {
    res.status(400).json({ error: '잘못된 파일 경로입니다.' });
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

// PUT /api/supervisor/rules/:filename — 규칙 파일 저장 (없으면 생성)
router.put('/rules/:filename', (req: Request, res: Response) => {
  const fullPath = resolveRulesPath(req.params.filename as string);
  if (!fullPath) {
    res.status(400).json({ error: '잘못된 파일 경로입니다.' });
    return;
  }

  const { content } = req.body;
  if (typeof content !== 'string') {
    res.status(400).json({ error: 'content(문자열)가 필요합니다.' });
    return;
  }

  try {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ message: '파일이 저장되었습니다.' });
  } catch {
    res.status(500).json({ error: '파일 저장 실패' });
  }
});

// DELETE /api/supervisor/rules/:filename — 규칙 파일 삭제
router.delete('/rules/:filename', (req: Request, res: Response) => {
  const fullPath = resolveRulesPath(req.params.filename as string);
  if (!fullPath) {
    res.status(400).json({ error: '잘못된 파일 경로입니다.' });
    return;
  }

  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: '파일이 존재하지 않습니다.' });
    return;
  }

  try {
    fs.unlinkSync(fullPath);
    res.json({ message: '파일이 삭제되었습니다.' });
  } catch {
    res.status(500).json({ error: '파일 삭제 실패' });
  }
});

export default router;
