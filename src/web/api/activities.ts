import { Router } from 'express';
import { getRecentActivities, getSessionActivities } from '../../store/agentSessions.js';

// GET /api/activities — 최근 활동 타임라인

const router = Router();

// 활동 목록 (페이지네이션 + 세션 필터)
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const sessionId = req.query.session as string | undefined;

  if (sessionId) {
    res.json(getSessionActivities(sessionId));
  } else {
    res.json(getRecentActivities(limit, offset));
  }
});

export default router;
