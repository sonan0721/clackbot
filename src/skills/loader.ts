import fs from 'node:fs';
import path from 'node:path';
import { getSkillsDir } from '../config/paths.js';

// 스킬 로더 — .clackbot/skills/*.md 파일을 스캔하여 스킬 정의 로드

export interface LoadedSkill {
  slug: string;         // 파일명 (확장자 제외): "draft-email"
  name: string;         // frontmatter name 또는 slug
  description: string;  // frontmatter description
  prompt: string;       // 본문 (시스템 프롬프트)
  filePath: string;     // 절대 경로
}

/** YAML frontmatter 파싱 (간단한 정규식 기반) */
function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: content };
  }

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) {
      meta[kv[1].trim()] = kv[2].trim();
    }
  }

  return { meta, body: match[2].trim() };
}

/** .clackbot/skills/ 내 모든 .md 스킬 로드 */
export function loadSkills(cwd?: string): LoadedSkill[] {
  const skillsDir = getSkillsDir(cwd);
  if (!fs.existsSync(skillsDir)) return [];

  const skills: LoadedSkill[] = [];

  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const slug = entry.name.replace(/\.md$/, '');
      const filePath = path.join(skillsDir, entry.name);

      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { meta, body } = parseFrontmatter(raw);

        skills.push({
          slug,
          name: meta.name || slug,
          description: meta.description || '',
          prompt: body,
          filePath,
        });
      } catch {
        // 개별 파일 읽기 실패 시 무시
      }
    }
  } catch {
    // 디렉토리 읽기 실패 시 무시
  }

  return skills.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** 특정 스킬 로드 */
export function getSkill(slug: string, cwd?: string): LoadedSkill | null {
  const skillsDir = getSkillsDir(cwd);
  const filePath = path.join(skillsDir, `${slug}.md`);

  // path traversal 방지
  if (!path.resolve(filePath).startsWith(path.resolve(skillsDir))) return null;
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(raw);

    return {
      slug,
      name: meta.name || slug,
      description: meta.description || '',
      prompt: body,
      filePath,
    };
  } catch {
    return null;
  }
}
