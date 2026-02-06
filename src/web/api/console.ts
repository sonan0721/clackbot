import { Router, type Request, type Response } from 'express';
import { PluginInstaller, type InstallerEvent } from '../../agent/installer.js';

// SSE + 사용자 입력 API — 플러그인 설치 콘솔

const router = Router();

// 싱글턴 설치 에이전트
let installer: PluginInstaller | null = null;

// SSE 클라이언트 목록
const sseClients: Set<Response> = new Set();

function getInstaller(): PluginInstaller {
  if (!installer) {
    installer = new PluginInstaller();
    installer.on('event', (event: InstallerEvent) => {
      broadcast(event);
    });
  }
  return installer;
}

function broadcast(event: InstallerEvent): void {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

// GET /api/console/events — SSE 스트림
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

// POST /api/console/send — 사용자 입력
router.post('/send', async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: '메시지가 필요합니다.' });
    return;
  }

  const inst = getInstaller();

  // 사용자 입력을 SSE로 echo
  broadcast({ type: 'text', data: `\n> ${message}\n` });

  // 비동기로 에이전트 실행 (SSE로 스트리밍)
  res.json({ status: 'ok' });

  // 에이전트 호출 (백그라운드)
  inst.send(message).catch((err) => {
    broadcast({ type: 'error', data: err instanceof Error ? err.message : String(err) });
  });
});

// POST /api/console/reset — 세션 리셋
router.post('/reset', (_req: Request, res: Response) => {
  if (installer) {
    installer.reset();
  }
  res.json({ status: 'ok' });
});

export default router;
