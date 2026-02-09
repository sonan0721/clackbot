// API 응답 타입 정의

export interface StatusResponse {
  online: boolean
  version: string
  botName: string | null
  botUserId: string | null
  teamName: string | null
  accessMode: 'owner' | 'public'
  replyMode: 'thread' | 'chat'
  webPort: number
}

export interface SessionSummary {
  threadTs: string
  channelId: string
  firstMessage: string
  lastAt: string
  messageCount: number
}

export interface ConversationsResponse {
  sessions: SessionSummary[]
  total: number
}

export interface Message {
  inputText: string
  outputText: string | null
  toolsUsed: string[]
  createdAt: string
}

export interface ConversationDetailResponse {
  messages: Message[]
}

export interface BuiltinTool {
  name: string
  description: string
}

export interface McpServer {
  name: string
  command: string
  args: string[]
}

export interface PluginTool {
  name: string
  plugin: string
  description: string
  status: 'active' | 'error'
  missingEnvVars: string[]
}

export interface ToolsResponse {
  builtin: BuiltinTool[]
  mcpServers: McpServer[]
  plugins: PluginTool[]
  total: number
}

export interface ConfigResponse {
  accessMode: 'owner' | 'public'
  replyMode: 'thread' | 'chat'
  ownerUserId?: string
  webPort: number
  session: {
    maxMessages: number
    timeoutMinutes: number
  }
  personality: {
    preset: string
    customPrompt?: string
  }
  slack: {
    botName?: string
    botUserId?: string
    teamName?: string
    botToken?: string
    appToken?: string
  }
  mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }>
}

export interface SupervisorFile {
  slug: string
  path: string
  exists: boolean
}

export interface FileContentResponse {
  content: string
  exists: boolean
}

export interface SupervisorSession {
  id: string
  title: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: string
}

export interface SlackUser {
  id: string
  displayName: string
  realName: string
}

export interface SSEEvent {
  type: 'connected' | 'text' | 'tool_call' | 'error' | 'done' | 'file_changed'
  data: string
}
