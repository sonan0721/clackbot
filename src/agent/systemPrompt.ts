import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/index.js';
import { loadSkills } from '../skills/loader.js';

// 시스템 프롬프트 생성 — CLAUDE.md + rules.md + 성격 preset

// 성격 preset 정의
const PERSONALITY_PRESETS: Record<string, string> = {
  professional: `응답 규칙:
- 짧고 명확하게 답변하세요
- 행동 지향적으로 답변하세요
- 기본 3~5줄
- 불릿 포인트를 활용하세요
- 이모지를 사용하지 마세요
- 한국어로 답변하세요`,

  friendly: `응답 규칙:
- 친근한 동료처럼 대화하세요
- 캐주얼한 톤을 사용하세요
- 이모지를 적절히 사용하세요 (1~2개)
- 격려와 공감 표현을 포함하세요
- 기본 3~8줄
- 한국어로 답변하세요`,

  detailed: `응답 규칙:
- 꼼꼼하고 상세하게 답변하세요
- 배경 설명을 포함하세요
- 단계별로 안내하세요
- 기본 5~15줄
- 이모지를 사용하지 마세요
- 한국어로 답변하세요`,
};

/**
 * 프로젝트 디렉토리에서 규칙 파일들을 읽어 시스템 프롬프트 구성
 * 우선순위: CLAUDE.md > rules.md > .clackbot/rules.md
 */
export function buildSystemPrompt(cwd: string): string {
  const parts: string[] = [];
  const config = loadConfig();

  // 성격 preset 적용
  const preset = config.personality?.preset ?? 'professional';
  let personalityPrompt: string;

  if (preset === 'custom' && config.personality?.customPrompt) {
    personalityPrompt = config.personality.customPrompt;
  } else {
    personalityPrompt = PERSONALITY_PRESETS[preset] ?? PERSONALITY_PRESETS.professional;
  }

  // 기본 Clackbot 역할 정의
  parts.push(`당신은 Clackbot이며, 사용자의 개인 Slack 비서입니다.
사용자를 대신하여 Slack 메시지를 작성하고 업무를 보조합니다.

${personalityPrompt}`);

  // cwd는 .clackbot/ 디렉토리
  // CLAUDE.md 읽기 (.clackbot/CLAUDE.md)
  const claudeMd = tryReadFile(path.join(cwd, 'CLAUDE.md'));
  if (claudeMd) {
    parts.push(`\n---\n# 프로젝트 규칙 (CLAUDE.md)\n${claudeMd}`);
  }

  // rules/ 폴더의 모든 .md 파일 읽기 (재귀)
  const rulesDir = path.join(cwd, 'rules');
  const ruleFiles = scanMdFiles(rulesDir);
  for (const ruleFile of ruleFiles) {
    const content = tryReadFile(ruleFile);
    const relativePath = path.relative(cwd, ruleFile);
    if (content) {
      parts.push(`\n---\n# 규칙 (${relativePath})\n${content}`);
    }
  }

  // 스킬 목록 추가
  const skills = loadSkills(cwd);
  if (skills.length > 0) {
    const skillList = skills.map(s => `- ${s.slug}: ${s.name}${s.description ? ` — ${s.description}` : ''}`).join('\n');
    parts.push(`\n---\n# 사용 가능한 스킬\n사용자가 특정 작업을 요청하면 해당 스킬의 지시를 따르세요:\n${skillList}\n\n스킬 상세 지시:\n${skills.map(s => `## [${s.slug}] ${s.name}\n${s.prompt}`).join('\n\n')}`);
  }

  // 메모리 읽기 (.clackbot/memory.md)
  const memory = tryReadFile(path.join(cwd, 'memory.md'));
  if (memory && memory.trim() !== '# Clackbot 메모리') {
    parts.push(`\n---\n# 메모리\n${memory}`);
  }

  return parts.join('\n');
}

/** 디렉토리에서 .md 파일 재귀 탐색 */
function scanMdFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanMdFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  } catch {
    // 읽기 실패 시 무시
  }
  return results.sort();
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
