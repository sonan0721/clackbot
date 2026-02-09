import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-code';
import type { ConversationMode } from '../slack/listeners/handler.js';

// 안전 정책 — canUseTool 콜백 (역할 + 모드 기반)

/**
 * 역할 + 모드 기반 canUseTool 팩토리
 * - channel 모드: 모든 도구 차단 (Owner 포함)
 * - thread/dm 모드 Owner: 모든 도구 허용
 * - thread/dm 모드 비Owner: 모든 도구 차단
 */
export function createCanUseTool(isOwner: boolean, botName = '비서봇', mode: ConversationMode = 'thread'): CanUseTool {
  return async (
    toolName,
    input,
  ): Promise<PermissionResult> => {
    // channel 모드: Owner 포함 모든 도구 차단
    if (mode === 'channel') {
      return {
        behavior: 'deny',
        message: `${botName}: 채널 대화에서는 도구를 사용할 수 없습니다. 스레드나 DM에서 요청해 주세요.`,
      };
    }

    if (isOwner) {
      // Owner: 모든 도구 허용
      return { behavior: 'allow', updatedInput: input };
    }

    // 비Owner: 모든 도구 차단
    return {
      behavior: 'deny',
      message: `${botName}: 도구 사용은 Owner에게만 허용됩니다.`,
    };
  };
}

// 하위 호환: 기존 canUseTool (읽기 전용 — Slack 채널 기본 정책)
export const canUseTool: CanUseTool = createCanUseTool(false);
