import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import { getSharedSlackClient } from '../../../slack/client.js';

// [내장 도구] Slack 스레드 메시지 읽기
// Agent가 특정 스레드의 대화 내용을 조회할 수 있는 도구

export const slackReadThreadTool = tool(
  'slack_read_thread',
  'Slack 스레드의 모든 메시지를 읽어옵니다. 채널 ID와 스레드의 parent message timestamp가 필요합니다.',
  {
    channel: z.string().describe('Slack 채널 ID (예: C0123ABC)'),
    thread_ts: z.string().describe('스레드의 parent message timestamp'),
    limit: z.number().int().min(1).max(100).default(100).describe('가져올 메시지 수 (1~100, 기본 100)'),
  },
  async (args) => {
    const client = getSharedSlackClient();
    if (!client) {
      return {
        content: [{ type: 'text' as const, text: '오류: Slack 클라이언트가 초기화되지 않았습니다.' }],
      };
    }

    try {
      const result = await client.conversations.replies({
        channel: args.channel,
        ts: args.thread_ts,
        limit: args.limit,
      });

      const messages = (result.messages ?? [])
        .map(m => `[${m.user ?? 'unknown'}] (${m.ts}): ${m.text ?? ''}`)
        .join('\n');

      if (!messages) {
        return {
          content: [{ type: 'text' as const, text: '스레드에 메시지가 없습니다.' }],
        };
      }

      return {
        content: [{ type: 'text' as const, text: messages }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `스레드 메시지 조회 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);
