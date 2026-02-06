import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLocalDir, getToolsDir, getEnvPath } from '../config/paths.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// clackbot init — 프로젝트 스캐폴딩
export async function initCommand(): Promise<void> {
  const cwd = process.cwd();
  const clackbotDir = getLocalDir(cwd);
  const toolsDir = getToolsDir(cwd);

  const templatesDir = path.resolve(__dirname, '../../templates');

  logger.info('Clackbot 프로젝트를 초기화합니다...');
  logger.blank();

  // .clackbot/ 디렉토리 생성
  if (fs.existsSync(clackbotDir)) {
    logger.warn('.clackbot/ 디렉토리가 이미 존재합니다.');
  } else {
    fs.mkdirSync(clackbotDir, { recursive: true });
    logger.success('.clackbot/ 디렉토리 생성');
  }

  // .clackbot/tools/ 디렉토리 생성
  if (!fs.existsSync(toolsDir)) {
    fs.mkdirSync(toolsDir, { recursive: true });
    logger.success('.clackbot/tools/ 디렉토리 생성');
  }

  // config.json 복사
  const configDest = path.join(clackbotDir, 'config.json');
  if (!fs.existsSync(configDest)) {
    const configSrc = path.join(templatesDir, 'config.json');

    if (fs.existsSync(configSrc)) {
      fs.copyFileSync(configSrc, configDest);
    } else {
      // 템플릿 파일이 없으면 기본 config 직접 생성
      const defaultConfig = {
        slack: {},
        accessMode: 'owner',
        session: { maxMessages: 20, timeoutMinutes: 30 },
        webPort: 3847,
        projects: [],
      };
      fs.writeFileSync(configDest, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    }
    logger.success('.clackbot/config.json 생성');
  } else {
    logger.warn('.clackbot/config.json 이미 존재합니다.');
  }

  // memory.md 생성
  const memoryPath = path.join(clackbotDir, 'memory.md');
  if (!fs.existsSync(memoryPath)) {
    fs.writeFileSync(memoryPath, '# Clackbot 메모리\n\n', 'utf-8');
    logger.success('.clackbot/memory.md 생성');
  }

  // .env.example 복사
  const envExampleDest = path.join(cwd, '.env.example');
  if (!fs.existsSync(envExampleDest)) {
    const envSrc = path.join(templatesDir, '.env.example');

    if (fs.existsSync(envSrc)) {
      fs.copyFileSync(envSrc, envExampleDest);
    } else {
      // 템플릿 파일이 없으면 직접 생성
      const envContent = [
        '# Slack Bot Token (xoxb-...)',
        '# Slack 앱 > OAuth & Permissions 에서 발급',
        'SLACK_BOT_TOKEN=',
        '',
        '# Slack App-Level Token (xapp-...)',
        '# Slack 앱 > Basic Information > App-Level Tokens 에서 발급',
        '# connections:write 스코프 필요',
        'SLACK_APP_TOKEN=',
        '',
        '# Anthropic API Key',
        '# https://console.anthropic.com/ 에서 발급',
        'ANTHROPIC_API_KEY=',
        '',
      ].join('\n');
      fs.writeFileSync(envExampleDest, envContent, 'utf-8');
    }
    logger.success('.env.example 생성');
  }

  // slack-manifest.json 복사
  const manifestDest = path.join(clackbotDir, 'slack-manifest.json');
  if (!fs.existsSync(manifestDest)) {
    const manifestSrc = path.join(templatesDir, 'slack-manifest.json');
    if (fs.existsSync(manifestSrc)) {
      fs.copyFileSync(manifestSrc, manifestDest);
    }
    logger.success('.clackbot/slack-manifest.json 생성');
  }

  logger.blank();
  logger.success('초기화 완료!');
  logger.blank();
  logger.info('다음 단계:');
  logger.detail('1. Slack 앱을 생성하세요:');
  logger.detail('   https://api.slack.com/apps → Create New App');
  logger.detail('');
  logger.detail('   [방법 A] Manifest로 한번에 설정 (추천):');
  logger.detail('   "From an app manifest" 선택 → JSON 탭 →');
  logger.detail(`   ${manifestDest} 내용을 붙여넣기`);
  logger.detail('');
  logger.detail('   [방법 B] 수동 설정:');
  logger.detail('   "From scratch" 선택 후 아래 항목 설정:');
  logger.detail('   - Socket Mode: 활성화');
  logger.detail('   - Bot Token Scopes: app_mentions:read, channels:history,');
  logger.detail('     channels:read, chat:write, groups:history, groups:read,');
  logger.detail('     im:history, im:read, im:write, reactions:write, users:read');
  logger.detail('   - Event Subscriptions: app_mention, message.im');
  logger.detail('');
  logger.detail('2. 앱 설치 후 토큰을 설정하세요:');
  logger.detail('   clackbot login');
  logger.detail('');
  logger.detail('3. 봇을 시작하세요:');
  logger.detail('   clackbot start');
}
