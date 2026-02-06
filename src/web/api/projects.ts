import { Router } from 'express';
import { listProjects, addProject, mapChannel, removeProject } from '../../projects/registry.js';

// GET/POST /api/projects — 프로젝트 관리

const router = Router();

// 프로젝트 목록
router.get('/', (_req, res) => {
  const projects = listProjects();
  res.json({ projects, total: projects.length });
});

// 프로젝트 추가
router.post('/', (req, res) => {
  try {
    const { id, directory, slackChannels, isDefault } = req.body;

    if (!id || !directory) {
      res.status(400).json({ error: 'id와 directory는 필수입니다.' });
      return;
    }

    const project = addProject({ id, directory, slackChannels, isDefault });
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 프로젝트에 채널 매핑
router.post('/:id/channels', (req, res) => {
  try {
    const { channelId } = req.body;

    if (!channelId) {
      res.status(400).json({ error: 'channelId는 필수입니다.' });
      return;
    }

    mapChannel(req.params.id, channelId);
    res.json({ message: '채널 매핑 완료' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 프로젝트 삭제
router.delete('/:id', (req, res) => {
  try {
    removeProject(req.params.id);
    res.json({ message: '프로젝트가 삭제되었습니다.' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
