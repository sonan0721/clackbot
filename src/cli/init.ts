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
  logger.blank();
  logger.detail('1. Slack 앱 생성');
  logger.detail('   https://api.slack.com/apps → Create New App');
  logger.detail('   "From an app manifest" → JSON 탭 → 아래 파일 내용 붙여넣기:');
  logger.detail(`   ${manifestDest}`);
  logger.blank();
  logger.detail('2. 워크스페이스에 앱 설치 → Bot Token 확인');
  logger.detail('   OAuth & Permissions → Install to Workspace');
  logger.detail('   설치 후 Bot User OAuth Token (xoxb-...) 복사');
  logger.blank();
  logger.detail('3. App-Level Token 생성');
  logger.detail('   Basic Information → App-Level Tokens → Generate Token');
  logger.detail('   이름: 아무거나 (예: clackbot)');
  logger.detail('   스코프: connections:write 추가 → Generate');
  logger.detail('   생성된 토큰 (xapp-...) 복사');
  logger.blank();
  logger.detail('4. 토큰 등록');
  logger.detail('   clackbot login');
  logger.blank();
  logger.detail('5. 봇 시작');
  logger.detail('   clackbot start');
}
