import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import { getSharedSlackClient } from '../../../slack/client.js';

// [내장 도구] Slack 채널 최근 메시지 읽기
// Agent가 채널의 최근 대화 히스토리를 조회할 수 있는 도구

export const slackReadChannelTool = tool(
  'slack_read_channel',
  'Slack 채널의 최근 메시지를 읽어옵니다 (최대 20개)',
  {
    channel: z.string().describe('Slack 채널 ID'),
    limit: z.number().int().min(1).max(20).default(20).describe('가져올 메시지 수 (1~20, 기본 20)'),
  },
  async (args) => {
    const client = getSharedSlackClient();
    if (!client) {
      return {
        content: [{ type: 'text' as const, text: '오류: Slack 클라이언트가 초기화되지 않았습니다.' }],
      };
    }

    try {
      const result = await client.conversations.history({
        channel: args.channel,
        limit: args.limit,
      });

      const messages = (result.messages ?? [])
        .reverse()
        .map(m => `[${m.user ?? 'unknown'}] (${m.ts}): ${m.text ?? ''}`)
        .join('\n');

      if (!messages) {
        return {
          content: [{ type: 'text' as const, text: '채널에 메시지가 없습니다.' }],
        };
      }

      return {
        content: [{ type: 'text' as const, text: messages }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `채널 메시지 조회 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);
