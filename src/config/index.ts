import fs from 'node:fs';
import { ZodError } from 'zod';
import { getConfigPath, getLocalDir } from './paths.js';
import { ConfigSchema, DEFAULT_CONFIG, type ClackbotConfig } from './schema.js';
import { logger } from '../utils/logger.js';

// 설정 로더 — config.json 읽기/쓰기

/** config.json 읽기 (없으면 기본값 반환) */
export function loadConfig(cwd?: string): ClackbotConfig {
  const configPath = getConfigPath(cwd);

  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return ConfigSchema.parse(raw);
  } catch (error) {
    logger.warn(`설정 파일 파싱 실패: ${configPath}`);
    if (error instanceof ZodError) {
      for (const issue of error.issues) {
        logger.warn(`  → ${issue.path.join('.')}: ${issue.message}`);
      }
    } else if (error instanceof SyntaxError) {
      logger.warn(`  → JSON 문법 오류: ${error.message}`);
    }
    logger.warn('기본 설정을 사용합니다.');
    return DEFAULT_CONFIG;
  }
}

/** config.json 저장 */
export function saveConfig(config: ClackbotConfig, cwd?: string): void {
  const configPath = getConfigPath(cwd);
  const dir = getLocalDir(cwd);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/** config 부분 업데이트 */
export function updateConfig(
  updates: Partial<ClackbotConfig>,
  cwd?: string,
): ClackbotConfig {
  const config = loadConfig(cwd);
  const merged = { ...config, ...updates };
  const validated = ConfigSchema.parse(merged);
  saveConfig(validated, cwd);
  return validated;
}

export { type ClackbotConfig } from './schema.js';
export { ConfigSchema, DEFAULT_CONFIG } from './schema.js';
