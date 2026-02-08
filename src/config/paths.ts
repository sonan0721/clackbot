import path from 'node:path';
import os from 'node:os';

// .clackbot 디렉토리 경로 계산
// 프로젝트 로컬(.clackbot/) 우선, 없으면 홈 디렉토리(~/.clackbot/)

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

/** 플러그인 툴 디렉토리 (레거시 JSON) */
export function getToolsDir(cwd?: string): string {
  return path.join(getLocalDir(cwd), 'tools');
}

/** 플러그인 디렉토리 (통합 플러그인) */
export function getPluginsDir(cwd?: string): string {
  return path.join(getLocalDir(cwd), 'plugins');
}

/** .env 파일 경로 */
export function getEnvPath(cwd: string = process.cwd()): string {
  return path.join(cwd, '.env');
}
