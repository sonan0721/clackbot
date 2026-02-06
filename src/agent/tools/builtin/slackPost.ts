import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';

// [내장 도구] Slack 채널 메시지 전송
// Agent가 직접 Slack에 메시지를 보낼 수 있는 도구

// Slack Web API 클라이언트를 외부에서 주입
let slackClient: { chat: { postMessage: (opts: { channel: string; text: string; thread_ts?: string }) => Promise<unknown> } } | null = null;

export function setSlackClient(client: typeof slackClient): void {
  slackClient = client;
}

export const slackPostTool = tool(
  'slack_post',
  'Slack 채널에 메시지를 전송합니다',
  {
    channel: z.string().describe('Slack 채널 ID'),
    text: z.string().describe('전송할 메시지 내용'),
    thread_ts: z.string().optional().describe('스레드 타임스탬프 (답장 시)'),
  },
  async (args) => {
    if (!slackClient) {
      return {
        content: [{ type: 'text' as const, text: '오류: Slack 클라이언트가 초기화되지 않았습니다.' }],
      };
    }

    try {
      await slackClient.chat.postMessage({
        channel: args.channel,
        text: args.text,
        ...(args.thread_ts ? { thread_ts: args.thread_ts } : {}),
      });

      return {
        content: [{ type: 'text' as const, text: `메시지가 채널 ${args.channel}에 전송되었습니다.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `메시지 전송 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);
