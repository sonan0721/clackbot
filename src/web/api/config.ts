import { Router } from 'express';
import { loadConfig, saveConfig } from '../../config/index.js';

// GET/PUT /api/config — 설정 조회/변경

const router = Router();

// 설정 조회
router.get('/', (_req, res) => {
  const config = loadConfig();

  // 민감 정보 마스킹
  const safeConfig = {
    ...config,
    slack: {
      ...config.slack,
      botToken: config.slack.botToken ? '***' + config.slack.botToken.slice(-6) : undefined,
      appToken: config.slack.appToken ? '***' + config.slack.appToken.slice(-6) : undefined,
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
    if (updates.accessMode !== undefined) {
      if (!['owner', 'public'].includes(updates.accessMode)) {
        res.status(400).json({ error: 'accessMode는 "owner" 또는 "public"이어야 합니다.' });
        return;
      }
      config.accessMode = updates.accessMode;
    }

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
      config.mcpServers = updates.mcpServers;
    }

    saveConfig(config);
    res.json({ message: '설정이 저장되었습니다.', config });
  } catch (error) {
    res.status(500).json({ error: '설정 저장 실패' });
  }
});

export default router;
