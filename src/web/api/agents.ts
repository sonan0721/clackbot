import { Router } from 'express';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// GET /api/agents — Agent/Skill 정의 목록

const router = Router();

// Agent 정의 목록
router.get('/', (_req, res) => {
  const cwd = process.cwd();
  const agentsDir = join(cwd, '.claude', 'agents');
  const agents = loadMarkdownDefs(agentsDir);
  res.json(agents);
});

// Skill 목록
router.get('/skills', (_req, res) => {
  const cwd = process.cwd();
  const skillsDir = join(cwd, '.claude', 'skills');
  const skills = loadSkillDefs(skillsDir);
  res.json(skills);
});

/** .md 파일에서 frontmatter 포함 정의 로드 */
function loadMarkdownDefs(dir: string): Record<string, string>[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = readFileSync(join(dir, f), 'utf-8');
      const fm = parseFrontmatter(content);
      return { file: f, ...fm };
    });
}

/** SKILL.md 파일에서 skill 정의 로드 */
function loadSkillDefs(dir: string): Record<string, string>[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => existsSync(join(dir, name, 'SKILL.md')))
    .map(name => {
      const content = readFileSync(join(dir, name, 'SKILL.md'), 'utf-8');
      const fm = parseFrontmatter(content);
      return { name, ...fm };
    });
}

/** YAML frontmatter 파싱 (간단 키-값) */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      result[key] = val;
    }
  }
  return result;
}

export default router;
