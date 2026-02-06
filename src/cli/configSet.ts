import { loadConfig, saveConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

// clackbot config set <key> <value> — 설정 변경

const ALLOWED_KEYS = ['accessMode', 'webPort', 'ownerUserId'] as const;

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

    case 'webPort':
      const port = parseInt(value, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        logger.error('webPort는 1~65535 사이의 숫자여야 합니다.');
        process.exit(1);
      }
      config.webPort = port;
      break;

    case 'ownerUserId':
      config.ownerUserId = value;
      break;
  }

  saveConfig(config);
  logger.success(`${key} = ${value} (저장 완료)`);
}
