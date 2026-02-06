import { loadConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// 접근 모드 미들웨어 — owner / public

/**
 * 접근 제어 확인
 * - owner 모드: 소유자만 사용 가능, 다른 사용자에게 안내 메시지 전송
 * - public 모드: 누구나 사용 가능
 *
 * @returns true이면 접근 허용, false이면 차단됨
 */
export async function checkAccess(
  userId: string,
  replyFn: (opts: { text: string; thread_ts?: string }) => Promise<unknown>,
  threadTs?: string,
): Promise<boolean> {
  const config = loadConfig();

  // public 모드면 항상 허용
  if (config.accessMode === 'public') {
    return true;
  }

  // owner 모드: 소유자 확인
  const ownerUserId = config.ownerUserId;

  // 소유자 ID가 설정되지 않았으면 모든 사용자 허용 (초기 상태)
  if (!ownerUserId) {
    return true;
  }

  if (userId === ownerUserId) {
    return true;
  }

  // 소유자가 아닌 사용자에게 안내 메시지 전송
  logger.debug(`접근 거부: 사용자 ${userId} (소유자: ${ownerUserId})`);
  const botName = config.slack.botName || 'Clackbot';
  await replyFn({
    text: `이 봇(@${botName})은 개인 비서 모드로 운영 중입니다. 소유자만 사용할 수 있습니다.`,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  });

  return false;
}
