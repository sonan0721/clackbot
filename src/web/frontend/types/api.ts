// API 응답 타입 정의

export interface StatusResponse {
  online: boolean
  version: string
  botName: string | null
  botUserId: string | null
  teamName: string | null
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

export interface McpServerStdio {
  name: string
  serverType: 'stdio'
  command: string
  args: string[]
  env: string[]
}

export interface McpServerSSE {
  name: string
  serverType: 'sse'
  url: string
  headers: string[]
}

export interface McpServerHTTP {
  name: string
  serverType: 'http'
  url: string
  headers: string[]
}

export type McpServer = McpServerStdio | McpServerSSE | McpServerHTTP

export interface PluginTool {
  name: string
  plugin: string
  description: string
  status: 'active' | 'error'
  missingEnvVars: string[]
}

export interface PluginMcpServer {
  name: string
  displayName: string
  command: string
  args: string[]
  env: string[]
  hasPage: boolean
}

export interface ToolsResponse {
  builtin: BuiltinTool[]
  mcpServers: McpServer[]
  pluginMcpServers: PluginMcpServer[]
  plugins: PluginTool[]
  total: number
}

export interface ToolGuideServer {
  description: string
  priority: 'high' | 'normal'
  useWhen?: string
}

export interface ToolGuide {
  instructions?: string
  servers?: Record<string, ToolGuideServer>
}

export interface ConfigResponse {
  ownerUserId?: string
  webPort: number
  session: {
    maxMessages: number
    timeoutMinutes: number
  }
  personality: {
    preset: string
    customPrompt?: string
    thinkingMessage?: string
    showProgress?: boolean
  }
  slack: {
    botName?: string
    botUserId?: string
    teamName?: string
    botToken?: string
    appToken?: string
  }
  mcpServers: Record<string,
    | { type: 'stdio'; command: string; args: string[]; env?: Record<string, string> }
    | { type: 'sse'; url: string; headers?: Record<string, string> }
    | { type: 'http'; url: string; headers?: Record<string, string> }
  >
  toolGuide?: ToolGuide
}

export interface MemoryResponse {
  content: string
}

export interface SlackUser {
  id: string
  displayName: string
  realName: string
}

export interface ProjectInfo {
  name: string
  path: string
  description: string
  pathExists: boolean
  hasClaudeMd: boolean
  hasMemory: boolean
}

export interface ProjectContextPreview {
  projectName: string
  projectPath: string
  claudeMd: string | null
  memory: string | null
}

// Agent session types (for dashboard)
export interface AgentSessionSummary {
  id: string
  threadTs?: string
  agentType: string
  skillUsed?: string
  status: 'active' | 'completed' | 'failed' | 'expired'
  taskDescription?: string
  messageCount: number
  toolsUsed: string[]
  createdAt: number
  lastActiveAt: number
  completedAt?: number
}

export interface AgentActivityItem {
  id: number
  sessionId: string
  agentType: string
  activityType: 'tool_use' | 'skill_invoke' | 'agent_spawn' | 'memory_update'
  toolName?: string
  detail?: Record<string, unknown>
  channelId?: string
  createdAt: number
}

export interface AgentSessionsResponse {
  sessions: AgentSessionSummary[]
  total: number
}

export interface BrainFileTree {
  files: string[]
}

export interface BrainFileContent {
  path: string
  content: string
}

export interface BrainMemorySnapshot {
  id: number
  content: string
  changed_by: string
  created_at: number
}

export interface AgentDefinition {
  file: string
  name: string
  description: string
  tools?: string
  model?: string
}

export interface SkillDefinition {
  name: string
  description: string
}
