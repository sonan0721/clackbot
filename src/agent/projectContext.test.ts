import { describe, it, expect } from 'vitest';
import { parseProjectTag, projectPathToHash } from './projectContext.js';

describe('parseProjectTag', () => {
  it('메시지 앞의 [태그] 추출', () => {
    const result = parseProjectTag('[dev] API 추가해줘');
    expect(result).toEqual({ tag: 'dev', cleanPrompt: 'API 추가해줘' });
  });

  it('태그 뒤 공백 여러 개 처리', () => {
    const result = parseProjectTag('[game]   서버 확인');
    expect(result).toEqual({ tag: 'game', cleanPrompt: '서버 확인' });
  });

  it('태그 없으면 null', () => {
    expect(parseProjectTag('그냥 메시지')).toBeNull();
  });

  it('중간에 있는 [태그]는 무시', () => {
    expect(parseProjectTag('이거 [dev] 확인해봐')).toBeNull();
  });

  it('빈 태그는 무시', () => {
    expect(parseProjectTag('[] 확인')).toBeNull();
  });

  it('언더스코어 포함 태그', () => {
    const result = parseProjectTag('[my_project] 빌드 해줘');
    expect(result).toEqual({ tag: 'my_project', cleanPrompt: '빌드 해줘' });
  });

  it('숫자 포함 태그', () => {
    const result = parseProjectTag('[project2] 확인');
    expect(result).toEqual({ tag: 'project2', cleanPrompt: '확인' });
  });

  it('태그 뒤 공백 없이 바로 텍스트', () => {
    const result = parseProjectTag('[dev]바로텍스트');
    // 공백 없이 바로 붙은 경우도 정상 파싱
    expect(result).toEqual({ tag: 'dev', cleanPrompt: '바로텍스트' });
  });
});

describe('projectPathToHash', () => {
  it('경로를 Claude Code 해시 형식으로 변환', () => {
    const hash = projectPathToHash('/Users/al02528308/Documents/Git/clackbot');
    expect(hash).toBe('-Users-al02528308-Documents-Git-clackbot');
  });

  it('루트 경로', () => {
    const hash = projectPathToHash('/');
    expect(hash).toBe('-');
  });

  it('상대 경로는 절대 경로로 변환됨', () => {
    const hash = projectPathToHash('./relative/path');
    expect(hash).toContain('-relative-path');
  });
});
