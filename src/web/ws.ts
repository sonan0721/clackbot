// WebSocket 서버 — EventBus 이벤트를 클라이언트에 브로드캐스트

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { getEventBus } from '../events/eventBus.js';
import { handleWebSocketMessage } from '../sources/webSocketSource.js';
import { logger } from '../utils/logger.js';

let wss: WebSocketServer | null = null;

/** Express HTTP 서버에 WebSocket 서버를 연결 */
export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });
  const bus = getEventBus();

  wss.on('connection', (ws) => {
    logger.info('[WebSocket] 클라이언트 연결됨');

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        handleWebSocketMessage(data);
        logger.debug('[WebSocket] 수신: ' + JSON.stringify(data));
      } catch {
        logger.warn('[WebSocket] 잘못된 메시지 형식');
      }
    });

    ws.on('close', () => {
      logger.info('[WebSocket] 클라이언트 연결 해제');
    });
  });

  // EventBus → 모든 WebSocket 클라이언트에 브로드캐스트
  bus.on('agent:stream', (payload) => {
    broadcast({ event: 'agent:stream', ...payload });
  });

  bus.on('agent:complete', (payload) => {
    broadcast({ event: 'agent:complete', ...payload });
  });

  bus.on('session:update', (payload) => {
    broadcast({ event: 'session:update', ...payload });
  });

  bus.on('message:outgoing', (payload) => {
    if (payload.target === 'web' || payload.target === 'all') {
      broadcast({ event: 'message:outgoing', message: payload.message });
    }
  });

  bus.on('message:incoming', (payload) => {
    broadcast({ event: 'message:incoming', source: payload.source, message: payload.message });
  });

  bus.on('activity:new', (payload) => {
    broadcast({ event: 'activity:new', activity: payload.activity });
  });

  bus.on('memory:update', (payload) => {
    broadcast({ event: 'memory:update', memory: payload.memory });
  });

  return wss;
}

/** 연결된 모든 WebSocket 클라이언트에 데이터 전송 */
function broadcast(data: unknown): void {
  if (!wss) return;
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

/** 현재 WebSocket 서버 인스턴스 반환 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}
