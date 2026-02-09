import { loadConfig } from '../../config/index.js';

// 접근 제어 — Owner 판별 (모든 사용자 허용, 권한은 대화 모드가 제어)

export interface AccessResult {
  allowed: boolean;
  isOwner: boolean;
}

/**
 * 접근 제어 확인
 * - 모든 사용자 허용 (allowed: true)
 * - Owner 여부만 판별하여 대화 모드에서 권한 분기에 사용
 */
export async function checkAccess(
  userId: string,
  _replyFn: (opts: { text: string; thread_ts?: string }) => Promise<unknown>,
  _threadTs?: string,
): Promise<AccessResult> {
  const config = loadConfig();
  const ownerUserId = config.ownerUserId;

  // Owner 여부 판별 (소유자 미설정 시 모든 사용자를 Owner로 취급)
  const isOwner = !ownerUserId || userId === ownerUserId;

  return { allowed: true, isOwner };
}
