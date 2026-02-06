import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-code';

// 안전 정책 — canUseTool 콜백

// 허용된 읽기 전용 도구
const ALLOWED_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'WebSearch',
  'WebFetch',
  'Task',
]);

// 차단된 쓰기/실행 도구 (CLAUDE.md 6번 규칙)
const BLOCKED_TOOLS = new Set([
  'Write',
  'Edit',
  'Bash',
  'NotebookEdit',
]);

/**
 * 도구 사용 권한 확인
 * - 읽기 도구: 허용
 * - MCP 도구 (mcp__로 시작): 허용
 * - 쓰기/실행 도구: 차단
 */
export const canUseTool: CanUseTool = async (
  toolName,
  input,
  _options,
): Promise<PermissionResult> => {
  // 내장 허용 도구
  if (ALLOWED_TOOLS.has(toolName)) {
    return { behavior: 'allow', updatedInput: input };
  }

  // MCP 도구 (플러그인 + 내장 MCP)
  if (toolName.startsWith('mcp__')) {
    return { behavior: 'allow', updatedInput: input };
  }

  // 명시적 차단 도구
  if (BLOCKED_TOOLS.has(toolName)) {
    return {
      behavior: 'deny',
      message: `Clackbot 안전 정책: ${toolName} 도구는 사용이 제한됩니다.`,
    };
  }

  // 알 수 없는 도구는 기본 차단
  return {
    behavior: 'deny',
    message: `알 수 없는 도구: ${toolName}`,
  };
};
