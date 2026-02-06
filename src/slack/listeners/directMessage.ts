import type { App } from '@slack/bolt';
import { checkAccess } from '../middleware/accessControl.js';
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

    if (!userId || !text.trim() || !threadTs) return;

    logger.debug(`DM 수신: ${userId}`);

    // 접근 제어
    const allowed = await checkAccess(userId, say);
    if (!allowed) return;

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
    await handleMessage({
      inputText: text,
      userId,
      channelId,
      threadTs,
      threadMessages,
      say,
    });
  });
}
