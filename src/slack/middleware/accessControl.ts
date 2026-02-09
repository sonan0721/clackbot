import { loadConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// 접근 모드 미들웨어 — owner / public

export interface AccessResult {
  allowed: boolean;
  isOwner: boolean;
}

/**
 * 접근 제어 확인
 * - owner 모드: 소유자만 사용 가능, 다른 사용자에게 안내 메시지 전송
 * - public 모드: 누구나 사용 가능
 *
 * @returns { allowed, isOwner }
 */
export async function checkAccess(
  userId: string,
  replyFn: (opts: { text: string; thread_ts?: string }) => Promise<unknown>,
  threadTs?: string,
): Promise<AccessResult> {
  const config = loadConfig();
  const ownerUserId = config.ownerUserId;

  // Owner 여부 판별
  const isOwner = !!ownerUserId && userId === ownerUserId;

  // public 모드면 항상 허용
  if (config.accessMode === 'public') {
    return { allowed: true, isOwner };
  }

  // owner 모드: 소유자 확인

  // 소유자 ID가 설정되지 않았으면 모든 사용자 허용 (초기 상태)
  if (!ownerUserId) {
    return { allowed: true, isOwner: true };
  }

  if (isOwner) {
    return { allowed: true, isOwner: true };
  }

  // 소유자가 아닌 사용자에게 안내 메시지 전송
  logger.debug(`접근 거부: 사용자 ${userId} (소유자: ${ownerUserId})`);
  const botName = config.slack.botName || 'Clackbot';
  await replyFn({
    text: `이 봇(@${botName})은 개인 비서 모드로 운영 중입니다. 소유자만 사용할 수 있습니다.`,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  });

  return { allowed: false, isOwner: false };
}
