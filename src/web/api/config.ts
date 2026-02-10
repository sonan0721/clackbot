import { Router } from 'express';
import { loadConfig, saveConfig } from '../../config/index.js';
import { ConfigSchema } from '../../config/schema.js';

// GET/PUT /api/config — 설정 조회/변경

const router = Router();

/** 민감 값 마스킹: 앞 4자 + *** + 뒤 4자 (짧으면 앞뒤 2자) */
function maskSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) return value.slice(0, 2) + '***' + value.slice(-2);
  return value.slice(0, 4) + '***' + value.slice(-4);
}

// 설정 조회
router.get('/', (_req, res) => {
  const config = loadConfig();

  // process.env fallback 반영 (start.ts와 동일한 로직)
  const botToken = config.slack.botToken || process.env.SLACK_BOT_TOKEN;
  const appToken = config.slack.appToken || process.env.SLACK_APP_TOKEN;

  // 민감 정보 마스킹
  const safeConfig = {
    ...config,
    slack: {
      ...config.slack,
      botUserId: maskSecret(config.slack.botUserId),
      botToken: maskSecret(botToken),
      appToken: maskSecret(appToken),
    },
  };

  res.json(safeConfig);
});

// 설정 변경
router.put('/', (req, res) => {
  try {
    const config = loadConfig();
    const updates = req.body;

    // 변경 가능한 필드만 허용
    if (updates.webPort !== undefined) {
      const port = Number(updates.webPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        res.status(400).json({ error: 'webPort는 1~65535 사이의 정수여야 합니다.' });
        return;
      }
      config.webPort = port;
    }

    if (updates.ownerUserId !== undefined) {
      config.ownerUserId = updates.ownerUserId;
    }

    if (updates.session !== undefined) {
      const s = updates.session;
      if (s.maxMessages !== undefined) {
        const v = Number(s.maxMessages);
        if (!Number.isInteger(v) || v < 1 || v > 1000) {
          res.status(400).json({ error: 'maxMessages는 1~1000 사이의 정수여야 합니다.' });
          return;
        }
        s.maxMessages = v;
      }
      if (s.timeoutMinutes !== undefined) {
        const v = Number(s.timeoutMinutes);
        if (!Number.isInteger(v) || v < 1 || v > 1440) {
          res.status(400).json({ error: 'timeoutMinutes는 1~1440 사이의 정수여야 합니다.' });
          return;
        }
        s.timeoutMinutes = v;
      }
      config.session = { ...config.session, ...s };
    }

    if (updates.personality !== undefined) {
      config.personality = { ...config.personality, ...updates.personality };
    }

    if (updates.mcpServers !== undefined) {
      const validated = ConfigSchema.shape.mcpServers.parse(updates.mcpServers);
      config.mcpServers = validated;
    }

    saveConfig(config);
    res.json({ message: '설정이 저장되었습니다.', config });
  } catch (error) {
    res.status(500).json({ error: '설정 저장 실패' });
  }
});

export default router;
