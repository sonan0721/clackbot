import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-code';

// 안전 정책 — canUseTool 콜백 (역할 기반 이원화)

// 읽기 전용 도구 (비Owner 포함 기본 허용)
const READ_ONLY_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'WebSearch',
  'WebFetch',
  'Task',
]);

// 쓰기/실행 도구 (Owner만 허용)
const WRITE_TOOLS = new Set([
  'Write',
  'Edit',
  'Bash',
  'NotebookEdit',
]);

/**
 * 역할 기반 canUseTool 팩토리
 * - Owner: 모든 도구 허용 (Read, Write, Edit, Bash, MCP 등)
 * - 비Owner: 모든 도구 차단 (일반 대화만 가능)
 */
export function createCanUseTool(isOwner: boolean, botName = '비서봇'): CanUseTool {
  return async (
    toolName,
    input,
  ): Promise<PermissionResult> => {
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
