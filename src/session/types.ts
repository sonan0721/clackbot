// 세션 타입 정의

export interface Session {
  id: string;
  threadTs: string;
  resumeId?: string;
  messageCount: number;
  createdAt: number;
  lastActiveAt: number;
}
