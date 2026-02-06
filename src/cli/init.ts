import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
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

  // slack-manifest.json 동적 생성
  const manifestDest = path.join(clackbotDir, 'slack-manifest.json');
  let manifestJson = '';
  let generateManifest = !fs.existsSync(manifestDest);

  if (!generateManifest) {
    generateManifest = await confirm({
      message: 'slack-manifest.json이 이미 존재합니다. 새로 생성하시겠습니까?',
      default: false,
    });
  }

  if (generateManifest) {
    // 앱 이름 입력 (한글/영어 가능)
    const appName = await input({
      message: 'Slack 앱 이름 (예: Clackbot, 비서봇):',
      default: 'Clackbot',
      validate: (val) => val.trim().length > 0 || '앱 이름을 입력하세요.',
    });

    // 봇 사용자 이름 입력 (영어만)
    const botUsername = await input({
      message: 'Bot 사용자 이름 (영어, 소문자, 하이픈 가능):',
      default: 'clackbot',
      validate: (val) =>
        /^[a-z][a-z0-9._-]*$/.test(val) ||
        '영어 소문자로 시작, 소문자/숫자/하이픈/밑줄/점만 사용 가능합니다.',
    });

    // manifest 동적 생성
    const manifest = {
      display_information: {
        name: appName.trim(),
        description: '개인 로컬 Slack 비서 — Claude Code 기반',
        background_color: '#4A154B',
      },
      features: {
        app_home: {
          home_tab_enabled: false,
          messages_tab_enabled: true,
          messages_tab_read_only_enabled: false,
        },
        bot_user: {
          display_name: appName.trim(),
          always_online: false,
        },
      },
      oauth_config: {
        scopes: {
          bot: [
            'app_mentions:read',
            'channels:history',
            'channels:read',
            'chat:write',
            'groups:history',
            'groups:read',
            'im:history',
            'im:read',
            'im:write',
            'reactions:write',
            'users:read',
          ],
        },
      },
      settings: {
        event_subscriptions: {
          bot_events: ['app_mention', 'message.im'],
        },
        interactivity: {
          is_enabled: false,
        },
        org_deploy_enabled: false,
        socket_mode_enabled: true,
        token_rotation_enabled: false,
      },
    };

    manifestJson = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(manifestDest, manifestJson, 'utf-8');
    logger.success('.clackbot/slack-manifest.json 생성');
  } else {
    manifestJson = fs.readFileSync(manifestDest, 'utf-8');
  }

  logger.blank();
  logger.success('초기화 완료!');
  logger.blank();
  logger.info('다음 단계:');
  logger.blank();
  logger.detail(`${chalk.cyan.bold('1.')} Slack 앱을 생성하세요:`);
  logger.detail(`   ${chalk.underline('https://api.slack.com/apps')} → ${chalk.yellow('Create New App')}`);
  logger.detail(`   ${chalk.yellow('"From an app manifest"')} 선택 → ${chalk.yellow('JSON')} 탭 → 아래 내용 붙여넣기:`);
  logger.blank();
  console.log(chalk.gray(manifestJson));
  logger.blank();
  logger.detail(`   또는 파일에서 복사: ${chalk.underline(manifestDest)}`);
  logger.blank();
  logger.detail(`${chalk.cyan.bold('2.')} 워크스페이스에 앱 설치 → Bot Token 확인`);
  logger.detail(`   ${chalk.yellow('OAuth & Permissions')} → ${chalk.yellow('Install to Workspace')}`);
  logger.detail(`   설치 후 ${chalk.green('Bot User OAuth Token')} (${chalk.dim('xoxb-...')}) 복사`);
  logger.blank();
  logger.detail(`${chalk.cyan.bold('3.')} App-Level Token 생성`);
  logger.detail(`   ${chalk.yellow('Basic Information')} → ${chalk.yellow('App-Level Tokens')} → ${chalk.yellow('Generate Token')}`);
  logger.detail(`   이름: 아무거나 (예: clackbot)`);
  logger.detail(`   스코프: ${chalk.green('connections:write')} 추가 → Generate`);
  logger.detail(`   생성된 토큰 (${chalk.dim('xapp-...')}) 복사`);
  logger.blank();
  logger.detail(`${chalk.cyan.bold('4.')} 토큰 등록`);
  logger.detail(`   ${chalk.magenta('clackbot login')}`);
  logger.blank();
  logger.detail(`${chalk.cyan.bold('5.')} 봇 시작`);
  logger.detail(`   ${chalk.magenta('clackbot start')}`);
}
