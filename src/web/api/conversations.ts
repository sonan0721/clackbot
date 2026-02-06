import { Router } from 'express';
import { getConversationSessions, getSessionMessages } from '../../store/conversations.js';

// GET /api/conversations — 세션 기반 대화 이력

const router = Router();

// 세션(스레드) 목록 조회
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const search = req.query.search as string | undefined;

  const result = getConversationSessions({ limit, offset, search });
  res.json(result);
});

// 특정 세션의 메시지 목록
router.get('/:threadTs', (req, res) => {
  const messages = getSessionMessages(req.params.threadTs);

  if (messages.length === 0) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    return;
  }

  res.json({ messages });
});

export default router;
