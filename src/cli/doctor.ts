import fs from 'node:fs';
import { loadConfig } from '../config/index.js';
import { getLocalDir, getConfigPath, getEnvPath, getToolsDir, getDbPath } from '../config/paths.js';
import { logger } from '../utils/logger.js';

// clackbot doctor — 환경/설정 진단

interface CheckResult {
  name: string;
  pass: boolean;
  message: string;
}

export async function doctorCommand(): Promise<void> {
  const cwd = process.cwd();
  const results: CheckResult[] = [];

  logger.info('Clackbot 환경 진단을 시작합니다...');
  logger.blank();

  // 1. Node.js 버전 확인
  const nodeVersion = process.versions.node;
  const nodeMajor = parseInt(nodeVersion.split('.')[0], 10);
  results.push({
    name: 'Node.js 버전',
    pass: nodeMajor >= 18,
    message: nodeMajor >= 18
      ? `v${nodeVersion} (18+ 필요)`
      : `v${nodeVersion} — Node.js 18 이상이 필요합니다`,
  });

  // 2. .clackbot/ 디렉토리 존재
  const localDir = getLocalDir(cwd);
  results.push({
    name: '.clackbot/ 디렉토리',
    pass: fs.existsSync(localDir),
    message: fs.existsSync(localDir)
      ? localDir
      : '없음 — clackbot init을 실행하세요',
  });

  // 3. config.json 존재 및 유효성
  const configPath = getConfigPath(cwd);
  let configValid = false;
  try {
    if (fs.existsSync(configPath)) {
      loadConfig(cwd);
      configValid = true;
    }
  } catch {
    configValid = false;
  }
  results.push({
    name: 'config.json',
    pass: configValid,
    message: configValid ? configPath : '없거나 유효하지 않음',
  });

  // 4. .env 파일 존재
  const envPath = getEnvPath(cwd);
  results.push({
    name: '.env 파일',
    pass: fs.existsSync(envPath),
    message: fs.existsSync(envPath) ? envPath : '없음',
  });

  // 5. Slack Bot Token
  const config = loadConfig(cwd);
  const hasBotToken = !!config.slack.botToken || !!process.env.SLACK_BOT_TOKEN;
  results.push({
    name: 'Slack Bot Token',
    pass: hasBotToken,
    message: hasBotToken ? '설정됨' : '없음 — clackbot login을 실행하세요',
  });

  // 6. Slack App Token
  const hasAppToken = !!config.slack.appToken || !!process.env.SLACK_APP_TOKEN;
  results.push({
    name: 'Slack App Token',
    pass: hasAppToken,
    message: hasAppToken ? '설정됨' : '없음 — clackbot login을 실행하세요',
  });

  // 7. Anthropic API Key
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  results.push({
    name: 'Anthropic API Key',
    pass: hasAnthropicKey,
    message: hasAnthropicKey ? '설정됨' : '없음 — .env에 ANTHROPIC_API_KEY를 설정하세요',
  });

  // 8. 봇 이름/ID 감지 여부
  const hasBotInfo = !!config.slack.botUserId;
  results.push({
    name: '봇 정보 (이름/ID)',
    pass: hasBotInfo,
    message: hasBotInfo
      ? `@${config.slack.botName} (${config.slack.botUserId})`
      : '없음 — clackbot login으로 설정하세요',
  });

  // 9. 플러그인 툴 디렉토리
  const toolsDir = getToolsDir(cwd);
  let toolCount = 0;
  if (fs.existsSync(toolsDir)) {
    const files = fs.readdirSync(toolsDir).filter(f => f.endsWith('.json'));
    toolCount = files.length;
  }
  results.push({
    name: '플러그인 툴',
    pass: true,  // 선택사항이므로 항상 통과
    message: fs.existsSync(toolsDir)
      ? `${toolCount}개 등록 (${toolsDir})`
      : '디렉토리 없음',
  });

  // 10. Slack 연결 테스트
  if (hasBotToken) {
    try {
      const token = config.slack.botToken || process.env.SLACK_BOT_TOKEN;
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json() as { ok: boolean; error?: string };
      results.push({
        name: 'Slack 연결',
        pass: data.ok,
        message: data.ok ? '연결 성공' : `실패: ${data.error}`,
      });
    } catch (error) {
      results.push({
        name: 'Slack 연결',
        pass: false,
        message: `연결 실패: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // 결과 출력
  logger.blank();
  let passCount = 0;
  let failCount = 0;

  for (const result of results) {
    if (result.pass) {
      passCount++;
      logger.success(`${result.name}: ${result.message}`);
    } else {
      failCount++;
      logger.error(`${result.name}: ${result.message}`);
    }
  }

  logger.blank();
  if (failCount === 0) {
    logger.success(`모든 검사 통과! (${passCount}/${results.length})`);
  } else {
    logger.warn(`${passCount}/${results.length} 통과, ${failCount}개 실패`);
  }
}
