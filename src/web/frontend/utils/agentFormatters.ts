// Agent 관련 공통 포맷 유틸리티

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ko-KR')
}

export function activityLabel(type: string): string {
  const map: Record<string, string> = { tool_use: '도구 사용', skill_invoke: '스킬 호출', agent_spawn: '에이전트 생성', memory_update: '메모리 업데이트' }
  return map[type] || type
}

export function activityBadgeClass(type: string): string {
  const map: Record<string, string> = { tool_use: 'badge-builtin', skill_invoke: 'badge-plugin', agent_spawn: 'badge-active', memory_update: 'badge-error' }
  return map[type] || 'badge-plugin'
}

/** 경로의 각 세그먼트를 인코딩하되 / 구분자는 유지 */
export function encodePath(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/')
}
