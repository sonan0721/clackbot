// --- Status ---
export interface StatusResponse {
  online: boolean;
  version: string;
  botName: string | null;
  teamName: string | null;
  port: number;
}

// --- Config ---
export interface PersonalityConfig {
  preset: string;
  customPrompt?: string;
  thinkingMessage: string;
  showProgress: boolean;
}

export interface SessionConfig {
  maxMessages: number;
  timeoutMinutes: number;
}

export interface ToolGuideServer {
  description: string;
  priority: 'high' | 'normal';
  useWhen?: string;
}

export interface ToolGuideConfig {
  instructions?: string;
  servers?: Record<string, ToolGuideServer>;
}

export interface McpServerConfig {
  type?: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface ConfigResponse {
  personality: PersonalityConfig;
  session: SessionConfig;
  webPort: number;
  toolGuide: ToolGuideConfig;
  mcpServers: Record<string, McpServerConfig>;
  ownerUserId?: string;
  slack: {
    botToken?: string;
    appToken?: string;
    botUserId?: string;
    botName?: string;
    teamId?: string;
    teamName?: string;
  };
  projects: Record<string, { path: string; description?: string }>;
}

// --- Conversations ---
export interface SessionSummary {
  threadTs: string;
  firstMessage: string;
  messageCount: number;
  lastMessageAt: string;
}

export interface Message {
  inputText: string;
  outputText: string;
  toolsUsed: string[];
  createdAt: string;
}

export interface ConversationsResponse {
  sessions: SessionSummary[];
  total: number;
}

// --- Agent Sessions ---
export interface AgentSessionSummary {
  id: string;
  agentType: string;
  status: 'active' | 'completed' | 'failed' | 'expired';
  description?: string;
  messageCount: number;
  toolsUsed: string[];
  createdAt: string;
  lastActiveAt: string;
  completedAt?: string;
}

export interface AgentActivityItem {
  id: string;
  sessionId: string;
  agentType: string;
  activityType: 'tool_use' | 'skill_invoke' | 'agent_spawn' | 'memory_update';
  toolName?: string;
  detail?: string;
  createdAt: string;
}

export interface AgentSessionsResponse {
  sessions: AgentSessionSummary[];
  total: number;
}

// --- Tools ---
export interface BuiltinTool {
  name: string;
  description: string;
}

export interface PluginTool {
  name: string;
  plugin: string;
  description: string;
  status: string;
  missingEnvVars: string[];
}

export interface ToolsResponse {
  builtin: BuiltinTool[];
  mcpServers: Record<string, McpServerConfig>;
  pluginMcpServers: Record<string, McpServerConfig>;
  plugins: PluginTool[];
  total: number;
}

// --- Memory ---
export interface MemoryResponse {
  content: string;
}

// --- Brain Memory ---
export interface BrainFileTree {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: BrainFileTree[];
}

export interface BrainFileContent {
  path: string;
  content: string;
  lastModified: string;
}

export interface BrainSnapshot {
  id: string;
  path: string;
  content: string;
  createdAt: string;
}

// --- Agents & Skills ---
export interface AgentDefinition {
  name: string;
  description: string;
  filePath: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  filePath: string;
}

// --- Projects ---
export interface ProjectInfo {
  name: string;
  path: string;
  description?: string;
}

export interface ProjectContextPreview {
  claudeMd?: string;
  memory?: string;
}

// --- Slack ---
export interface SlackUser {
  id: string;
  displayName: string;
  realName: string;
}
