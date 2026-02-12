// Slack 메시지 포맷 유틸리티

/** 멘션 텍스트에서 봇 멘션 태그 제거 */
export function stripBotMention(text: string, botUserId: string): string {
  // <@U12345> 형태의 멘션 제거
  const mentionRegex = new RegExp(`<@${botUserId}>\\s*`, 'g');
  return text.replace(mentionRegex, '').trim();
}

/** 텍스트 길이 제한 (Slack 메시지 최대 길이 고려) */
export function truncateText(text: string, maxLength: number = 3000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/** 코드 블록으로 감싸기 */
export function codeBlock(text: string, lang?: string): string {
  return `\`\`\`${lang ?? ''}\n${text}\n\`\`\``;
}

/**
 * Markdown → Slack mrkdwn 변환 후처리
 * LLM이 Markdown 문법을 사용한 경우 Slack mrkdwn으로 자동 변환
 */
export function markdownToMrkdwn(text: string): string {
  let result = text;

  // 1) 코드 블록 보존 (변환에서 제외)
  const codeBlocks: string[] = [];
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  // 2) 인라인 코드 보존
  const inlineCodes: string[] = [];
  result = result.replace(/`[^`]+`/g, (match) => {
    inlineCodes.push(match);
    return `\x00IC${inlineCodes.length - 1}\x00`;
  });

  // 3) Slack 링크 <URL|text> 보존 (이미 올바른 형식)
  const slackLinks: string[] = [];
  result = result.replace(/<[^>]+\|[^>]+>/g, (match) => {
    slackLinks.push(match);
    return `\x00SL${slackLinks.length - 1}\x00`;
  });

  // 4) 제목: # 제목 → *제목* (줄 시작에서만)
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // 5) 굵게: **텍스트** 또는 __텍스트__ → *텍스트*
  result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');
  result = result.replace(/__(.+?)__/g, '*$1*');

  // 6) 기울임: Markdown 단일 *텍스트* → Slack _텍스트_
  // 주의: 이미 변환된 *굵게*와 충돌하지 않도록, 앞뒤가 *가 아닌 경우만 매칭
  // Slack에서 *는 굵게이므로, 단독 *텍스트*는 그대로 둠 (이미 Slack 굵게)

  // 7) 링크: [텍스트](URL) → <URL|텍스트>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  // 8) 취소선: ~~텍스트~~ → ~텍스트~
  result = result.replace(/~~(.+?)~~/g, '~$1~');

  // 9) 수평선 제거
  result = result.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '');

  // 10) 빈 줄 정리 (3개 이상 연속 빈 줄 → 2개로)
  result = result.replace(/\n{3,}/g, '\n\n');

  // 복원: Slack 링크
  slackLinks.forEach((link, i) => {
    result = result.replace(`\x00SL${i}\x00`, link);
  });

  // 복원: 인라인 코드
  inlineCodes.forEach((code, i) => {
    result = result.replace(`\x00IC${i}\x00`, code);
  });

  // 복원: 코드 블록
  codeBlocks.forEach((block, i) => {
    result = result.replace(`\x00CB${i}\x00`, block);
  });

  return result.trim();
}
