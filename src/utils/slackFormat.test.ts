import { describe, it, expect } from 'vitest';
import { markdownToMrkdwn } from './slackFormat.js';

describe('markdownToMrkdwn', () => {
  // ─── 굵게 ───
  it('**텍스트** → *텍스트*', () => {
    expect(markdownToMrkdwn('이것은 **굵은** 텍스트')).toBe('이것은 *굵은* 텍스트');
  });

  it('__텍스트__ → *텍스트*', () => {
    expect(markdownToMrkdwn('이것은 __굵은__ 텍스트')).toBe('이것은 *굵은* 텍스트');
  });

  it('여러 개의 **굵은** 텍스트', () => {
    expect(markdownToMrkdwn('**하나** 그리고 **둘**')).toBe('*하나* 그리고 *둘*');
  });

  // ─── 링크 ───
  it('[텍스트](URL) → <URL|텍스트>', () => {
    expect(markdownToMrkdwn('[구글](https://google.com)')).toBe('<https://google.com|구글>');
  });

  it('문장 속 링크 변환', () => {
    expect(markdownToMrkdwn('자세한 내용은 [여기](https://example.com)를 참고하세요'))
      .toBe('자세한 내용은 <https://example.com|여기>를 참고하세요');
  });

  it('이미 Slack 형식인 링크는 유지', () => {
    expect(markdownToMrkdwn('확인: <https://google.com|구글>')).toBe('확인: <https://google.com|구글>');
  });

  // ─── 제목 ───
  it('# 제목 → *제목*', () => {
    expect(markdownToMrkdwn('# 큰 제목')).toBe('*큰 제목*');
  });

  it('## 제목 → *제목*', () => {
    expect(markdownToMrkdwn('## 중간 제목')).toBe('*중간 제목*');
  });

  it('### 제목 → *제목*', () => {
    expect(markdownToMrkdwn('### 작은 제목')).toBe('*작은 제목*');
  });

  it('여러 줄에 제목과 본문 혼합', () => {
    const input = '## 요약\n내용입니다\n### 세부사항\n- 항목 1';
    const expected = '*요약*\n내용입니다\n*세부사항*\n- 항목 1';
    expect(markdownToMrkdwn(input)).toBe(expected);
  });

  // ─── 취소선 ───
  it('~~텍스트~~ → ~텍스트~', () => {
    expect(markdownToMrkdwn('이것은 ~~취소된~~ 텍스트')).toBe('이것은 ~취소된~ 텍스트');
  });

  // ─── 수평선 ───
  it('--- 제거', () => {
    expect(markdownToMrkdwn('위\n---\n아래')).toBe('위\n\n아래');
  });

  it('*** 제거', () => {
    expect(markdownToMrkdwn('위\n***\n아래')).toBe('위\n\n아래');
  });

  // ─── 코드 블록 보존 ───
  it('코드 블록 내부는 변환하지 않음', () => {
    const input = '```\n**굵은 텍스트**\n[링크](url)\n```';
    expect(markdownToMrkdwn(input)).toBe(input);
  });

  it('코드 블록 외부만 변환', () => {
    const input = '**앞** ```코드``` **뒤**';
    expect(markdownToMrkdwn(input)).toBe('*앞* ```코드``` *뒤*');
  });

  it('언어 지정된 코드 블록 보존', () => {
    const input = '```typescript\nconst x = **bold**;\n```';
    expect(markdownToMrkdwn(input)).toBe(input);
  });

  // ─── 인라인 코드 보존 ───
  it('인라인 코드 내부는 변환하지 않음', () => {
    expect(markdownToMrkdwn('명령어: `**npm install**`')).toBe('명령어: `**npm install**`');
  });

  // ─── 복합 케이스 ───
  it('굵게 + 링크 + 코드 혼합', () => {
    const input = '**중요**: [문서](https://docs.com)를 확인하세요. `코드`도 있습니다.';
    const expected = '*중요*: <https://docs.com|문서>를 확인하세요. `코드`도 있습니다.';
    expect(markdownToMrkdwn(input)).toBe(expected);
  });

  it('제목 + 목록 + 굵게 혼합', () => {
    const input = '## 할일\n- **첫 번째** 작업\n- 두 번째 작업\n- ~~세 번째~~ 완료';
    const expected = '*할일*\n- *첫 번째* 작업\n- 두 번째 작업\n- ~세 번째~ 완료';
    expect(markdownToMrkdwn(input)).toBe(expected);
  });

  it('실제 Claude 응답 스타일 텍스트', () => {
    const input = `## 분석 결과

**문제점**: API 응답 시간이 느립니다.

### 해결 방안
1. 캐시 적용
2. [Redis 문서](https://redis.io)를 참고하세요
3. \`npm install redis\`로 설치

---

자세한 내용은 아래 코드를 확인하세요:

\`\`\`javascript
const redis = require('redis');
const client = redis.createClient();
\`\`\``;

    const expected = `*분석 결과*

*문제점*: API 응답 시간이 느립니다.

*해결 방안*
1. 캐시 적용
2. <https://redis.io|Redis 문서>를 참고하세요
3. \`npm install redis\`로 설치

자세한 내용은 아래 코드를 확인하세요:

\`\`\`javascript
const redis = require('redis');
const client = redis.createClient();
\`\`\``;

    expect(markdownToMrkdwn(input)).toBe(expected);
  });

  // ─── 빈 줄 정리 ───
  it('3개 이상 연속 빈 줄 → 2개로', () => {
    expect(markdownToMrkdwn('위\n\n\n\n아래')).toBe('위\n\n아래');
  });

  // ─── 엣지 케이스 ───
  it('빈 문자열', () => {
    expect(markdownToMrkdwn('')).toBe('');
  });

  it('이미 Slack mrkdwn인 텍스트는 그대로', () => {
    const input = '*굵게* _기울임_ ~취소~ `코드`';
    expect(markdownToMrkdwn(input)).toBe(input);
  });

  it('일반 텍스트는 변환 없음', () => {
    const input = '안녕하세요. 오늘 날씨가 좋습니다.';
    expect(markdownToMrkdwn(input)).toBe(input);
  });

  it('*가 포함된 일반 텍스트 (곱셈)', () => {
    const input = '3 * 4 = 12';
    expect(markdownToMrkdwn(input)).toBe(input);
  });

  it('URL만 있는 텍스트', () => {
    const input = 'https://example.com';
    expect(markdownToMrkdwn(input)).toBe(input);
  });

  // ─── 한국어 특화 ───
  it('한국어 굵게 텍스트', () => {
    expect(markdownToMrkdwn('**업무 보고서**를 확인해주세요')).toBe('*업무 보고서*를 확인해주세요');
  });

  it('한국어 + 영어 혼합 링크', () => {
    expect(markdownToMrkdwn('[Arbor 보드](https://arbor.example.com/board)에서 확인'))
      .toBe('<https://arbor.example.com/board|Arbor 보드>에서 확인');
  });
});
