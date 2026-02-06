import type { WebClient } from '@slack/web-api';

// 공유 Slack WebClient 싱글턴
// 웹 대시보드 등에서 Slack API를 호출할 때 사용

let client: WebClient | null = null;

export function setSharedSlackClient(c: WebClient): void {
  client = c;
}

export function getSharedSlackClient(): WebClient | null {
  return client;
}
