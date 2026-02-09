import type { App } from '@slack/bolt';
import { loadConfig } from '../../config/index.js';
import { checkAccess } from '../middleware/accessControl.js';
import { stripBotMention } from '../../utils/slackFormat.js';
import { downloadSlackFiles, cleanupFiles } from '../fileHandler.js';
import { handleMessage, type ConversationMode } from './handler.js';
import { logger } from '../../utils/logger.js';

// @봇이름 멘션 이벤트 처리

export function registerAppMention(app: App): void {
  app.event('app_mention', async ({ event, say, client }) => {
    const config = loadConfig();
    const botUserId = config.slack.botUserId || '';
    const userId = event.user ?? '';

    if (!userId) return;

    logger.debug(`멘션 수신: ${userId} in ${event.channel}`);

    // 대화 모드 결정: 스레드 내 멘션 → thread, 채널 top-level 멘션 → channel
    const mode: ConversationMode = event.thread_ts ? 'thread' : 'channel';
    const threadTs = event.thread_ts || event.ts;

    // 접근 제어 + Owner 판별
    const { allowed, isOwner } = await checkAccess(userId, say, threadTs);
    if (!allowed) return;

    // 봇 멘션 태그 제거 후 입력 텍스트 추출
    const inputText = stripBotMention(event.text ?? '', botUserId);

    if (!inputText.trim()) {
      if (mode === 'channel') {
        await say({ text: '무엇을 도와드릴까요?' });
      } else {
        await say({ text: '무엇을 도와드릴까요?', thread_ts: threadTs });
      }
      return;
    }

    // 스레드 컨텍스트 조회 (channel 모드는 1회성 → 스킵)
    let threadMessages: Array<{ user: string; text: string }> = [];

    if (mode === 'thread' && event.thread_ts) {
      try {
        const result = await client.conversations.replies({
          channel: event.channel,
          ts: event.thread_ts,
          limit: 50,
        });
        threadMessages = (result.messages ?? [])
          .filter(m => m.ts !== event.ts)
          .map(m => ({
            user: m.user ?? 'unknown',
            text: m.text ?? '',
          }));
      } catch (error) {
        logger.warn(`스레드 컨텍스트 조회 실패: ${error}`);
      }
    }

    // 파일 다운로드 처리
    const evt = event as unknown as Record<string, unknown>;
    const files = evt.files as Array<{ name?: string; mimetype?: string; url_private_download?: string }> | undefined;
    let attachments;
    if (files && files.length > 0 && config.slack.botToken) {
      attachments = await downloadSlackFiles(files, config.slack.botToken);
    }

    // 메시지 처리
    try {
      await handleMessage({
        inputText,
        userId,
        channelId: event.channel,
        threadTs,
        threadMessages,
        say,
        client,
        isOwner,
        mode,
        attachments,
      });
    } finally {
      if (attachments) {
        cleanupFiles(attachments);
      }
    }
  });
}
