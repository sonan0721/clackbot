import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/index.js';
import { APP_VERSION } from '../config/paths.js';
import { logger } from '../utils/logger.js';
import toolsRouter from './api/tools.js';
import conversationsRouter from './api/conversations.js';
import configRouter from './api/config.js';
import pluginsRouter from './api/plugins.js';
import slackRouter from './api/slack.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Express 웹 대시보드 서버

export function createWebServer() {
  const app = express();

  // JSON 파싱
  app.use(express.json());

  // CORS (로컬 개발용)
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // API 라우트
  app.get('/api/status', (_req, res) => {
    const config = loadConfig();
    res.json({
      online: true,
      version: APP_VERSION,
      botName: config.slack.botName || null,
      botUserId: config.slack.botUserId || null,
      teamName: config.slack.teamName || null,
      webPort: config.webPort,
    });
  });

  app.use('/api/tools', toolsRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/config', configRouter);
  app.use('/api/plugins', pluginsRouter);
  app.use('/api/slack', slackRouter);

  // 정적 파일 서빙 (Vite 빌드 출력)
  const publicDir = path.resolve(__dirname, 'public');
  app.use(express.static(publicDir));

  // SPA 라우팅 — 모든 경로에서 index.html 반환
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

/** 웹 서버 시작 */
export function startWebServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const app = createWebServer();

    const server = app.listen(port, () => {
      logger.success(`웹 대시보드: http://localhost:${port}`);
      resolve();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`포트 ${port}이 이미 사용 중입니다. --port 옵션으로 다른 포트를 지정하세요.`);
      }
      reject(err);
    });
  });
}
