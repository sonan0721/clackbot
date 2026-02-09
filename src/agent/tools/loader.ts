import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { tool, createSdkMcpServer, type McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-code';
import { getToolsDir } from '../../config/paths.js';
import { loadConfig } from '../../config/index.js';
import { loadPlugins } from '../../plugins/registry.js';
import { slackPostTool } from './builtin/slackPost.js';
import { slackReadChannelTool } from './builtin/slackReadChannel.js';
import { slackSendDmTool } from './builtin/slackSendDm.js';
import { memoryReadTool, memoryWriteTool } from './builtin/memory.js';
import { logger } from '../../utils/logger.js';

// 플러그인 JSON 로더 — .clackbot/tools/*.json → MCP 도구 변환

// 플러그인 JSON 스키마
const PluginParamSchema = z.object({
  type: z.enum(['string', 'number', 'boolean']),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

const PluginToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string(),
  params: z.record(PluginParamSchema).optional(),
  authParams: z.record(z.string()).optional(),
  headers: z.record(z.string()).optional(),
});

const PluginSchema = z.object({
  name: z.string(),
  description: z.string(),
  auth: z.object({
    type: z.enum(['api_key', 'bearer', 'none']),
    envVars: z.array(z.string()).optional(),
  }).optional(),
  tools: z.array(PluginToolSchema),
});

export type PluginDefinition = z.infer<typeof PluginSchema>;
export type PluginToolDefinition = z.infer<typeof PluginToolSchema>;

/** 플러그인 디렉토리에서 JSON 파일 로드 */
export function loadPluginTools(toolsDir?: string): PluginDefinition[] {
  const dir = toolsDir ?? getToolsDir();

  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const plugins: PluginDefinition[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const plugin = PluginSchema.parse(raw);
      plugins.push(plugin);
    } catch (error) {
      logger.warn(`플러그인 로드 실패 (${file}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return plugins;
}

/** 단일 플러그인 파일 검증 */
export function validatePluginFile(filePath: string): { valid: boolean; error?: string } {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    PluginSchema.parse(raw);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** 환경변수 치환 ($ENV_VAR → 실제 값) */
function resolveEnvVar(value: string): string {
  if (value.startsWith('$')) {
    const envName = value.slice(1);
    return process.env[envName] ?? '';
  }
  return value;
}

/** 플러그인 도구 → MCP tool 변환 */
function pluginToolToMcpTool(pluginName: string, toolDef: PluginToolDefinition) {
  // Zod 스키마 동적 생성
  const schemaShape: Record<string, z.ZodType> = {};
  if (toolDef.params) {
    for (const [key, paramDef] of Object.entries(toolDef.params)) {
      let zodType: z.ZodType;
      switch (paramDef.type) {
        case 'number':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        default:
          zodType = z.string();
      }

      if (paramDef.description) {
        zodType = zodType.describe(paramDef.description);
      }

      if (!paramDef.required) {
        zodType = zodType.optional() as z.ZodType;
      }

      schemaShape[key] = zodType;
    }
  }

  return tool(
    toolDef.name,
    toolDef.description,
    schemaShape,
    async (args: Record<string, unknown>) => {
      try {
        // URL 구성
        let url = toolDef.url;

        // 인증 파라미터 치환
        const queryParams = new URLSearchParams();
        if (toolDef.authParams) {
          for (const [key, value] of Object.entries(toolDef.authParams)) {
            queryParams.set(key, resolveEnvVar(value));
          }
        }

        // 요청 헤더
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(toolDef.headers
            ? Object.fromEntries(
                Object.entries(toolDef.headers).map(([k, v]) => [k, resolveEnvVar(v)])
              )
            : {}),
        };

        // GET 요청: 파라미터를 URL에 추가
        if (toolDef.method === 'GET') {
          for (const [key, value] of Object.entries(args)) {
            if (value !== undefined) queryParams.set(key, String(value));
          }
          const qs = queryParams.toString();
          if (qs) url += (url.includes('?') ? '&' : '?') + qs;
        }

        // 요청 옵션
        const fetchOptions: RequestInit = {
          method: toolDef.method,
          headers,
        };

        // POST/PUT/PATCH: body에 파라미터 추가
        if (['POST', 'PUT', 'PATCH'].includes(toolDef.method)) {
          const body = { ...args };
          // 인증 파라미터도 body에 추가
          if (toolDef.authParams) {
            for (const [key, value] of Object.entries(toolDef.authParams)) {
              body[key] = resolveEnvVar(value);
            }
          }
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        const responseText = await response.text();

        return {
          content: [{
            type: 'text' as const,
            text: response.ok
              ? responseText
              : `API 오류 (${response.status}): ${responseText}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `API 호출 실패: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    },
  );
}

// stdio MCP 서버 설정 타입
interface StdioMcpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export type McpServerConfig = McpSdkServerConfigWithInstance | StdioMcpServerConfig;

/** 모든 MCP 서버 설정 반환 (내장 + config mcpServers + 플러그인 JSON) */
export function getMcpServers(cwd?: string): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};

  // 내장 도구 서버
  servers['clackbot'] = createSdkMcpServer({
    name: 'clackbot-builtin',
    version: '1.0.0',
    tools: [slackPostTool, slackReadChannelTool, slackSendDmTool, memoryReadTool, memoryWriteTool],
  });

  // config.mcpServers에서 stdio MCP 서버 로드
  const config = loadConfig(cwd);
  if (config.mcpServers) {
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      servers[name] = {
        type: 'stdio' as const,
        command: serverConfig.command,
        args: serverConfig.args,
        ...(serverConfig.env ? { env: serverConfig.env } : {}),
      };
    }
  }

  // 플러그인 JSON 도구 서버 (하위 호환)
  const toolsDir = getToolsDir(cwd);
  const jsonPlugins = loadPluginTools(toolsDir);

  for (const plugin of jsonPlugins) {
    const mcpTools = plugin.tools.map(t => pluginToolToMcpTool(plugin.name, t));

    servers[plugin.name] = createSdkMcpServer({
      name: `clackbot-plugin-${plugin.name}`,
      version: '1.0.0',
      tools: mcpTools,
    });
  }

  // 통합 플러그인 MCP 서버 (.clackbot/plugins/)
  const integratedPlugins = loadPlugins(cwd);
  for (const plugin of integratedPlugins) {
    if (plugin.manifest.mcp) {
      servers[`plugin-${plugin.name}`] = {
        type: 'stdio' as const,
        command: plugin.manifest.mcp.command,
        args: plugin.manifest.mcp.args,
        ...(plugin.manifest.mcp.env ? { env: plugin.manifest.mcp.env } : {}),
      };
    }
  }

  return servers;
}
