import { loadConfig } from '../config/index.js';
import type { ProjectInfo } from './types.js';

// 채널 → 프로젝트 매핑 해석

/** Slack 채널 ID로 프로젝트 조회 */
export function resolveProject(channelId: string, cwd?: string): ProjectInfo | undefined {
  const config = loadConfig(cwd);
  const { projects } = config;

  if (projects.length === 0) return undefined;

  // 채널에 매핑된 프로젝트 찾기
  const mapped = projects.find(p => p.slackChannels.includes(channelId));
  if (mapped) return mapped;

  // 매핑 없으면 기본 프로젝트 반환
  return projects.find(p => p.isDefault) ?? projects[0];
}
