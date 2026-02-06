import { queryAgent } from '../../agent/claude.js';
import { sessionManager } from '../../session/manager.js';
import { saveConversation } from '../../store/conversations.js';
import { truncateText } from '../../utils/slackFormat.js';
import { logger } from '../../utils/logger.js';

// 메시지 처리 공통 핸들러

export interface HandleMessageParams {
  inputText: string;
  userId: string;
  channelId: string;
  threadTs: string;
  threadMessages: Array<{ user: string; text: string }>;
  say: (params: { text: string; thread_ts?: string }) => Promise<unknown>;
  /** true면 스레드 대신 채널에 직접 응답 */
  replyInChannel?: boolean;
}

export async function handleMessage(params: HandleMessageParams): Promise<void> {
  const { inputText, userId, channelId, threadTs, threadMessages, say, replyInChannel } = params;

  try {
    const cwd = process.cwd();

    // 세션 관리
    const session = sessionManager.getOrCreate(threadTs);

    // "생각 중" 리액션 또는 메시지 (선택적)
    logger.debug(`처리 시작: "${inputText.slice(0, 50)}..."`);

    // Claude Agent 호출
    const response = await queryAgent({
      prompt: inputText,
      cwd,
      threadMessages,
      sessionId: session.id,
      resumeId: session.resumeId,
    });

    // 세션 업데이트
    sessionManager.update(threadTs, {
      resumeId: response.resumeId,
      messageCount: session.messageCount + 1,
    });

    // 응답 전송 — replyInChannel이면 채널에, 아니면 스레드에
    const responseText = truncateText(response.text);
    if (replyInChannel) {
      await say({ text: responseText });
    } else {
      await say({ text: responseText, thread_ts: threadTs });
    }

    // 대화 기록 저장
    saveConversation({
      channelId,
      threadTs,
      userId,
      inputText,
      outputText: response.text,
      toolsUsed: response.toolsUsed,
    });

    logger.debug('응답 전송 완료');

  } catch (error) {
    logger.error(`메시지 처리 실패: ${error instanceof Error ? error.message : String(error)}`);

    if (replyInChannel) {
      await say({ text: '죄송합니다. 메시지 처리 중 오류가 발생했습니다.' });
    } else {
      await say({ text: '죄송합니다. 메시지 처리 중 오류가 발생했습니다.', thread_ts: threadTs });
    }
  }
}
