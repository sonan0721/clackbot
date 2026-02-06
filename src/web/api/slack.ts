import { Router } from 'express';
import { getSharedSlackClient } from '../../slack/client.js';

// GET /api/slack/users — 워크스페이스 사용자 목록 조회

const router = Router();

const MAX_USERS = 2000;

router.get('/users', async (_req, res) => {
  const client = getSharedSlackClient();
  if (!client) {
    res.status(503).json({ error: 'Slack 클라이언트가 초기화되지 않았습니다.' });
    return;
  }

  try {
    const members: Array<{ id: string; displayName: string; realName: string }> = [];
    let cursor: string | undefined;

    // 커서 페이지네이션으로 전체 사용자 조회
    do {
      const result = await client.users.list({
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });

      for (const member of result.members || []) {
        // 봇, 비활성화 사용자, Slackbot 필터링
        if (member.is_bot || member.deleted || member.id === 'USLACKBOT') continue;

        members.push({
          id: member.id!,
          displayName: member.profile?.display_name || member.profile?.real_name || member.name || '',
          realName: member.profile?.real_name || member.name || '',
        });

        if (members.length >= MAX_USERS) break;
      }

      cursor = result.response_metadata?.next_cursor || undefined;
    } while (cursor && members.length < MAX_USERS);

    // displayName 기준 정렬
    members.sort((a, b) => a.displayName.localeCompare(b.displayName));

    res.json({ users: members });
  } catch (error) {
    res.status(500).json({
      error: `사용자 목록 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

export default router;
