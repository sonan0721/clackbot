import { Router } from 'express';
import { getConversations, getConversation } from '../../store/conversations.js';

// GET /api/conversations — 대화 이력

const router = Router();

// 대화 목록 조회
router.get('/', (req, res) => {
  const channelId = req.query.channelId as string | undefined;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const search = req.query.search as string | undefined;

  const result = getConversations({ channelId, limit, offset, search });
  res.json(result);
});

// 단일 대화 조회
router.get('/:id', (req, res) => {
  const conversation = getConversation(req.params.id);

  if (!conversation) {
    res.status(404).json({ error: '대화를 찾을 수 없습니다.' });
    return;
  }

  res.json(conversation);
});

export default router;
