import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import { loadConfig, saveConfig } from '../config/index.js';
import { getLocalDir, getEnvPath, APP_VERSION } from '../config/paths.js';
import { fileURLToPath } from 'node:url';
import { createSlackApp, startSlackApp } from '../slack/app.js';
import { startWebServer } from '../web/server.js';
import { initDatabase, closeDatabase } from '../store/conversations.js';
import { setSlackClient } from '../agent/tools/builtin/slackPost.js';
import { setSlackClientForDm } from '../agent/tools/builtin/slackSendDm.js';
import { setSharedSlackClient } from '../slack/client.js';
import semver from 'semver';
import { logger } from '../utils/logger.js';

// clackbot start — Slack 봇 + 웹 대시보드 동시 기동

// Windows에서 npm, git 등 .cmd 파일을 찾으려면 shell: true 필요
const isWindows = process.platform === 'win32';
const shellOpt: Pick<ExecFileSyncOptions, 'shell'> = isWindows ? { shell: true } : {};

interface StartOptions {
  web?: boolean;
  port?: string;
  branch?: string;
}

// 기본 파일 확인 및 생성
function ensureDefaultFiles(localDir: string): void {
  // CLAUDE.md
  const claudeMd = path.join(localDir, 'CLAUDE.md');
  if (!fs.existsSync(claudeMd)) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const templatePath = path.resolve(__dirname, '../../templates/CLAUDE.md');
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, claudeMd);
    } else {
      fs.writeFileSync(claudeMd, '# 봇 규칙\n\n이 파일을 수정하여 봇의 동작을 커스터마이즈하세요.\n', 'utf-8');
    }
    logger.info('.clackbot/CLAUDE.md 생성됨');
  }

  // rules/ 디렉토리
  const rulesDir = path.join(localDir, 'rules');
  if (!fs.existsSync(rulesDir)) {
    fs.mkdirSync(rulesDir, { recursive: true });
  }

  // .claude/skills/ 디렉토리
  const skillsDir = path.join(localDir, '..', '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

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
      ...shellOpt,
    });

    // 로컬 버전 읽기
    let localVersion = '0.0.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(installDir, 'package.json'), 'utf-8'));
      localVersion = pkg.version || '0.0.0';
    } catch { /* 무시 */ }

    // 원격 package.json에서 버전 읽기
    let remoteVersion = '0.0.0';
    try {
      const remotePkg = execFileSync(
        'git',
        ['show', `origin/${branch}:package.json`],
        { cwd: installDir, encoding: 'utf-8', ...shellOpt },
      );
      remoteVersion = JSON.parse(remotePkg).version || '0.0.0';
    } catch { /* 무시 */ }

    // semver 비교: 원격이 더 높을 때만 업데이트
    if (!semver.gt(remoteVersion, localVersion)) {
      logger.success(`최신 버전입니다. (v${localVersion})`);
      return;
    }

    logger.info(`새 버전 발견 (v${localVersion} → v${remoteVersion}). 업데이트 중...`);

    // 브랜치 전환 (필요시)
    const currentBranch = execFileSync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: installDir, encoding: 'utf-8', ...shellOpt },
    ).trim();
    if (currentBranch !== branch) {
      execFileSync('git', ['checkout', branch], {
        cwd: installDir,
        timeout: 10000,
        stdio: 'pipe',
        ...shellOpt,
      });
    }

    // 원격 브랜치로 리셋
    execFileSync('git', ['reset', '--hard', `origin/${branch}`], {
      cwd: installDir,
      timeout: 10000,
      stdio: 'pipe',
      ...shellOpt,
    });

    // 의존성 설치 + 빌드
    logger.info('의존성 설치 중...');
    execFileSync('npm', ['install', '--no-fund', '--no-audit'], {
      cwd: installDir,
      timeout: 120000,
      stdio: 'pipe',
      ...shellOpt,
    });

    logger.info('빌드 중...');
    execFileSync('npm', ['run', 'build'], {
      cwd: installDir,
      timeout: 60000,
      stdio: 'pipe',
      ...shellOpt,
    });

    logger.success(`업데이트 완료! (v${localVersion} → v${remoteVersion}) 변경사항을 적용하려면 clackbot start를 다시 실행하세요.`);
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`업데이트 확인 실패 (${msg}). 기존 버전으로 계속합니다.`);
  }
}

/** 포트를 사용 중인 프로세스(PID)를 찾아 종료 */
async function killExistingProcess(port: number): Promise<void> {
  if (isWindows) {
    try {
      const result = execFileSync('netstat', ['-ano'], { encoding: 'utf-8', shell: true });
      const lines = result.split('\n').filter(l => l.includes(`:${port}`) && l.includes('LISTENING'));
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid)) {
          logger.info(`기존 프로세스(PID ${pid}, 포트 ${port}) 종료 중...`);
          execFileSync('taskkill', ['/F', '/PID', pid], { shell: true, stdio: 'pipe' });
        }
      }
    } catch { /* 실패 시 무시 */ }
  } else {
    try {
      const result = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf-8', timeout: 5000 });
      const pids = result.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        logger.info(`기존 프로세스(PID ${pid}, 포트 ${port}) 종료 중...`);
        try {
          process.kill(Number(pid), 'SIGTERM');
        } catch { /* 이미 종료됨 */ }
      }
      // 종료 대기 (최대 3초)
      if (pids.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch { /* lsof 결과 없음 = 포트 미사용 */ }
  }
}

export async function startCommand(options: StartOptions): Promise<void> {
  const cwd = process.cwd();

  // .clackbot/ 존재 확인
  const localDir = getLocalDir(cwd);
  if (!fs.existsSync(localDir)) {
    logger.error('.clackbot/ 디렉토리가 없습니다. 먼저 clackbot init을 실행하세요.');
    process.exit(1);
  }

  // 기본 파일 확인 및 생성 (CLAUDE.md, rules/)
  ensureDefaultFiles(localDir);

  // 자동 업데이트 확인
  await checkForUpdates(options.branch || 'main');

  // Claude Code 설치 확인
  try {
    const version = execFileSync('claude', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
      ...shellOpt,
    }).trim();
    logger.success(`Claude Code 확인: ${version}`);
  } catch {
    logger.error('Claude Code가 설치되어 있지 않습니다.');
    logger.detail('설치 가이드: https://code.claude.com/docs/ko/setup');
    process.exit(1);
  }

  // Claude Code 로그인 확인
  try {
    execFileSync('claude', ['-p', 'ping', '--max-turns', '1'], {
      encoding: 'utf-8',
      timeout: 30000,
      ...shellOpt,
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

  logger.info(`${config.slack?.botName || 'Clackbot'} v${APP_VERSION}을 시작합니다...`);
  logger.blank();

  // 대화 DB 초기화
  initDatabase(cwd);

  try {
    // Slack 앱 생성 및 시작
    const app = createSlackApp({ botToken, appToken });

    // Slack 클라이언트를 내장 도구 및 공유 싱글턴에 주입
    setSlackClient(app.client as unknown as Parameters<typeof setSlackClient>[0]);
    setSlackClientForDm(app.client as unknown as Parameters<typeof setSlackClientForDm>[0]);
    setSharedSlackClient(app.client);

    await startSlackApp(app);

    // 웹 대시보드 시작 (--no-web 옵션이 아닌 경우)
    const enableWeb = options.web !== false;
    if (enableWeb) {
      const port = parseInt(options.port || String(config.webPort), 10);
      // 기존 프로세스가 포트를 점유하고 있으면 종료
      await killExistingProcess(port);
      await startWebServer(port);
    }

    // Slack API로 실제 봇 표시 이름 확인 및 config 동기화
    let botName = config.slack.botName || 'clackbot';
    try {
      const authRes = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
      });
      const authData = await authRes.json() as { ok: boolean; user_id?: string; user?: string; team?: string };
      if (authData.ok) {
        // users.info로 실제 표시 이름 조회
        let resolvedName = authData.user ?? botName;
        if (authData.user_id) {
          try {
            const userRes = await fetch(`https://slack.com/api/users.info?user=${authData.user_id}`, {
              headers: { 'Authorization': `Bearer ${botToken}` },
            });
            const userData = await userRes.json() as {
              ok: boolean;
              user?: { real_name?: string; profile?: { display_name?: string } };
            };
            if (userData.ok && userData.user) {
              const displayName = userData.user.profile?.display_name || userData.user.real_name;
              if (displayName) resolvedName = displayName;
            }
          } catch {
            // users.info 실패 시 auth.test 값 사용
          }
        }
        botName = resolvedName;
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
    logger.success(`봇 이름: @${botName}`);
    if (enableWeb) {
      const port = parseInt(options.port || String(config.webPort), 10);
      logger.success(`대시보드: http://localhost:${port}`);
    }
    logger.blank();
    logger.info('종료하려면 Ctrl+C를 누르세요.');

    // Owner에게 시작 알림 DM 전송
    if (config.ownerUserId) {
      try {
        const dmOpen = await app.client.conversations.open({ users: config.ownerUserId });
        if (dmOpen.ok && dmOpen.channel?.id) {
          const port = parseInt(options.port || String(config.webPort), 10);
          const webInfo = enableWeb ? `http://localhost:${port}` : '비활성';

          // MCP 서버 목록
          const mcpNames = Object.keys(config.mcpServers || {});
          const mcpInfo = mcpNames.length > 0
            ? mcpNames.join(', ')
            : '없음';

          const startupMsg = [
            `:white_check_mark: *${botName} v${APP_VERSION} 시작됨*`,
            '',
            '*현재 설정*',
            `• 성격 프리셋: \`${config.personality?.preset ?? 'istj'}\``,
            `• 세션: 최대 ${config.session?.maxMessages ?? 50}개 메시지 / ${config.session?.timeoutMinutes ?? 30}분 타임아웃`,
            `• 대시보드: ${webInfo}`,
            `• MCP 서버: ${mcpInfo}`,
            '',
            '*DM으로 할 수 있는 것들*',
            '• 설정 변경 — "성격을 enfp로 바꿔줘", "세션 타임아웃을 60분으로 변경해줘"',
            '• MCP 서버 관리 — "Trello MCP 서버 설치해줘", "MCP 서버 목록 보여줘"',
            '• 규칙 편집 — "CLAUDE.md 보여줘", "응답 규칙에 이모지 금지 추가해줘"',
            '• 스킬 관리 — "새 스킬 만들어줘", "스킬 목록 보여줘"',
            '• 파일/이미지 공유 — 파일을 첨부하면 내용을 확인할 수 있어요',
            '• 채널에 메시지 전송 — "general 채널에 회의 안내 보내줘"',
            '',
            '무엇이든 DM으로 요청하세요.',
          ].join('\n');

          await app.client.chat.postMessage({
            channel: dmOpen.channel.id,
            text: startupMsg,
          });
          logger.success('Owner에게 시작 알림 DM 전송됨');
        }
      } catch (err) {
        logger.warn(`Owner DM 전송 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Graceful shutdown
    const shutdown = async () => {
      logger.blank();
      logger.info('봇을 종료합니다...');

      try {
        await app.stop();
        closeDatabase();
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
