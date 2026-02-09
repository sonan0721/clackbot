import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';

// [내장 도구] Slack DM 전송
// Agent가 특정 사용자에게 DM을 보낼 수 있는 도구

// Slack Web API 클라이언트를 외부에서 주입
let slackClient: {
  conversations: {
    open: (opts: { users: string }) => Promise<{ ok?: boolean; channel?: { id?: string } }>;
  };
  chat: {
    postMessage: (opts: { channel: string; text: string }) => Promise<unknown>;
  };
} | null = null;

export function setSlackClientForDm(client: typeof slackClient): void {
  slackClient = client;
}

export const slackSendDmTool = tool(
  'slack_send_dm',
  'Slack 사용자에게 DM(다이렉트 메시지)을 전송합니다',
  {
    user_id: z.string().describe('DM을 보낼 Slack 사용자 ID'),
    text: z.string().describe('전송할 메시지 내용'),
  },
  async (args) => {
    if (!slackClient) {
      return {
        content: [{ type: 'text' as const, text: '오류: Slack 클라이언트가 초기화되지 않았습니다.' }],
      };
    }

    try {
      // DM 채널 열기
      const openResult = await slackClient.conversations.open({ users: args.user_id });
      if (!openResult.ok || !openResult.channel?.id) {
        return {
          content: [{ type: 'text' as const, text: `DM 채널 열기 실패: 사용자 ${args.user_id}` }],
        };
      }

      const channelId = openResult.channel.id;

      // 메시지 전송
      await slackClient.chat.postMessage({
        channel: channelId,
        text: args.text,
      });

      return {
        content: [{ type: 'text' as const, text: `DM이 사용자 ${args.user_id}에게 전송되었습니다.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `DM 전송 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);
