import fs from 'node:fs';
import { getToolsDir } from '../config/paths.js';
import { logger } from '../utils/logger.js';
import { loadPluginTools, validatePluginFile } from '../agent/tools/loader.js';

// clackbot tool list/validate — 플러그인 툴 CLI

export async function toolListCommand(): Promise<void> {
  const toolsDir = getToolsDir();

  if (!fs.existsSync(toolsDir)) {
    logger.info('플러그인 툴 디렉토리가 없습니다.');
    logger.detail('clackbot init을 실행하여 .clackbot/tools/ 디렉토리를 생성하세요.');
    return;
  }

  try {
    const plugins = loadPluginTools(toolsDir);

    if (plugins.length === 0) {
      logger.info('등록된 플러그인 툴이 없습니다.');
      logger.detail('.clackbot/tools/ 에 JSON 파일을 추가하세요.');
      return;
    }

    logger.info(`등록된 플러그인 (${plugins.length}개):`);
    logger.blank();

    for (const plugin of plugins) {
      logger.detail(`${plugin.name} — ${plugin.description}`);
      for (const tool of plugin.tools) {
        logger.detail(`  - ${tool.name}: ${tool.description}`);
      }
    }
  } catch (error) {
    logger.error(`플러그인 로드 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function toolValidateCommand(): Promise<void> {
  const toolsDir = getToolsDir();

  if (!fs.existsSync(toolsDir)) {
    logger.error('플러그인 툴 디렉토리가 없습니다.');
    return;
  }

  const files = fs.readdirSync(toolsDir).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    logger.info('.clackbot/tools/ 에 JSON 파일이 없습니다.');
    return;
  }

  let allValid = true;

  for (const file of files) {
    const filePath = `${toolsDir}/${file}`;
    const result = validatePluginFile(filePath);

    if (result.valid) {
      logger.success(`${file}: 유효함`);
    } else {
      allValid = false;
      logger.error(`${file}: ${result.error}`);
    }
  }

  logger.blank();
  if (allValid) {
    logger.success('모든 플러그인 파일이 유효합니다.');
  } else {
    logger.warn('일부 플러그인 파일에 문제가 있습니다.');
  }
}
