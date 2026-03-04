// 라우터 타입 정의 — MessageRouter 순수 함수용

import type { IncomingMessage } from '../events/types.js';

/** 활성 에이전트 세션 정보 */
export interface ActiveSession {
  sessionId: string;
  threadTs: string;
  agentType: 'brain' | 'sub';
  resumeId?: string;
  status: 'active' | 'completed' | 'failed' | 'expired';
}

/** 라우팅 결정 결과 */
export interface RouteDecision {
  action: 'brain' | 'agent_resume' | 'agent_new' | 'direct_reply' | 'reject';
  sessionId?: string;
  resumeId?: string;
  mode: 'dm' | 'thread' | 'channel';
  isOwner: boolean;
}
