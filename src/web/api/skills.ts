import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { getSkillsDir } from '../../config/paths.js';
import { loadSkills, getSkill } from '../../skills/loader.js';

// 스킬 CRUD API

const router = Router();

/** slug 유효성 검증 (영문, 숫자, 하이픈만 허용) */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug) && !slug.includes('..');
}

// GET /api/skills — 스킬 목록
router.get('/', (_req: Request, res: Response) => {
  const skills = loadSkills();
  res.json({
    skills: skills.map(s => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
    })),
  });
});

// GET /api/skills/:slug — 스킬 상세
router.get('/:slug', (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  if (!isValidSlug(slug)) {
    res.status(400).json({ error: '잘못된 스킬 이름입니다.' });
    return;
  }

  const skill = getSkill(slug);
  if (!skill) {
    res.status(404).json({ error: '스킬을 찾을 수 없습니다.' });
    return;
  }

  // 원본 파일 전체 내용도 함께 반환
  let rawContent = '';
  try {
    rawContent = fs.readFileSync(skill.filePath, 'utf-8');
  } catch {
    // 무시
  }

  res.json({
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    prompt: skill.prompt,
    rawContent,
  });
});

// PUT /api/skills/:slug — 스킬 저장/수정
router.put('/:slug', (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  if (!isValidSlug(slug)) {
    res.status(400).json({ error: '잘못된 스킬 이름입니다. 영문 소문자, 숫자, 하이픈만 사용 가능합니다.' });
    return;
  }

  const { name, description, prompt } = req.body;
  if (typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt(문자열)가 필요합니다.' });
    return;
  }

  const skillsDir = getSkillsDir();
  fs.mkdirSync(skillsDir, { recursive: true });

  const filePath = path.join(skillsDir, `${slug}.md`);
  // path traversal 방지
  if (!path.resolve(filePath).startsWith(path.resolve(skillsDir))) {
    res.status(400).json({ error: '잘못된 파일 경로입니다.' });
    return;
  }

  // frontmatter + 본문 조합
  const frontmatter = [
    '---',
    `name: ${(name as string) || slug}`,
    `description: ${(description as string) || ''}`,
    '---',
  ].join('\n');

  const content = `${frontmatter}\n\n${prompt}`;

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ message: '스킬이 저장되었습니다.' });
  } catch {
    res.status(500).json({ error: '스킬 저장 실패' });
  }
});

// DELETE /api/skills/:slug — 스킬 삭제
router.delete('/:slug', (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  if (!isValidSlug(slug)) {
    res.status(400).json({ error: '잘못된 스킬 이름입니다.' });
    return;
  }

  const skillsDir = getSkillsDir();
  const filePath = path.join(skillsDir, `${slug}.md`);

  if (!path.resolve(filePath).startsWith(path.resolve(skillsDir))) {
    res.status(400).json({ error: '잘못된 파일 경로입니다.' });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: '스킬을 찾을 수 없습니다.' });
    return;
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ message: '스킬이 삭제되었습니다.' });
  } catch {
    res.status(500).json({ error: '스킬 삭제 실패' });
  }
});

export default router;
