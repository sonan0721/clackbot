import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, saveConfig } from '../../config/index.js';
import { checkProjectStatus, loadProjectContext } from '../../agent/projectContext.js';

// GET/POST/PUT/DELETE /api/projects — 프로젝트 컨텍스트 관리

const router = Router();

// 디렉토리 브라우저 — 폴더 선택 UI용
router.get('/browse', (req, res) => {
  const dirPath = typeof req.query.path === 'string' && req.query.path
    ? path.resolve(req.query.path)
    : os.homedir();

  try {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      res.status(400).json({ error: '유효하지 않은 경로입니다.' });
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b));

    const parent = path.dirname(dirPath);
    const hasClaudeMd = fs.existsSync(path.join(dirPath, 'CLAUDE.md'))
      || fs.existsSync(path.join(dirPath, '.claude', 'CLAUDE.md'));
    const hasGit = fs.existsSync(path.join(dirPath, '.git'));

    res.json({
      current: dirPath,
      parent: parent !== dirPath ? parent : null,
      dirs,
      hasClaudeMd,
      hasGit,
    });
  } catch {
    res.status(500).json({ error: '디렉토리 읽기 실패' });
  }
});

// 프로젝트 목록 조회
router.get('/', (_req, res) => {
  const config = loadConfig();
  const projects = config.projects || {};

  const result = Object.entries(projects).map(([name, project]) => {
    const status = checkProjectStatus(project.path);
    return {
      name,
      path: project.path,
      description: project.description || '',
      ...status,
    };
  });

  res.json(result);
});

// 프로젝트 등록
router.post('/', (req, res) => {
  const { name, path: projectPath, description } = req.body;

  if (!name || typeof name !== 'string' || !/^\w+$/.test(name)) {
    res.status(400).json({ error: '프로젝트 태그명은 영문/숫자/언더스코어만 가능합니다.' });
    return;
  }

  if (!projectPath || typeof projectPath !== 'string') {
    res.status(400).json({ error: '프로젝트 경로를 입력하세요.' });
    return;
  }

  const resolved = path.resolve(projectPath);
  if (!fs.existsSync(resolved)) {
    res.status(400).json({ error: `경로가 존재하지 않습니다: ${resolved}` });
    return;
  }

  const config = loadConfig();
  if (config.projects?.[name]) {
    res.status(409).json({ error: `프로젝트 [${name}]이 이미 등록되어 있습니다.` });
    return;
  }

  if (!config.projects) config.projects = {};
  config.projects[name] = { path: resolved, ...(description ? { description } : {}) };
  saveConfig(config);

  const status = checkProjectStatus(resolved);
  res.status(201).json({ name, path: resolved, description: description || '', ...status });
});

// 프로젝트 수정
router.put('/:name', (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (!config.projects?.[name]) {
    res.status(404).json({ error: `프로젝트 [${name}]을 찾을 수 없습니다.` });
    return;
  }

  const updates = req.body;
  if (updates.path) {
    const resolved = path.resolve(updates.path);
    if (!fs.existsSync(resolved)) {
      res.status(400).json({ error: `경로가 존재하지 않습니다: ${resolved}` });
      return;
    }
    config.projects[name].path = resolved;
  }
  if (updates.description !== undefined) {
    config.projects[name].description = updates.description;
  }

  saveConfig(config);

  const status = checkProjectStatus(config.projects[name].path);
  res.json({ name, ...config.projects[name], ...status });
});

// 프로젝트 삭제
router.delete('/:name', (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (!config.projects?.[name]) {
    res.status(404).json({ error: `프로젝트 [${name}]을 찾을 수 없습니다.` });
    return;
  }

  delete config.projects[name];
  saveConfig(config);
  res.json({ message: `프로젝트 [${name}]이 삭제되었습니다.` });
});

// 프로젝트 컨텍스트 미리보기 (CLAUDE.md + 메모리 내용)
router.get('/:name/context', (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (!config.projects?.[name]) {
    res.status(404).json({ error: `프로젝트 [${name}]을 찾을 수 없습니다.` });
    return;
  }

  const project = config.projects[name];
  const context = loadProjectContext(name, project.path);

  res.json({
    projectName: name,
    projectPath: context.projectPath,
    claudeMd: context.claudeMd,
    memory: context.memory,
  });
});

export default router;
