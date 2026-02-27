// 세션 타입 정의

export interface Session {
  id: string;
  threadTs: string;
  agentType: 'brain' | string;  // 'brain' 또는 서브 에이전트 타입명
  resumeId?: string;
  messageCount: number;
  createdAt: number;
  lastActiveAt: number;
}
