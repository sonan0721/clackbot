import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig } from '../config/index.js';
import { APP_VERSION } from '../config/paths.js';
import { logger } from '../utils/logger.js';
import { setupWebSocket } from './ws.js';
import { setupMessageHandler } from '../events/messageHandler.js';
import toolsRouter from './api/tools.js';
import conversationsRouter from './api/conversations.js';
import configRouter from './api/config.js';
import pluginsRouter from './api/plugins.js';
import slackRouter from './api/slack.js';
import memoryRouter from './api/memory.js';
import projectsRouter from './api/projects.js';
import sessionsRouter from './api/sessions.js';
import activitiesRouter from './api/activities.js';
import agentsRouter from './api/agents.js';

import type { Request, Response, NextFunction } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 대시보드 토큰 확보 (없으면 자동 생성) */
function ensureDashboardToken(): string {
  const config = loadConfig();
  if (config.dashboardToken) return config.dashboardToken;

  const token = crypto.randomBytes(32).toString('hex');
  config.dashboardToken = token;
  saveConfig(config);
  return token;
}

// Express 웹 대시보드 서버

export function createWebServer() {
  const app = express();
  const dashboardToken = ensureDashboardToken();

  // JSON 파싱
  app.use(express.json());

  // CORS — localhost만 허용
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // API 인증 미들웨어 — Bearer token 검증
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${dashboardToken}`) {
      next();
      return;
    }
    res.status(401).json({ error: '인증이 필요합니다.' });
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
  app.use('/api/memory', memoryRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/agents', agentsRouter);

  // 정적 파일 서빙 (Vite 빌드 출력)
  const publicDir = path.resolve(__dirname, 'public');
  app.use(express.static(publicDir));

  // SPA 라우팅 — index.html에 토큰 주입
  app.get('*', (_req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    try {
      let html = fs.readFileSync(indexPath, 'utf-8');
      // <head> 직후에 토큰 스크립트 주입
      html = html.replace(
        '<head>',
        `<head><script>window.__DASHBOARD_TOKEN__="${dashboardToken}";</script>`,
      );
      res.type('html').send(html);
    } catch {
      res.sendFile(indexPath);
    }
  });

  return app;
}

/** 웹 서버 시작 */
export function startWebServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const app = createWebServer();
    const token = ensureDashboardToken();

    const server = app.listen(port, () => {
      setupWebSocket(server);
      setupMessageHandler();
      logger.success(`웹 대시보드: http://localhost:${port}`);
      logger.info(`대시보드 인증 토큰: ${token.slice(0, 8)}...`);
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
