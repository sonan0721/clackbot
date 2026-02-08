import { loadConfig, saveConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

// clackbot config set <key> <value> — 설정 변경

const ALLOWED_KEYS = ['accessMode', 'replyMode', 'webPort', 'ownerUserId', 'session.maxMessages', 'session.timeoutMinutes'] as const;

export async function configSetCommand(key: string, value: string): Promise<void> {
  if (!ALLOWED_KEYS.includes(key as typeof ALLOWED_KEYS[number])) {
    logger.error(`알 수 없는 설정 키: ${key}`);
    logger.detail(`사용 가능한 키: ${ALLOWED_KEYS.join(', ')}`);
    process.exit(1);
  }

  const config = loadConfig();

  switch (key) {
    case 'accessMode':
      if (value !== 'owner' && value !== 'public') {
        logger.error('accessMode는 "owner" 또는 "public"이어야 합니다.');
        process.exit(1);
      }
      config.accessMode = value;
      break;

    case 'replyMode':
      if (value !== 'thread' && value !== 'chat') {
        logger.error('replyMode는 "thread" 또는 "chat"이어야 합니다.');
        process.exit(1);
      }
      config.replyMode = value;
      break;

    case 'webPort': {
      const port = parseInt(value, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        logger.error('webPort는 1~65535 사이의 숫자여야 합니다.');
        process.exit(1);
      }
      config.webPort = port;
      break;
    }

    case 'ownerUserId':
      config.ownerUserId = value;
      break;

    case 'session.maxMessages': {
      const v = parseInt(value, 10);
      if (isNaN(v) || v < 1 || v > 1000) {
        logger.error('session.maxMessages는 1~1000 사이의 정수여야 합니다.');
        process.exit(1);
      }
      config.session = { ...config.session, maxMessages: v };
      break;
    }

    case 'session.timeoutMinutes': {
      const v = parseInt(value, 10);
      if (isNaN(v) || v < 1 || v > 1440) {
        logger.error('session.timeoutMinutes는 1~1440 사이의 정수여야 합니다.');
        process.exit(1);
      }
      config.session = { ...config.session, timeoutMinutes: v };
      break;
    }
  }

  saveConfig(config);
  logger.success(`${key} = ${value} (저장 완료)`);
}
