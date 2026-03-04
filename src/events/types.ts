// 이벤트 타입 정의 — v4 아키텍처 중앙 이벤트 허브용

export type MessageSource = 'slack' | 'web';
export type MessageTarget = 'slack' | 'web' | 'all';
export type StreamType = 'token' | 'thinking' | 'tool_use' | 'tool_result';
export type SessionStatus = 'active' | 'completed' | 'failed' | 'expired';

export interface IncomingMessage {
  id: string;
  source: MessageSource;
  text: string;
  userId: string;
  channelId: string;
  threadTs: string;
  isOwner: boolean;
  mode: 'channel' | 'thread' | 'dm';
  attachments?: Array<{ name: string; path: string; mimeType: string }>;
  threadMessages?: Array<{ user: string; text: string; botId?: string }>;
}

export interface OutgoingMessage {
  id: string;
  target: MessageTarget;
  text: string;
  channelId: string;
  threadTs: string;
  sessionId: string;
  replaceTs?: string;
}

export interface StreamData {
  content?: string;
  toolName?: string;
  toolInput?: string;
  toolResult?: string;
  thinkingSummary?: string;
}

export interface AgentResult {
  text: string;
  toolsUsed: string[];
  resumeId?: string;
}

export interface ActivityData {
  id: number;
  sessionId: string;
  agentType: string;
  activityType: 'tool_use' | 'skill_invoke' | 'agent_spawn' | 'memory_update';
  toolName?: string;
  detail?: Record<string, unknown>;
  channelId?: string;
  createdAt: number;
}

export interface MemoryUpdateData {
  filePath: string;
  source: 'dashboard' | 'agent' | 'external';
}

export interface EventMap {
  'message:incoming': { source: MessageSource; message: IncomingMessage };
  'message:outgoing': { target: MessageTarget; message: OutgoingMessage };
  'agent:stream': { sessionId: string; type: StreamType; data: StreamData };
  'agent:complete': { sessionId: string; result: AgentResult };
  'session:update': { sessionId: string; status: SessionStatus };
  'activity:new': { activity: ActivityData };
  'memory:update': { memory: MemoryUpdateData };
}
