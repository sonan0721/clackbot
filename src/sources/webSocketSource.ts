// WebSocketSource — 대시보드 WebSocket 입력 → EventBus 발행

import { v4 as uuidv4 } from 'uuid';
import { getEventBus } from '../events/eventBus.js';
import type { IncomingMessage } from '../events/types.js';
import { logger } from '../utils/logger.js';

export interface WebChatMessage {
  type: 'chat:send';
  text: string;
  channelId?: string;
  threadTs?: string;
}

/** WebSocket 메시지 유효성 검증 */
function isValidChatMessage(data: unknown): data is WebChatMessage {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.type === 'chat:send' &&
    typeof obj.text === 'string' &&
    obj.text.length > 0 &&
    obj.text.length <= 10000 &&
    (obj.channelId === undefined || typeof obj.channelId === 'string') &&
    (obj.threadTs === undefined || typeof obj.threadTs === 'string')
  );
}

/** 대시보드 WebSocket 메시지를 파싱하여 EventBus에 IncomingMessage로 발행 */
export function handleWebSocketMessage(raw: unknown): void {
  if (!isValidChatMessage(raw)) {
    logger.warn('[WebSocketSource] 잘못된 메시지 형식 무시');
    return;
  }

  const bus = getEventBus();
  const message: IncomingMessage = {
    id: uuidv4(),
    source: 'web',
    text: raw.text,
    userId: 'owner',
    channelId: raw.channelId ?? 'web-direct',
    threadTs: raw.threadTs ?? `web-${Date.now()}`,
    isOwner: true,
    mode: 'dm',
  };

  logger.info(`[WebSocketSource] 대시보드 메시지 수신: ${raw.text.slice(0, 50)}`);
  bus.emit('message:incoming', { source: 'web', message });
}
