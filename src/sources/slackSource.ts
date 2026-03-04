// SlackSource — Slack 이벤트 → EventBus 발행 (대시보드 미러링용)

import { v4 as uuidv4 } from 'uuid';
import { getEventBus } from '../events/eventBus.js';
import type { IncomingMessage } from '../events/types.js';

/** Slack 이벤트를 EventBus에 IncomingMessage로 발행 (대시보드 실시간 미러링) */
export function emitSlackIncoming(params: {
  text: string;
  userId: string;
  channelId: string;
  threadTs: string;
  isOwner: boolean;
  mode: 'channel' | 'thread' | 'dm';
  attachments?: IncomingMessage['attachments'];
  threadMessages?: IncomingMessage['threadMessages'];
}): void {
  const bus = getEventBus();
  const message: IncomingMessage = {
    id: uuidv4(),
    source: 'slack',
    ...params,
  };
  bus.emit('message:incoming', { source: 'slack', message });
}
