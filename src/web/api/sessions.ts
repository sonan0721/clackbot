import { Router } from 'express';
import {
  getAllSessions,
  getAgentSession,
  updateAgentSession,
  getSessionActivities,
} from '../../store/agentSessions.js';

// GET/POST /api/sessions — 에이전트 세션 관리

const router = Router();

// 세션 목록 (페이지네이션 + 상태 필터)
router.get('/', (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const result = getAllSessions({ status, limit, offset });
  res.json(result);
});

// 세션 상세 + 활동 로그
router.get('/:id', (req, res) => {
  const session = getAgentSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    return;
  }
  const activities = getSessionActivities(req.params.id);
  res.json({ ...session, activities });
});

// 세션 종료
router.post('/:id/kill', (req, res) => {
  const session = getAgentSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    return;
  }
  updateAgentSession(req.params.id, { status: 'expired', completedAt: Date.now() });
  res.json({ ok: true });
});

export default router;
