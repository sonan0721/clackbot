import { Router } from 'express';
import { loadPluginTools } from '../../agent/tools/loader.js';
import { getToolsDir } from '../../config/paths.js';
import { loadConfig } from '../../config/index.js';
import { loadPlugins } from '../../plugins/registry.js';

// GET /api/tools — 연동 툴 목록

const router = Router();

router.get('/', (_req, res) => {
  const toolsDir = getToolsDir();
  const config = loadConfig();

  // 내장 도구
  const builtinTools = [
    {
      name: 'slack_post',
      description: 'Slack 채널에 메시지를 전송합니다',
      type: 'builtin' as const,
      status: 'active' as const,
    },
    {
      name: 'slack_read_channel',
      description: 'Slack 채널의 최근 메시지를 읽어옵니다',
      type: 'builtin' as const,
      status: 'active' as const,
    },
    {
      name: 'memory_read',
      description: 'Clackbot 메모리를 읽습니다',
      type: 'builtin' as const,
      status: 'active' as const,
    },
    {
      name: 'memory_write',
      description: 'Clackbot 메모리에 내용을 추가합니다',
      type: 'builtin' as const,
      status: 'active' as const,
    },
  ];

  // config.mcpServers에서 설치된 MCP 서버
  const mcpServers = Object.entries(config.mcpServers || {}).map(([name, server]) => ({
    name,
    command: server.command,
    args: server.args,
    env: server.env ? Object.keys(server.env) : [],
    type: 'mcp' as const,
    status: 'active' as const,
  }));

  // 플러그인 JSON 도구 (하위 호환)
  const plugins = loadPluginTools(toolsDir);
  const pluginTools = plugins.flatMap(plugin =>
    plugin.tools.map(t => {
      const envVars = plugin.auth?.envVars ?? [];
      const authOk = envVars.every(v => !!process.env[v]);

      return {
        name: t.name,
        description: t.description,
        type: 'plugin' as const,
        plugin: plugin.name,
        status: authOk ? ('active' as const) : ('auth_missing' as const),
        missingEnvVars: envVars.filter(v => !process.env[v]),
      };
    })
  );

  // 통합 플러그인 MCP 서버 (.clackbot/plugins/)
  const integratedPlugins = loadPlugins();
  const pluginMcpServers = integratedPlugins
    .filter(p => p.hasMcp)
    .map(p => ({
      name: `plugin-${p.name}`,
      displayName: p.displayName,
      command: p.manifest.mcp!.command,
      args: p.manifest.mcp!.args,
      env: p.manifest.mcp!.env ? Object.keys(p.manifest.mcp!.env) : [],
      type: 'plugin-mcp' as const,
      status: 'active' as const,
      hasPage: p.hasDashboard,
    }));

  res.json({
    builtin: builtinTools,
    mcpServers,
    pluginMcpServers,
    plugins: pluginTools,
    total: builtinTools.length + mcpServers.length + pluginMcpServers.length + pluginTools.length,
  });
});

export default router;
