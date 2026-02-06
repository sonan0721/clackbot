import { Router } from 'express';
import { loadPluginTools } from '../../agent/tools/loader.js';
import { getToolsDir } from '../../config/paths.js';

// GET /api/tools — 연동 툴 목록

const router = Router();

router.get('/', (_req, res) => {
  const toolsDir = getToolsDir();

  // 내장 도구
  const builtinTools = [
    {
      name: 'slack_post',
      description: 'Slack 채널에 메시지를 전송합니다',
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

  // 플러그인 도구
  const plugins = loadPluginTools(toolsDir);
  const pluginTools = plugins.flatMap(plugin =>
    plugin.tools.map(t => {
      // 인증 환경변수 확인
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

  res.json({
    builtin: builtinTools,
    plugins: pluginTools,
    total: builtinTools.length + pluginTools.length,
  });
});

export default router;
