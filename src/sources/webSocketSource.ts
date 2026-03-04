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

/** 대시보드 WebSocket 메시지를 파싱하여 EventBus에 IncomingMessage로 발행 */
export function handleWebSocketMessage(raw: unknown): void {
  const data = raw as WebChatMessage;
  if (data.type !== 'chat:send' || !data.text) return;

  const bus = getEventBus();
  const message: IncomingMessage = {
    id: uuidv4(),
    source: 'web',
    text: data.text,
    userId: 'owner',
    channelId: data.channelId ?? 'web-direct',
    threadTs: data.threadTs ?? `web-${Date.now()}`,
    isOwner: true,
    mode: 'dm',
  };

  logger.info(`[WebSocketSource] 대시보드 메시지 수신: ${data.text.slice(0, 50)}`);
  bus.emit('message:incoming', { source: 'web', message });
}
