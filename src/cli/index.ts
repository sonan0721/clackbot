import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { initCommand } from './init.js';
import { loginCommand } from './login.js';
import { startCommand } from './start.js';
import { doctorCommand } from './doctor.js';

// package.json에서 버전 읽기 — 빌드 후 경로가 달라지므로 상위로 탐색
function findPackageJson(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return path.resolve('package.json');
}
const pkg = JSON.parse(fs.readFileSync(findPackageJson(), 'utf-8'));

// CLI 프로그램 정의
const program = new Command();

program
  .name('clackbot')
  .description('개인 로컬 Slack 비서 — Claude Code 기반 Slack 에이전트')
  .version(pkg.version);

// init — 스캐폴딩
program
  .command('init')
  .description('프로젝트 초기화 (.clackbot/ 폴더, .env.example 생성)')
  .action(initCommand);

// login — Slack 토큰 설정
program
  .command('login')
  .description('Slack 토큰 설정 및 검증')
  .action(loginCommand);

// start — 봇 + 웹 대시보드 기동
program
  .command('start')
  .description('Slack 봇과 웹 대시보드를 시작합니다')
  .option('--no-web', '웹 대시보드 없이 봇만 시작')
  .option('--port <number>', '웹 대시보드 포트 지정', '3847')
  .option('--branch <name>', '업데이트 받을 Git 브랜치', 'main')
  .action(startCommand);

// doctor — 진단
program
  .command('doctor')
  .description('환경 및 설정 진단')
  .action(doctorCommand);

// config set — 설정 변경
program
  .command('config')
  .description('설정 관리')
  .command('set <key> <value>')
  .description('설정값 변경 (예: accessMode public)')
  .action(async (key: string, value: string) => {
    const { configSetCommand } = await import('./configSet.js');
    await configSetCommand(key, value);
  });

// tool 명령어 그룹
const toolCmd = program
  .command('tool')
  .description('플러그인 툴 관리');

toolCmd
  .command('list')
  .description('등록된 플러그인 목록')
  .action(async () => {
    const { toolListCommand } = await import('./toolCli.js');
    await toolListCommand();
  });

toolCmd
  .command('validate')
  .description('플러그인 JSON 검증')
  .action(async () => {
    const { toolValidateCommand } = await import('./toolCli.js');
    await toolValidateCommand();
  });

export function run(): void {
  program.parse();
}
