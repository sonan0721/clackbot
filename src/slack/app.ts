import { App, LogLevel } from '@slack/bolt';
import { loadConfig } from '../config/index.js';
import { registerListeners } from './listeners/index.js';
import { logger } from '../utils/logger.js';

// Bolt App 팩토리 — Socket Mode로 Slack 연결

export interface SlackAppOptions {
  botToken: string;
  appToken: string;
}

export function createSlackApp(options: SlackAppOptions): App {
  const app = new App({
    token: options.botToken,
    appToken: options.appToken,
    socketMode: true,
    logLevel: process.env.DEBUG ? LogLevel.DEBUG : LogLevel.INFO,
  });

  // 이벤트 리스너 등록
  registerListeners(app);

  return app;
}

/** Slack 앱 시작 */
export async function startSlackApp(app: App): Promise<void> {
  await app.start();
  const config = loadConfig();
  const botName = config.slack.botName || 'clackbot';
  logger.success(`Slack 봇이 시작되었습니다: @${botName}`);
}
