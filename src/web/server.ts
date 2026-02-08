import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import toolsRouter from './api/tools.js';
import conversationsRouter from './api/conversations.js';
import configRouter from './api/config.js';
import consoleRouter from './api/console.js';
import supervisorRouter from './api/supervisor.js';
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
      botName: config.slack.botName || null,
      botUserId: config.slack.botUserId || null,
      teamName: config.slack.teamName || null,
      accessMode: config.accessMode,
      replyMode: config.replyMode,
      webPort: config.webPort,
    });
  });

  app.use('/api/tools', toolsRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/config', configRouter);
  app.use('/api/console', consoleRouter);
  app.use('/api/supervisor', supervisorRouter);
  app.use('/api/plugins', pluginsRouter);
  app.use('/api/slack', slackRouter);

  // 정적 파일 서빙 (대시보드 프론트엔드) — 캐시 비활성화
  const publicDir = path.resolve(__dirname, 'public');
  app.use(express.static(publicDir, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    },
  }));

  // SPA 라우팅 — index.html에 cache-busting 쿼리 주입
  const startTime = Date.now();
  app.get('*', (_req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8')
      .replace('/style.css', `/style.css?v=${startTime}`)
      .replace('/app.js', `/app.js?v=${startTime}`);
    res.type('html').send(html);
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
