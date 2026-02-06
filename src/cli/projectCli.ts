import path from 'node:path';
import { addProject, listProjects, mapChannel } from '../projects/registry.js';
import { logger } from '../utils/logger.js';

// clackbot project add/list/map — 프로젝트 관리 CLI

export async function projectAddCommand(id: string, directory: string): Promise<void> {
  try {
    const absDir = path.resolve(directory);
    const project = addProject({ id, directory: absDir });
    logger.success(`프로젝트 '${project.id}' 등록 완료`);
    logger.detail(`디렉토리: ${project.directory}`);
    if (project.isDefault) {
      logger.detail('(기본 프로젝트로 설정됨)');
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export async function projectListCommand(): Promise<void> {
  const projects = listProjects();

  if (projects.length === 0) {
    logger.info('등록된 프로젝트가 없습니다.');
    logger.detail('clackbot project add <id> <directory> 로 프로젝트를 추가하세요.');
    return;
  }

  logger.info(`등록된 프로젝트 (${projects.length}개):`);
  logger.blank();

  for (const p of projects) {
    const defaultTag = p.isDefault ? ' [기본]' : '';
    logger.detail(`${p.id}${defaultTag}`);
    logger.detail(`  디렉토리: ${p.directory}`);
    if (p.slackChannels.length > 0) {
      logger.detail(`  채널: ${p.slackChannels.join(', ')}`);
    }
  }
}

export async function projectMapCommand(id: string, channelId: string): Promise<void> {
  try {
    mapChannel(id, channelId);
    logger.success(`프로젝트 '${id}'에 채널 '${channelId}' 매핑 완료`);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
