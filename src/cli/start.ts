import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import { loadConfig } from '../config/index.js';
import { getLocalDir, getEnvPath } from '../config/paths.js';
import { createSlackApp, startSlackApp } from '../slack/app.js';
import { startWebServer } from '../web/server.js';
import { initDatabase, closeDatabase } from '../store/conversations.js';
import { setSlackClient } from '../agent/tools/builtin/slackPost.js';
import { sessionManager } from '../session/manager.js';
import { logger } from '../utils/logger.js';

// clackbot start — Slack 봇 + 웹 대시보드 동시 기동

interface StartOptions {
  web?: boolean;
  port?: string;
}

export async function startCommand(options: StartOptions): Promise<void> {
  const cwd = process.cwd();

  // .clackbot/ 존재 확인
  if (!fs.existsSync(getLocalDir(cwd))) {
    logger.error('.clackbot/ 디렉토리가 없습니다. 먼저 clackbot init을 실행하세요.');
    process.exit(1);
  }

  // Claude Code 설치 확인
  try {
    const version = execFileSync('claude', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    logger.success(`Claude Code 확인: ${version}`);
  } catch {
    logger.error('Claude Code가 설치되어 있지 않습니다.');
    logger.detail('설치: npm install -g @anthropic-ai/claude-code');
    process.exit(1);
  }

  // Claude Code 로그인 확인
  try {
    execFileSync('claude', ['-p', 'ping', '--max-turns', '1'], {
      encoding: 'utf-8',
      timeout: 30000,
    });
  } catch {
    logger.error('Claude Code에 로그인되어 있지 않습니다.');
    logger.detail('로그인: claude login');
    process.exit(1);
  }

  // .env 로드
  const envPath = getEnvPath(cwd);
  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath });
  }

  // 설정 로드
  const config = loadConfig(cwd);

  // 토큰 확인
  const botToken = config.slack.botToken || process.env.SLACK_BOT_TOKEN;
  const appToken = config.slack.appToken || process.env.SLACK_APP_TOKEN;

  if (!botToken || !appToken) {
    logger.error('Slack 토큰이 설정되지 않았습니다.');
    logger.detail('clackbot login을 실행하거나 .env 파일에 토큰을 설정하세요.');
    process.exit(1);
  }

  logger.info('Clackbot을 시작합니다...');
  logger.blank();

  // 대화 DB 초기화
  initDatabase(cwd);

  try {
    // Slack 앱 생성 및 시작
    const app = createSlackApp({ botToken, appToken });

    // Slack 클라이언트를 내장 도구에 주입
    setSlackClient(app.client as unknown as Parameters<typeof setSlackClient>[0]);

    await startSlackApp(app);

    // 웹 대시보드 시작 (--no-web 옵션이 아닌 경우)
    const enableWeb = options.web !== false;
    if (enableWeb) {
      const port = parseInt(options.port || String(config.webPort), 10);
      await startWebServer(port);
    }

    const botName = config.slack.botName || 'clackbot';
    logger.blank();
    logger.success(`봇 이름: @${botName} | 접근 모드: ${config.accessMode}`);
    if (enableWeb) {
      const port = parseInt(options.port || String(config.webPort), 10);
      logger.success(`대시보드: http://localhost:${port}`);
    }
    logger.blank();
    logger.info('종료하려면 Ctrl+C를 누르세요.');

    // Graceful shutdown
    const shutdown = async () => {
      logger.blank();
      logger.info('Clackbot을 종료합니다...');

      try {
        await app.stop();
        closeDatabase();
        sessionManager.clear();
        logger.success('정상 종료되었습니다.');
      } catch (error) {
        logger.error(`종료 중 오류: ${error instanceof Error ? error.message : String(error)}`);
      }

      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error(`시작 실패: ${error instanceof Error ? error.message : String(error)}`);
    closeDatabase();
    process.exit(1);
  }
}
