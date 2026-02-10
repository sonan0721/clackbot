import type { WebClient } from '@slack/web-api';
import { queryAgent, type Attachment } from '../../agent/claude.js';
import { sessionManager } from '../../session/manager.js';
import { saveConversation } from '../../store/conversations.js';
import { getLocalDir } from '../../config/paths.js';
import { loadConfig } from '../../config/index.js';
import { truncateText } from '../../utils/slackFormat.js';
import { logger } from '../../utils/logger.js';

// 메시지 처리 공통 핸들러

/** 대화 모드: channel(채널 1회성), thread(스레드 작업), dm(DM 비서) */
export type ConversationMode = 'channel' | 'thread' | 'dm';

export interface HandleMessageParams {
  inputText: string;
  userId: string;
  channelId: string;
  threadTs: string;
  threadMessages: Array<{ user: string; text: string; botId?: string }>;
  say: (params: { text: string; thread_ts?: string }) => Promise<unknown>;
  client: WebClient;
  isOwner: boolean;
  /** 대화 모드 */
  mode: ConversationMode;
  /** 첨부파일 */
  attachments?: Attachment[];
}

export async function handleMessage(params: HandleMessageParams): Promise<void> {
  const {
    inputText, userId, channelId, threadTs, threadMessages,
    say, client, isOwner, mode, attachments,
  } = params;

  const replyInChannel = mode === 'channel';

  // "생각 중..." 메시지 전송
  const handlerConfig = loadConfig();
  const thinkingMessage = handlerConfig.personality?.thinkingMessage || '생각 중...';
  let thinkingTs: string | undefined;
  try {
    const thinkingMsg = await client.chat.postMessage({
      channel: channelId,
      text: thinkingMessage,
      ...(replyInChannel ? {} : { thread_ts: threadTs }),
    });
    thinkingTs = thinkingMsg.ts as string | undefined;
  } catch (error) {
    logger.warn(`생각 중 메시지 전송 실패: ${error}`);
  }

  try {
    const cwd = getLocalDir();

    // 세션 관리 (channel 모드는 1회성 → 세션 스킵)
    let sessionId: string;
    let resumeId: string | undefined;
    let sessionMessageCount = 0;

    if (mode === 'channel') {
      sessionId = `channel-${Date.now()}`;
    } else {
      const session = sessionManager.getOrCreate(threadTs);
      sessionId = session.id;
      resumeId = session.resumeId;
      sessionMessageCount = session.messageCount;
    }

    logger.debug(`처리 시작 [${mode}]: "${inputText.slice(0, 50)}..."`);

    // 생각 중 메시지 실시간 업데이트 (channel 모드는 도구 없으므로 스킵)
    let onProgress: ((status: string) => void) | undefined;
    let updateTimer: ReturnType<typeof setTimeout> | null = null;
    const showProgress = handlerConfig.personality?.showProgress !== false;

    if (mode !== 'channel' && showProgress) {
      let lastUpdateTime = 0;
      let pendingStatus: string | null = null;

      const flushThinkingUpdate = async (status: string) => {
        if (!thinkingTs) return;
        const thinkingText = `${thinkingMessage}\n\n\`\`\`\n${status}\n\`\`\``;
        try {
          await client.chat.update({
            channel: channelId,
            ts: thinkingTs,
            text: thinkingText,
          });
        } catch {
          // rate limit 등으로 실패 시 무시
        }
      };

      onProgress = (status: string) => {
        const now = Date.now();
        if (now - lastUpdateTime >= 2000) {
          lastUpdateTime = now;
          pendingStatus = null;
          if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }
          flushThinkingUpdate(status);
        } else {
          pendingStatus = status;
          if (!updateTimer) {
            const delay = 2000 - (now - lastUpdateTime);
            updateTimer = setTimeout(() => {
              updateTimer = null;
              if (pendingStatus) {
                lastUpdateTime = Date.now();
                flushThinkingUpdate(pendingStatus);
                pendingStatus = null;
              }
            }, delay);
          }
        }
      };
    }

    // Claude Agent 호출
    const response = await queryAgent({
      prompt: inputText,
      cwd,
      threadMessages,
      sessionId,
      resumeId,
      isOwner,
      attachments,
      mode,
      onProgress,
    });

    // 남은 타이머 정리
    if (updateTimer) clearTimeout(updateTimer);

    // 세션 업데이트 (channel 모드는 스킵)
    if (mode !== 'channel') {
      sessionManager.update(threadTs, {
        resumeId: response.resumeId,
        messageCount: sessionMessageCount + 1,
      });
    }

    // 응답 전송 — "생각 중..." 메시지를 교체
    const responseText = truncateText(response.text);

    if (thinkingTs) {
      try {
        await client.chat.update({
          channel: channelId,
          ts: thinkingTs,
          text: responseText,
        });
      } catch {
        // update 실패 시 새 메시지로 전송
        if (replyInChannel) {
          await say({ text: responseText });
        } else {
          await say({ text: responseText, thread_ts: threadTs });
        }
      }
    } else {
      // thinkingTs가 없으면 직접 응답
      if (replyInChannel) {
        await say({ text: responseText });
      } else {
        await say({ text: responseText, thread_ts: threadTs });
      }
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

    const errorText = '죄송합니다. 메시지 처리 중 오류가 발생했습니다.';

    // "생각 중..." 메시지를 에러 메시지로 교체
    if (thinkingTs) {
      try {
        await client.chat.update({
          channel: channelId,
          ts: thinkingTs,
          text: errorText,
        });
        return;
      } catch {
        // update 실패 시 새 메시지
      }
    }

    if (replyInChannel) {
      await say({ text: errorText });
    } else {
      await say({ text: errorText, thread_ts: threadTs });
    }
  }
}
