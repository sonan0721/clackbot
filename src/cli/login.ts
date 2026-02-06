import fs from 'node:fs';
import { input, password } from '@inquirer/prompts';
import { loadConfig, saveConfig } from '../config/index.js';
import { getEnvPath, getLocalDir } from '../config/paths.js';
import { logger } from '../utils/logger.js';

// clackbot login — Slack 토큰 설정 및 검증
export async function loginCommand(): Promise<void> {
  const cwd = process.cwd();

  // .clackbot/ 존재 확인
  if (!fs.existsSync(getLocalDir(cwd))) {
    logger.error('.clackbot/ 디렉토리가 없습니다. 먼저 clackbot init을 실행하세요.');
    process.exit(1);
  }

  logger.info('Slack 토큰을 설정합니다.');
  logger.detail('Slack 앱 설정 페이지: https://api.slack.com/apps');
  logger.blank();

  // Bot Token 입력
  const botToken = await password({
    message: 'Slack Bot Token (xoxb-...):',
    validate: (val) => {
      if (!val.startsWith('xoxb-')) return 'Bot Token은 xoxb-로 시작해야 합니다.';
      return true;
    },
  });

  // App Token 입력
  const appToken = await password({
    message: 'Slack App Token (xapp-...):',
    validate: (val) => {
      if (!val.startsWith('xapp-')) return 'App Token은 xapp-로 시작해야 합니다.';
      return true;
    },
  });

  // Anthropic API Key 입력 (선택)
  const anthropicKey = await password({
    message: 'Anthropic API Key (선택, Enter로 건너뛰기):',
  });

  // auth.test로 Slack 토큰 검증
  logger.blank();
  logger.info('Slack 토큰을 검증하는 중...');

  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json() as {
      ok: boolean;
      error?: string;
      user_id?: string;
      bot_id?: string;
      team_id?: string;
      team?: string;
      user?: string;
    };

    if (!data.ok) {
      logger.error(`Slack 인증 실패: ${data.error}`);
      process.exit(1);
    }

    const botUserId = data.user_id!;
    const botName = data.user ?? 'clackbot';
    const teamId = data.team_id ?? '';
    const teamName = data.team ?? '';

    logger.success(`인증 성공!`);
    logger.detail(`봇 이름: @${botName}`);
    logger.detail(`봇 ID: ${botUserId}`);
    logger.detail(`워크스페이스: ${teamName} (${teamId})`);

    // config.json 업데이트
    const config = loadConfig(cwd);
    config.slack = {
      botToken,
      appToken,
      botUserId,
      botName,
      teamId,
      teamName,
    };

    // 소유자 감지 — auth.test의 user_id를 소유자로 설정
    // (봇 토큰이므로 봇의 user_id가 됨, 실제 소유자는 설치한 사용자)
    // 소유자 ID는 나중에 설정에서 수동 지정 가능

    saveConfig(config, cwd);
    logger.success('config.json에 Slack 설정 저장 완료');

    // .env 파일 생성/업데이트
    const envPath = getEnvPath(cwd);
    const envLines: string[] = [];
    envLines.push(`SLACK_BOT_TOKEN=${botToken}`);
    envLines.push(`SLACK_APP_TOKEN=${appToken}`);
    if (anthropicKey) {
      envLines.push(`ANTHROPIC_API_KEY=${anthropicKey}`);
    }
    envLines.push('');

    fs.writeFileSync(envPath, envLines.join('\n'), 'utf-8');
    logger.success('.env 파일 저장 완료');

    logger.blank();
    logger.info('다음 단계:');
    logger.detail('clackbot start  — 봇과 대시보드를 시작합니다');

  } catch (error) {
    logger.error(`Slack API 호출 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
