import type { App } from '@slack/bolt';
import { loadConfig } from '../../config/index.js';
import { checkAccess } from '../middleware/accessControl.js';
import { stripBotMention } from '../../utils/slackFormat.js';
import { downloadSlackFiles, cleanupFiles } from '../fileHandler.js';
import { handleMessage } from './handler.js';
import { logger } from '../../utils/logger.js';

// @봇이름 멘션 이벤트 처리

export function registerAppMention(app: App): void {
  app.event('app_mention', async ({ event, say, client }) => {
    const config = loadConfig();
    const botUserId = config.slack.botUserId || '';
    const userId = event.user ?? '';

    if (!userId) return;

    logger.debug(`멘션 수신: ${userId} in ${event.channel}`);

    // 접근 제어 + Owner 판별
    const threadTs = event.thread_ts || event.ts;
    const { allowed, isOwner } = await checkAccess(userId, say, threadTs);
    if (!allowed) return;

    // 봇 멘션 태그 제거 후 입력 텍스트 추출
    const inputText = stripBotMention(event.text ?? '', botUserId);

    if (!inputText.trim()) {
      await say({ text: '무엇을 도와드릴까요?', thread_ts: threadTs });
      return;
    }

    // 스레드 컨텍스트 조회
    let threadMessages: Array<{ user: string; text: string }> = [];

    if (event.thread_ts) {
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

    // 비Owner의 채널 최상위 멘션 → 채널에 직접 응답
    const replyInChannel = !isOwner && !event.thread_ts;

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
        replyInChannel,
        attachments,
        context: 'mention',
      });
    } finally {
      if (attachments) {
        cleanupFiles(attachments);
      }
    }
  });
}
