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
