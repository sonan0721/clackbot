import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

// 프로젝트 컨텍스트 공유 — 로컬 Claude Code와 같은 CLAUDE.md + 메모리를 Slack에서 활용

export interface ProjectContext {
  projectName: string;
  claudeMd: string | null;
  memory: string | null;
  projectPath: string;
}

export interface ParsedProjectTag {
  tag: string;
  cleanPrompt: string;
}

/**
 * 메시지에서 프로젝트 태그 추출: "[dev] API 추가해줘" → { tag: "dev", cleanPrompt: "API 추가해줘" }
 * 태그 없으면 null 반환
 */
export function parseProjectTag(text: string): ParsedProjectTag | null {
  const match = text.match(/^\[(\w+)\]\s*/);
  if (!match) return null;
  return {
    tag: match[1],
    cleanPrompt: text.slice(match[0].length),
  };
}

/**
 * 프로젝트 경로 → Claude Code 프로젝트 해시 변환
 * /Users/al02528308/Documents/Git/clackbot → -Users-al02528308-Documents-Git-clackbot
 */
export function projectPathToHash(projectPath: string): string {
  const resolved = path.resolve(projectPath);
  return resolved.replace(/\//g, '-');
}

/**
 * 프로젝트 경로에서 CLAUDE.md + Claude Code 메모리를 로드
 */
export function loadProjectContext(projectName: string, projectPath: string): ProjectContext {
  const resolved = path.resolve(projectPath);

  // 1. CLAUDE.md 탐색
  let claudeMd: string | null = null;
  const claudeMdPaths = [
    path.join(resolved, 'CLAUDE.md'),
    path.join(resolved, '.claude', 'CLAUDE.md'),
  ];
  for (const p of claudeMdPaths) {
    claudeMd = tryReadFile(p);
    if (claudeMd) break;
  }

  // 2. Claude Code 프로젝트 메모리 (~/.claude/projects/{hash}/memory/MEMORY.md)
  let memory: string | null = null;
  const hash = projectPathToHash(resolved);
  const memoryPath = path.join(os.homedir(), '.claude', 'projects', hash, 'memory', 'MEMORY.md');
  memory = tryReadFile(memoryPath);

  if (claudeMd || memory) {
    logger.debug(`프로젝트 컨텍스트 로드: ${projectName} — CLAUDE.md: ${claudeMd ? '있음' : '없음'}, 메모리: ${memory ? '있음' : '없음'}`);
  }

  return { projectName, claudeMd, memory, projectPath: resolved };
}

/**
 * 프로젝트 태그 → ProjectContext 전체 파이프라인
 * 태그가 없거나 등록 안 된 프로젝트면 null + 오류 메시지 반환
 */
export function resolveProjectContext(text: string): {
  context: ProjectContext | null;
  cleanPrompt: string;
  error?: string;
} {
  const parsed = parseProjectTag(text);
  if (!parsed) return { context: null, cleanPrompt: text };

  const config = loadConfig();
  const projects = config.projects || {};
  const project = projects[parsed.tag];

  if (!project) {
    const available = Object.keys(projects);
    const hint = available.length > 0
      ? `등록된 프로젝트: ${available.map(n => `[${n}]`).join(', ')}`
      : '등록된 프로젝트가 없습니다. 대시보드에서 프로젝트를 등록하세요.';
    return {
      context: null,
      cleanPrompt: parsed.cleanPrompt,
      error: `프로젝트 [${parsed.tag}]를 찾을 수 없습니다. ${hint}`,
    };
  }

  // 경로 존재 여부 확인
  if (!fs.existsSync(project.path)) {
    return {
      context: null,
      cleanPrompt: parsed.cleanPrompt,
      error: `프로젝트 [${parsed.tag}]의 경로가 존재하지 않습니다: ${project.path}`,
    };
  }

  const context = loadProjectContext(parsed.tag, project.path);
  return { context, cleanPrompt: parsed.cleanPrompt };
}

/**
 * 프로젝트의 CLAUDE.md / 메모리 존재 여부 확인 (대시보드 API용)
 */
export function checkProjectStatus(projectPath: string): {
  pathExists: boolean;
  hasClaudeMd: boolean;
  hasMemory: boolean;
} {
  const resolved = path.resolve(projectPath);
  if (!fs.existsSync(resolved)) {
    return { pathExists: false, hasClaudeMd: false, hasMemory: false };
  }

  const hasClaudeMd = fs.existsSync(path.join(resolved, 'CLAUDE.md'))
    || fs.existsSync(path.join(resolved, '.claude', 'CLAUDE.md'));

  const hash = projectPathToHash(resolved);
  const memoryPath = path.join(os.homedir(), '.claude', 'projects', hash, 'memory', 'MEMORY.md');
  const hasMemory = fs.existsSync(memoryPath);

  return { pathExists: true, hasClaudeMd, hasMemory };
}

function tryReadFile(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // 읽기 실패 시 무시
  }
  return null;
}
