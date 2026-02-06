import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/index.js';

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

  // CLAUDE.md 읽기
  const claudeMd = tryReadFile(path.join(cwd, 'CLAUDE.md'));
  if (claudeMd) {
    parts.push(`\n---\n# 프로젝트 규칙 (CLAUDE.md)\n${claudeMd}`);
  }

  // rules.md 읽기
  const rulesMd = tryReadFile(path.join(cwd, 'rules.md'));
  if (rulesMd) {
    parts.push(`\n---\n# 추가 규칙 (rules.md)\n${rulesMd}`);
  }

  // .clackbot/rules.md 읽기
  const clackbotRules = tryReadFile(path.join(cwd, '.clackbot', 'rules.md'));
  if (clackbotRules) {
    parts.push(`\n---\n# Clackbot 규칙 (.clackbot/rules.md)\n${clackbotRules}`);
  }

  // 메모리 읽기
  const memory = tryReadFile(path.join(cwd, '.clackbot', 'memory.md'));
  if (memory && memory.trim() !== '# Clackbot 메모리') {
    parts.push(`\n---\n# 메모리\n${memory}`);
  }

  return parts.join('\n');
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
