import { loadConfig, saveConfig } from '../config/index.js';
import type { ProjectInfo } from './types.js';

// 멀티 프로젝트 CRUD

/** 프로젝트 목록 조회 */
export function listProjects(cwd?: string): ProjectInfo[] {
  const config = loadConfig(cwd);
  return config.projects;
}

/** 프로젝트 추가 */
export function addProject(project: Omit<ProjectInfo, 'slackChannels' | 'isDefault'> & Partial<ProjectInfo>, cwd?: string): ProjectInfo {
  const config = loadConfig(cwd);

  // 중복 ID 체크
  if (config.projects.some(p => p.id === project.id)) {
    throw new Error(`프로젝트 ID '${project.id}'가 이미 존재합니다.`);
  }

  const newProject: ProjectInfo = {
    id: project.id,
    directory: project.directory,
    slackChannels: project.slackChannels ?? [],
    isDefault: project.isDefault ?? config.projects.length === 0,
  };

  config.projects.push(newProject);
  saveConfig(config, cwd);
  return newProject;
}

/** 프로젝트에 Slack 채널 매핑 */
export function mapChannel(projectId: string, channelId: string, cwd?: string): void {
  const config = loadConfig(cwd);
  const project = config.projects.find(p => p.id === projectId);

  if (!project) {
    throw new Error(`프로젝트 '${projectId}'를 찾을 수 없습니다.`);
  }

  if (!project.slackChannels.includes(channelId)) {
    project.slackChannels.push(channelId);
    saveConfig(config, cwd);
  }
}

/** 프로젝트 삭제 */
export function removeProject(projectId: string, cwd?: string): void {
  const config = loadConfig(cwd);
  const idx = config.projects.findIndex(p => p.id === projectId);

  if (idx === -1) {
    throw new Error(`프로젝트 '${projectId}'를 찾을 수 없습니다.`);
  }

  config.projects.splice(idx, 1);
  saveConfig(config, cwd);
}

/** ID로 프로젝트 조회 */
export function getProject(projectId: string, cwd?: string): ProjectInfo | undefined {
  const config = loadConfig(cwd);
  return config.projects.find(p => p.id === projectId);
}

/** 기본 프로젝트 조회 */
export function getDefaultProject(cwd?: string): ProjectInfo | undefined {
  const config = loadConfig(cwd);
  return config.projects.find(p => p.isDefault) ?? config.projects[0];
}
