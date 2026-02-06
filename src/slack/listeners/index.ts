import type { App } from '@slack/bolt';
import { registerAppMention } from './appMention.js';
import { registerDirectMessage } from './directMessage.js';

// 모든 Slack 이벤트 리스너 등록
export function registerListeners(app: App): void {
  registerAppMention(app);
  registerDirectMessage(app);
}
