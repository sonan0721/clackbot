// MessageRouter — 순수 함수 라우팅
// 메시지와 활성 세션 상태를 받아 라우팅 결정을 반환한다.
// 사이드 이펙트 없음.

import type { IncomingMessage } from '../events/types.js';
import type { ActiveSession, RouteDecision } from './types.js';

/**
 * 순수 함수: 메시지와 활성 세션 상태를 받아 라우팅 결정을 반환한다.
 * 사이드 이펙트 없음.
 */
export function routeMessage(
  message: IncomingMessage,
  activeSessions: ActiveSession[],
): RouteDecision {
  const { mode, isOwner, threadTs } = message;

  // 1. channel 모드 → 항상 1회성 agent (Brain 불필요)
  if (mode === 'channel') {
    return {
      action: 'agent_new',
      mode,
      isOwner,
    };
  }

  // 2. 활성 Sub Agent 세션이 같은 thread에 있으면 이어서 진행
  const activeSubAgent = activeSessions.find(
    (s) => s.threadTs === threadTs && s.agentType === 'sub' && s.status === 'active',
  );
  if (activeSubAgent) {
    return {
      action: 'agent_resume',
      sessionId: activeSubAgent.sessionId,
      resumeId: activeSubAgent.resumeId,
      mode,
      isOwner,
    };
  }

  // 3. DM/thread + 활성 Sub Agent 없음 → Brain 라우팅
  return {
    action: 'brain',
    mode,
    isOwner,
  };
}
