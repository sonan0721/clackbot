import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import fs from 'node:fs';

// [내장 도구] Slack 파일 업로드
// Agent가 로컬 파일을 Slack 채널/스레드에 업로드할 수 있는 도구

let slackClient: {
  filesUploadV2: (opts: {
    channel_id: string;
    file: Buffer;
    filename: string;
    title?: string;
    initial_comment?: string;
    thread_ts?: string;
  }) => Promise<unknown>;
} | null = null;

export function setSlackClientForUpload(client: typeof slackClient): void {
  slackClient = client;
}

export const slackUploadFileTool = tool(
  'slack_upload_file',
  'Slack 채널에 파일(이미지 등)을 업로드합니다. 로컬 파일 경로를 지정하세요.',
  {
    channel: z.string().describe('Slack 채널 ID'),
    file_path: z.string().describe('업로드할 로컬 파일의 절대 경로'),
    filename: z.string().optional().describe('Slack에 표시될 파일명 (미지정 시 원본 파일명 사용)'),
    title: z.string().optional().describe('파일 제목'),
    initial_comment: z.string().optional().describe('파일과 함께 표시할 메시지'),
    thread_ts: z.string().optional().describe('스레드 타임스탬프 (스레드 답장 시)'),
  },
  async (args) => {
    if (!slackClient) {
      return {
        content: [{ type: 'text' as const, text: '오류: Slack 클라이언트가 초기화되지 않았습니다.' }],
      };
    }

    if (!fs.existsSync(args.file_path)) {
      return {
        content: [{ type: 'text' as const, text: `오류: 파일을 찾을 수 없습니다: ${args.file_path}` }],
      };
    }

    try {
      const fileBuffer = fs.readFileSync(args.file_path);
      const filename = args.filename ?? args.file_path.split('/').pop() ?? 'file';

      await slackClient.filesUploadV2({
        channel_id: args.channel,
        file: fileBuffer,
        filename,
        ...(args.title ? { title: args.title } : {}),
        ...(args.initial_comment ? { initial_comment: args.initial_comment } : {}),
        ...(args.thread_ts ? { thread_ts: args.thread_ts } : {}),
      });

      return {
        content: [{ type: 'text' as const, text: `파일 "${filename}"이(가) 채널 ${args.channel}에 업로드되었습니다.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `파일 업로드 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);
