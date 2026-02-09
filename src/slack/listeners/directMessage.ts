import type { App } from '@slack/bolt';
import { loadConfig } from '../../config/index.js';
import { checkAccess } from '../middleware/accessControl.js';
import { downloadSlackFiles, cleanupFiles } from '../fileHandler.js';
import { handleMessage } from './handler.js';
import { logger } from '../../utils/logger.js';

// DM(Direct Message) 이벤트 처리

export function registerDirectMessage(app: App): void {
  app.event('message', async ({ event, say, client }) => {
    // unknown 캐스팅으로 이벤트 필드 접근
    const evt = event as unknown as Record<string, unknown>;

    // DM만 처리 (channel_type이 'im'인 경우)
    if (evt.channel_type !== 'im') return;

    // 봇 자신의 메시지 무시
    if (evt.bot_id) return;

    // subtype이 있는 메시지 무시 (편집, 삭제 등)
    if (evt.subtype) return;

    const userId = String(evt.user ?? '');
    const text = String(evt.text ?? '');
    const channelId = event.channel;
    const threadTs = String(evt.thread_ts ?? '') || String(evt.ts ?? '');

    if (!userId || !threadTs) return;

    // 파일만 보내고 텍스트가 없는 경우에도 처리할 수 있도록 텍스트 기본값 설정
    const files = evt.files as Array<{ name?: string; mimetype?: string; url_private_download?: string }> | undefined;
    const hasFiles = files && files.length > 0;
    const inputText = text.trim() || (hasFiles ? '첨부된 파일을 확인해주세요.' : '');

    if (!inputText) return;

    logger.debug(`DM 수신: ${userId}`);

    // 접근 제어 + Owner 판별
    const config = loadConfig();
    const { allowed, isOwner } = await checkAccess(userId, say);
    if (!allowed) return;

    // 파일 다운로드 처리
    let attachments;
    if (hasFiles && config.slack.botToken) {
      attachments = await downloadSlackFiles(files, config.slack.botToken);
    }

    // 스레드 컨텍스트 조회
    let threadMessages: Array<{ user: string; text: string }> = [];
    const originalThreadTs = String(evt.thread_ts ?? '');

    if (originalThreadTs) {
      try {
        const result = await client.conversations.replies({
          channel: channelId,
          ts: originalThreadTs,
          limit: 50,
        });
        const eventTs = String(evt.ts ?? '');
        threadMessages = (result.messages ?? [])
          .filter(m => m.ts !== eventTs)
          .map(m => ({
            user: m.user ?? 'unknown',
            text: m.text ?? '',
          }));
      } catch (error) {
        logger.warn(`스레드 컨텍스트 조회 실패: ${error}`);
      }
    }

    // 메시지 처리
    try {
      await handleMessage({
        inputText,
        userId,
        channelId,
        threadTs,
        threadMessages,
        say,
        client,
        isOwner,
        attachments,
        context: 'dm',
      });
    } finally {
      // 다운로드된 파일 정리
      if (attachments) {
        cleanupFiles(attachments);
      }
    }
  });
}
