import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, type ClackbotConfig } from '../config/index.js';
import { getSkillsDir } from '../config/paths.js';
import type { ProjectContext } from './projectContext.js';
// 시스템 프롬프트 생성 — CLAUDE.md + rules.md + 성격 preset + toolGuide + 프로젝트 컨텍스트

// MBTI 성격 프리셋 정의 (16유형, 압축)
const PERSONALITY_PRESETS: Record<string, string> = {
  // ─── 분석가 (Analysts, NT) ───
  intj: '성격: INTJ. 논리적·간결·직접적. 핵심만 체계적으로 정리. 3~5줄, 이모지 없음, 한국어.',
  intp: '성격: INTP. 정밀·분석적. 논리적 근거와 여러 관점 제시. 3~7줄, 이모지 없음, 한국어.',
  entj: '성격: ENTJ. 단호·자신감. 결론과 행동 지침 먼저, 효율 중심. 3~5줄, 이모지 없음, 한국어.',
  entp: '성격: ENTP. 창의적·위트. 새로운 아이디어와 대안 적극 제시. 3~8줄, 이모지 가능, 한국어.',

  // ─── 외교관 (Diplomats, NF) ───
  infj: '성격: INFJ. 사려깊은 통찰. 공감하면서 본질적 의미 전달, 부드럽고 명확. 3~7줄, 이모지 최소, 한국어.',
  infp: '성격: INFP. 따뜻·공감적. 감정 인정 후 이상적 방향 제시, 격려하는 톤. 3~8줄, 이모지 가능, 한국어.',
  enfj: '성격: ENFJ. 따뜻한 리더십. 격려·영감·칭찬, 팀 조화 강조. 3~8줄, 이모지 적절히, 한국어.',
  enfp: '성격: ENFP. 에너지·열정. 밝고 캐주얼, 창의적 아이디어와 긍정 에너지. 3~8줄, 이모지 자주, 한국어.',

  // ─── 관리자 (Sentinels, SJ) ───
  istj: '성격: ISTJ. 정확·체계적·신뢰. 사실 기반, 핵심만 전달, 기한 명확. 3~5줄, 이모지 없음, 한국어.',
  isfj: '성격: ISFJ. 따뜻·세심. 필요한 것 미리 챙기고 안정감 있는 톤. 3~7줄, 이모지 소량, 한국어.',
  estj: '성격: ESTJ. 결단력·체계. 규칙과 절차 명확, 직설적·당당. 3~5줄, 이모지 없음, 한국어.',
  esfj: '성격: ESFJ. 친근·사교적. 배려와 협력 강조, 실용적 도움 제안. 3~8줄, 이모지 적절히, 한국어.',

  // ─── 탐험가 (Explorers, SP) ───
  istp: '성격: ISTP. 실용·직접적. 문제 해결 핵심만, 담백하고 꾸밈없는 톤. 2~4줄, 이모지 없음, 한국어.',
  isfp: '성격: ISFP. 부드럽·배려. 공감하면서 실용적 도움, 창의적 접근 제안. 3~6줄, 이모지 소량, 한국어.',
  estp: '성격: ESTP. 직설·에너지. 즉각 실행 가능한 방안, 핵심만 빠르게. 2~5줄, 이모지 없음, 한국어.',
  esfp: '성격: ESFP. 밝고 유쾌. 친근한 톤, 재미있고 실용적 해결책. 3~7줄, 이모지 자주, 한국어.',
};

// ─── 동적 상태 스캔 헬퍼 ───

/** config.mcpServers에서 설치된 MCP 서버 이름/커맨드 목록 */
function listMcpServers(config: ClackbotConfig): string {
  const servers = config.mcpServers || {};
  const names = Object.keys(servers);
  if (names.length === 0) return '없음';
  return names
    .map((name) => {
      const s = servers[name];
      if (s.type === 'sse' || s.type === 'http') {
        return `\`${name}\` (${s.type}: ${s.url})`;
      }
      return `\`${name}\` (${s.command} ${s.args.join(' ')})`;
    })
    .join(', ');
}

/** rules/ 디렉토리의 .md 파일 목록 */
function listRuleFiles(cwd: string): string {
  const rulesDir = path.join(cwd, 'rules');
  const files = scanMdFiles(rulesDir);
  if (files.length === 0) return '없음';
  return files.map((f) => `\`${path.relative(cwd, f)}\``).join(', ');
}

/** .claude/skills/{name}/SKILL.md 스캔, 이름/설명 추출 */
function listSkills(projectRoot: string): string {
  const skillsDir = path.join(projectRoot, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) return '없음';

  const entries: string[] = [];
  try {
    const dirs = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const skillMd = path.join(skillsDir, dir.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const content = fs.readFileSync(skillMd, 'utf-8');
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      const descMatch = content.match(/^description:\s*(.+)$/m);
      const name = nameMatch?.[1]?.trim() ?? dir.name;
      const desc = descMatch?.[1]?.trim() ?? '';
      entries.push(desc ? `\`${name}\` — ${desc}` : `\`${name}\``);
    }
  } catch {
    // 읽기 실패 시 무시
  }

  return entries.length > 0 ? entries.join('\n  ') : '없음';
}

/** toolGuide를 시스템 프롬프트 섹션으로 변환 */
function buildToolGuideSection(config: ClackbotConfig): string {
  const guide = config.toolGuide;
  if (!guide) return '';

  const hasInstructions = guide.instructions?.trim();
  const hasServers = guide.servers && Object.keys(guide.servers).length > 0;

  if (!hasInstructions && !hasServers) return '';

  const parts: string[] = ['\n## 도구 사용 가이드'];

  if (hasInstructions) {
    parts.push(guide.instructions!.trim());
  }

  if (hasServers) {
    const highPriority: string[] = [];
    const normalPriority: string[] = [];

    for (const [name, server] of Object.entries(guide.servers!)) {
      const line = server.useWhen
        ? `- \`${name}\`: ${server.description} — ${server.useWhen}`
        : `- \`${name}\`: ${server.description}`;

      if (server.priority === 'high') {
        highPriority.push(line);
      } else {
        normalPriority.push(line);
      }
    }

    if (highPriority.length > 0) {
      parts.push(`\n⚠️ 우선 사용 도구 (요청과 관련되면 반드시 사용):\n${highPriority.join('\n')}`);
    }
    if (normalPriority.length > 0) {
      parts.push(`\n기타 도구:\n${normalPriority.join('\n')}`);
    }
  }

  return parts.join('\n');
}

/** DM 감독 모드 프롬프트 섹션 생성 (간소화) */
function buildDmSection(cwd: string, projectRoot: string, config: ClackbotConfig): string {
  const configPath = path.join(cwd, 'config.json');
  const skillsPath = path.join(projectRoot, '.claude', 'skills');

  return `\n## DM 감독 모드

Owner가 DM으로 직접 감독 중입니다.

현재 상태: 규칙 ${listRuleFiles(cwd)} | 스킬 ${listSkills(projectRoot)} | MCP ${listMcpServers(config)}

### 관리 기능
- MCP 서버: config.json(${configPath})에서 mcpServers 추가/제거. 재시작 없이 다음 메시지부터 적용
- 규칙: ${cwd}/rules/*.md 생성/수정/삭제, ${cwd}/CLAUDE.md 직접 수정
- 스킬: ${skillsPath}/ 에 SKILL.md 생성/수정/삭제
- 도구 가이드: config.json의 toolGuide 섹션에서 MCP 도구 설명/우선도 설정

⚠️ MCP 도구를 못 찾으면 "재시작 필요" 안내 금지 — 서버 설정(URL, 인증, command)을 확인하세요

글로벌 규칙:
- config.json을 직접 편집하라고 안내 대신 직접 수정
- 파일/이미지 Read 도구로 확인 가능
- DM에서 Owner에게 먼저 메시지 가능 (slack_send_dm)

⛔ 절대 금지: clackbot CLI 실행, 봇 프로세스 kill/재시작 — 설정 변경 후 재시작이 필요하면 사용자에게 안내`;
}

/**
 * 프로젝트 디렉토리에서 규칙 파일들을 읽어 시스템 프롬프트 구성
 * 우선순위: CLAUDE.md > rules.md > .clackbot/rules.md
 */
export function buildSystemPrompt(cwd: string, context: 'dm' | 'mention' | 'channel' = 'mention', projectContext?: ProjectContext): string {
  const parts: string[] = [];
  const config = loadConfig();
  const botName = config.slack?.botName || '비서봇';

  if (context === 'channel') {
    parts.push(`당신은 ${botName}이며, Slack 채널에서 캐주얼하게 대화하는 비서입니다.
채널 규칙: 1~3줄 캐주얼 응답. 도구 사용 불가. 복잡한 작업은 "스레드나 DM으로 요청해 주세요" 안내. 한국어.`);
  } else {
    const preset = config.personality?.preset ?? 'istj';
    let personalityPrompt: string;

    if (preset === 'custom' && config.personality?.customPrompt) {
      personalityPrompt = config.personality.customPrompt;
    } else {
      personalityPrompt = PERSONALITY_PRESETS[preset] ?? PERSONALITY_PRESETS.istj;
    }

    parts.push(`당신은 ${botName}이며, 사용자의 개인 Slack 비서입니다.
사용자를 대신하여 Slack 메시지를 작성하고 업무를 보조합니다.

${personalityPrompt}

## 메시지 구분
- \`[🤖 앱(...)]\`: 봇/앱 메시지. \`[👤 사용자(...)]\`: 사람 메시지.
- \`현재 메시지\` 아래가 지금 응답할 최신 요청입니다.`);

    // toolGuide 주입 (channel 제외)
    const toolGuideSection = buildToolGuideSection(config);
    if (toolGuideSection) {
      parts.push(toolGuideSection);
    }

  }

  // 컨텍스트별 규칙
  if (context === 'dm') {
    const projectRoot = path.resolve(cwd, '..');
    parts.push(buildDmSection(cwd, projectRoot, config));
  } else if (context === 'mention') {
    parts.push(`\n글로벌 규칙:
- config.json 직접 편집 안내 금지 — Owner DM으로 안내
- MCP 도구를 못 찾으면 "재시작 필요" 안내 금지 — Owner DM으로 확인 요청 안내`);
  }

  // Slack mrkdwn 포맷 규칙 — 모든 컨텍스트 공통
  parts.push(`\n## Slack 포맷
Slack mrkdwn 문법 사용. 굵게: *텍스트*, 기울임: _텍스트_, 취소선: ~텍스트~, 링크: <URL|텍스트>, 코드: \`코드\`, 코드블록: \`\`\`코드\`\`\`, 인용: > 텍스트. 제목(#)은 *굵은 텍스트*로 대체.
Markdown 문법(**굵게**, [링크](url), ### 제목) 사용 금지.`);

  // 보안 규칙 — 모든 컨텍스트 공통
  parts.push(`\n## 보안
- 인프라 정보(URL, 포트, 설정, API 키, 토큰)는 Owner DM에서만 공유
- slack_send_dm은 Owner에게만 전송 가능
- 비Owner에게 봇 내부 구조/설정/관리 방법 비공개`);

  // 메모리 정책 — 모든 컨텍스트 공통
  parts.push(`\n## 메모리 정책
- memory_write는 사용자가 '기억해', '저장해', '메모해' 등 *명시적으로 요청*할 때만 사용
- 대화 중 추론한 정보를 임의로 저장하지 마세요
- 불확실한 정보는 저장하지 말고 사용자에게 확인하세요`);

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

  // 메모리 읽기 (.clackbot/memory.md)
  const memory = tryReadFile(path.join(cwd, 'memory.md'));
  if (memory && memory.trim() !== '# 메모리' && memory.trim() !== `# ${botName} 메모리`) {
    parts.push(`\n---\n# 메모리\n${memory}`);
  }

  // 프로젝트 컨텍스트 주입 (로컬 Claude Code와 지식 공유)
  if (projectContext) {
    parts.push(`\n---\n## 현재 프로젝트: ${projectContext.projectName} (${projectContext.projectPath})`);
    if (projectContext.claudeMd) {
      parts.push(`\n### 프로젝트 규칙\n${projectContext.claudeMd}`);
    }
    if (projectContext.memory) {
      parts.push(`\n### 프로젝트 메모리\n${projectContext.memory}`);
    }
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
