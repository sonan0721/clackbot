import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// .clackbot 디렉토리 경로 계산
// 프로젝트 로컬(.clackbot/) 우선, 없으면 홈 디렉토리(~/.clackbot/)

/** package.json을 상위로 탐색하여 찾기 */
function findPackageJson(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return path.resolve('package.json');
}

/** 앱 버전 (package.json에서 읽음) */
export const APP_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(findPackageJson(), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

/** 프로젝트 로컬 .clackbot 디렉토리 */
export function getLocalDir(cwd: string = process.cwd()): string {
  return path.join(cwd, '.clackbot');
}

/** 홈 디렉토리 .clackbot */
export function getGlobalDir(): string {
  return path.join(os.homedir(), '.clackbot');
}

/** config.json 경로 (로컬 우선) */
export function getConfigPath(cwd?: string): string {
  return path.join(getLocalDir(cwd), 'config.json');
}

/** memory.md 경로 */
export function getMemoryPath(cwd?: string): string {
  return path.join(getLocalDir(cwd), 'memory.md');
}

/** conversations.db 경로 */
export function getDbPath(cwd?: string): string {
  return path.join(getLocalDir(cwd), 'conversations.db');
}

/** rules 디렉토리 */
export function getRulesDir(cwd?: string): string {
  return path.join(getLocalDir(cwd), 'rules');
}

/** 플러그인 툴 디렉토리 (레거시 JSON) */
export function getToolsDir(cwd?: string): string {
  return path.join(getLocalDir(cwd), 'tools');
}

/** 플러그인 디렉토리 (통합 플러그인) */
export function getPluginsDir(cwd?: string): string {
  return path.join(getLocalDir(cwd), 'plugins');
}

/** 프로젝트 루트 디렉토리 (.clackbot의 상위) */
export function getProjectRoot(cwd?: string): string {
  return path.resolve(getLocalDir(cwd), '..');
}

/** Claude Code 스킬 디렉토리 */
export function getSkillsDir(cwd?: string): string {
  return path.join(getProjectRoot(cwd), '.claude', 'skills');
}

/** .env 파일 경로 */
export function getEnvPath(cwd: string = process.cwd()): string {
  return path.join(cwd, '.env');
}
