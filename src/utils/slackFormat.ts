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
