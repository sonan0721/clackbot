// EventBus message:incoming 이벤트를 구독하여 web 소스 메시지를 처리한다.
// Slack 소스 메시지는 handler.ts에서 이미 처리하므로 건너뛴다.

import { getEventBus } from './eventBus.js';
import { routeMessage } from '../router/messageRouter.js';
import { queryBrain } from '../agent/brain.js';
import { queryAgent } from '../agent/claude.js';
import { getLocalDir } from '../config/paths.js';
import { getActiveSessions } from '../store/agentSessions.js';
import { logger } from '../utils/logger.js';
import type { ActiveSession } from '../router/types.js';

/**
 * EventBus message:incoming 이벤트를 구독하여 web 소스 메시지를 처리한다.
 * Slack 소스 메시지는 handler.ts에서 이미 처리하므로 건너뛴다.
 */
export function setupMessageHandler(): void {
  const bus = getEventBus();

  bus.on('message:incoming', async (payload) => {
    // Slack 소스는 handler.ts에서 처리 → 여기서는 web 소스만
    if (payload.source !== 'web') return;

    const message = payload.message;
    logger.info(`[MessageHandler] 웹 메시지 처리: ${message.text.slice(0, 50)}`);

    try {
      const cwd = getLocalDir();

      // 활성 세션 조회
      const dbSessions = getActiveSessions();
      const activeSessions: ActiveSession[] = dbSessions
        .filter(s => s.agentType !== 'brain' && s.threadTs === message.threadTs)
        .map(s => ({
          sessionId: s.id,
          threadTs: s.threadTs ?? message.threadTs,
          agentType: s.agentType as 'brain' | 'sub',
          resumeId: s.resumeId ?? undefined,
          status: 'active' as const,
        }));

      const route = routeMessage(message, activeSessions);

      let response: { text: string; toolsUsed: string[]; resumeId?: string };

      switch (route.action) {
        case 'brain': {
          const brainResult = await queryBrain({
            prompt: message.text,
            cwd,
            threadTs: message.threadTs,
            isOwner: true,
            onProgress: (status) => {
              // agent:stream은 brain.ts 내부에서 이미 EventBus로 발행됨
              logger.debug(`[MessageHandler] 진행: ${status}`);
            },
          });
          response = { text: brainResult.text, toolsUsed: brainResult.toolsUsed };
          break;
        }
        case 'agent_resume':
        case 'agent_new': {
          response = await queryAgent({
            prompt: message.text,
            cwd,
            threadMessages: message.threadMessages ?? [],
            sessionId: `web-${Date.now()}`,
            resumeId: route.resumeId,
            isOwner: true,
            mode: 'dm',
          });
          break;
        }
        default: {
          response = { text: '요청을 처리할 수 없습니다.', toolsUsed: [] };
        }
      }

      // 완료 이벤트 발행 (WebSocketSink가 대시보드에 전달)
      bus.emit('agent:complete', {
        sessionId: message.threadTs,
        result: { text: response.text, toolsUsed: response.toolsUsed, resumeId: response.resumeId },
      });

    } catch (error) {
      logger.error(`[MessageHandler] 웹 메시지 처리 실패: ${error}`);
      bus.emit('agent:complete', {
        sessionId: message.threadTs,
        result: { text: '죄송합니다. 메시지 처리 중 오류가 발생했습니다.', toolsUsed: [] },
      });
    }
  });
}
