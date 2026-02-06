import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import { loadConfig, saveConfig } from '../config/index.js';
import { getLocalDir, getEnvPath } from '../config/paths.js';
import { createSlackApp, startSlackApp } from '../slack/app.js';
import { startWebServer } from '../web/server.js';
import { initDatabase, closeDatabase } from '../store/conversations.js';
import { setSlackClient } from '../agent/tools/builtin/slackPost.js';
import { setSharedSlackClient } from '../slack/client.js';
import { sessionManager } from '../session/manager.js';
import { logger } from '../utils/logger.js';

// clackbot start — Slack 봇 + 웹 대시보드 동시 기동

interface StartOptions {
  web?: boolean;
  port?: string;
  branch?: string;
}

// 자동 업데이트 확인 — git clone 설치 환경에서만 동작
async function checkForUpdates(branch: string): Promise<void> {
  // 실행 중인 바이너리 경로에서 설치 디렉토리 추론
  const binPath = fs.realpathSync(process.argv[1]);
  const installDir = path.resolve(path.dirname(binPath), '../..');
  const gitDir = path.join(installDir, '.git');

  if (!fs.existsSync(gitDir)) {
    logger.debug('Git 저장소가 아닌 환경입니다. 업데이트 확인을 건너뜁니다.');
    return;
  }

  try {
    logger.info('업데이트 확인 중...');

    // 원격 fetch
    execFileSync('git', ['fetch', 'origin', branch], {
      cwd: installDir,
      timeout: 15000,
      stdio: 'pipe',
    });

    // 로컬 HEAD vs 원격 HEAD 비교
    const local = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: installDir,
      encoding: 'utf-8',
    }).trim();
    const remote = execFileSync('git', ['rev-parse', `origin/${branch}`], {
      cwd: installDir,
      encoding: 'utf-8',
    }).trim();

    if (local === remote) {
      logger.success('최신 버전입니다.');
      return;
    }

    // 새 커밋 수 표시
    const count = execFileSync(
      'git',
      ['rev-list', '--count', `HEAD..origin/${branch}`],
      { cwd: installDir, encoding: 'utf-8' },
    ).trim();
    logger.info(`새 업데이트 발견 (${count}개 커밋). 업데이트 중...`);

    // 브랜치 전환 (필요시)
    const currentBranch = execFileSync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: installDir, encoding: 'utf-8' },
    ).trim();
    if (currentBranch !== branch) {
      execFileSync('git', ['checkout', branch], {
        cwd: installDir,
        timeout: 10000,
        stdio: 'pipe',
      });
    }

    // 원격 브랜치로 리셋
    execFileSync('git', ['reset', '--hard', `origin/${branch}`], {
      cwd: installDir,
      timeout: 10000,
      stdio: 'pipe',
    });

    // 의존성 설치 + 빌드
    logger.info('의존성 설치 중...');
    execFileSync('npm', ['install', '--no-fund', '--no-audit'], {
      cwd: installDir,
      timeout: 120000,
      stdio: 'pipe',
    });

    logger.info('빌드 중...');
    execFileSync('npm', ['run', 'build'], {
      cwd: installDir,
      timeout: 60000,
      stdio: 'pipe',
    });

    logger.success('업데이트 완료! 변경사항을 적용하려면 clackbot start를 다시 실행하세요.');
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`업데이트 확인 실패 (${msg}). 기존 버전으로 계속합니다.`);
  }
}

export async function startCommand(options: StartOptions): Promise<void> {
  const cwd = process.cwd();

  // .clackbot/ 존재 확인
  if (!fs.existsSync(getLocalDir(cwd))) {
    logger.error('.clackbot/ 디렉토리가 없습니다. 먼저 clackbot init을 실행하세요.');
    process.exit(1);
  }

  // 자동 업데이트 확인
  await checkForUpdates(options.branch || 'main');

  // Claude Code 설치 확인
  try {
    const version = execFileSync('claude', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    logger.success(`Claude Code 확인: ${version}`);
  } catch {
    logger.error('Claude Code가 설치되어 있지 않습니다.');
    logger.detail('설치: npm install -g @anthropic-ai/claude-code');
    process.exit(1);
  }

  // Claude Code 로그인 확인
  try {
    execFileSync('claude', ['-p', 'ping', '--max-turns', '1'], {
      encoding: 'utf-8',
      timeout: 30000,
    });
  } catch {
    logger.error('Claude Code에 로그인되어 있지 않습니다.');
    logger.detail('로그인: claude login');
    process.exit(1);
  }

  // .env 로드
  const envPath = getEnvPath(cwd);
  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath });
  }

  // 설정 로드
  const config = loadConfig(cwd);

  // 토큰 확인
  const botToken = config.slack.botToken || process.env.SLACK_BOT_TOKEN;
  const appToken = config.slack.appToken || process.env.SLACK_APP_TOKEN;

  if (!botToken || !appToken) {
    logger.error('Slack 토큰이 설정되지 않았습니다.');
    logger.detail('clackbot login을 실행하거나 .env 파일에 토큰을 설정하세요.');
    process.exit(1);
  }

  logger.info('Clackbot을 시작합니다...');
  logger.blank();

  // 대화 DB 초기화
  initDatabase(cwd);

  try {
    // Slack 앱 생성 및 시작
    const app = createSlackApp({ botToken, appToken });

    // Slack 클라이언트를 내장 도구 및 공유 싱글턴에 주입
    setSlackClient(app.client as unknown as Parameters<typeof setSlackClient>[0]);
    setSharedSlackClient(app.client);

    await startSlackApp(app);

    // 웹 대시보드 시작 (--no-web 옵션이 아닌 경우)
    const enableWeb = options.web !== false;
    if (enableWeb) {
      const port = parseInt(options.port || String(config.webPort), 10);
      await startWebServer(port);
    }

    // Slack auth.test로 실제 봇 이름 확인 및 config 동기화
    let botName = config.slack.botName || 'clackbot';
    try {
      const authRes = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
      });
      const authData = await authRes.json() as { ok: boolean; user?: string; team?: string };
      if (authData.ok && authData.user) {
        botName = authData.user;
        if (botName !== config.slack.botName || (authData.team && authData.team !== config.slack.teamName)) {
          config.slack.botName = botName;
          if (authData.team) config.slack.teamName = authData.team;
          saveConfig(config, cwd);
        }
      }
    } catch {
      // 네트워크 오류 시 기존 config 값 사용
    }

    logger.blank();
    logger.success(`봇 이름: @${botName} | 접근 모드: ${config.accessMode}`);
    if (enableWeb) {
      const port = parseInt(options.port || String(config.webPort), 10);
      logger.success(`대시보드: http://localhost:${port}`);
    }
    logger.blank();
    logger.info('종료하려면 Ctrl+C를 누르세요.');

    // Graceful shutdown
    const shutdown = async () => {
      logger.blank();
      logger.info('Clackbot을 종료합니다...');

      try {
        await app.stop();
        closeDatabase();
        sessionManager.clear();
        logger.success('정상 종료되었습니다.');
      } catch (error) {
        logger.error(`종료 중 오류: ${error instanceof Error ? error.message : String(error)}`);
      }

      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error(`시작 실패: ${error instanceof Error ? error.message : String(error)}`);
    closeDatabase();
    process.exit(1);
  }
}
