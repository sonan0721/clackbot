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
      config.webPort = Number(updates.webPort);
    }

    if (updates.ownerUserId !== undefined) {
      config.ownerUserId = updates.ownerUserId;
    }

    if (updates.session !== undefined) {
      config.session = { ...config.session, ...updates.session };
    }

    saveConfig(config);
    res.json({ message: '설정이 저장되었습니다.', config });
  } catch (error) {
    res.status(500).json({ error: '설정 저장 실패' });
  }
});

export default router;
