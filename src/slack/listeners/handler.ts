import type { WebClient } from '@slack/web-api';
import { queryAgent, type Attachment } from '../../agent/claude.js';
import { queryBrain } from '../../agent/brain.js';
import { resolveProjectContext } from '../../agent/projectContext.js';
import { sessionManager } from '../../session/manager.js';
import { saveConversation } from '../../store/conversations.js';
import { getAgentSessionByThread } from '../../store/agentSessions.js';
import { initBrainMemory } from '../../store/brainMemory.js';
import { getLocalDir } from '../../config/paths.js';
import { loadConfig } from '../../config/index.js';
import { truncateText, markdownToMrkdwn } from '../../utils/slackFormat.js';
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

    // 프로젝트 태그 파싱: "[dev] API 추가해줘" → 프로젝트 컨텍스트 로드
    const projectResult = resolveProjectContext(inputText);
    const effectiveInput = projectResult.cleanPrompt;

    // 프로젝트 태그 오류 시 안내 메시지
    if (projectResult.error) {
      const errorText = projectResult.error;
      if (thinkingTs) {
        try {
          await client.chat.update({ channel: channelId, ts: thinkingTs, text: errorText });
          return;
        } catch { /* update 실패 시 아래에서 새 메시지 */ }
      }
      if (replyInChannel) {
        await say({ text: errorText });
      } else {
        await say({ text: errorText, thread_ts: threadTs });
      }
      return;
    }

    // Brain 메모리 디렉토리 초기화 (최초 1회 생성)
    try {
      initBrainMemory(cwd);
    } catch (brainInitErr) {
      logger.warn(`Brain 메모리 초기화 실패 (무시): ${brainInitErr}`);
    }

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

    // Brain/Sub Agent 라우팅: 활성 Sub Agent 세션이 있는지 확인
    let activeSubAgent: ReturnType<typeof getAgentSessionByThread> = null;
    if (mode !== 'channel') {
      try {
        const agentSession = getAgentSessionByThread(threadTs);
        // Brain 세션이 아닌 활성 Sub Agent 세션만 대상
        if (agentSession && agentSession.agentType !== 'brain') {
          activeSubAgent = agentSession;
          logger.debug(`활성 Sub Agent 세션 발견: ${agentSession.id} (${agentSession.agentType})`);
        }
      } catch (err) {
        logger.warn(`Sub Agent 세션 조회 실패 (무시): ${err}`);
      }
    }

    logger.debug(`처리 시작 [${mode}]: "${inputText.slice(0, 50)}..." → ${activeSubAgent ? 'Sub Agent 계속' : 'Brain Agent'}`);

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

    // Agent 호출: Sub Agent 계속 vs Brain Agent 라우팅
    let response: { text: string; toolsUsed: string[]; resumeId?: string };

    if (activeSubAgent) {
      // ── 활성 Sub Agent가 있으면 기존 queryAgent()로 대화 계속 ──
      const subResumeId = activeSubAgent.resumeId || resumeId;
      response = await queryAgent({
        prompt: effectiveInput,
        cwd,
        threadMessages,
        sessionId,
        resumeId: subResumeId,
        isOwner,
        attachments,
        mode,
        onProgress,
        projectContext: projectResult.context ?? undefined,
      });
    } else if (mode === 'channel') {
      // ── channel 모드: 1회성 대화, Brain 불필요 → 기존 queryAgent() ──
      response = await queryAgent({
        prompt: effectiveInput,
        cwd,
        threadMessages,
        sessionId,
        resumeId,
        isOwner,
        attachments,
        mode,
        onProgress,
        projectContext: projectResult.context ?? undefined,
      });
    } else {
      // ── Brain Agent로 라우팅 (DM/Thread, Sub Agent 없음) ──
      try {
        const brainResult = await queryBrain({
          prompt: effectiveInput,
          cwd,
          threadTs,
          isOwner,
          onProgress,
        });
        // Brain 결과를 공통 응답 형식으로 변환
        response = {
          text: brainResult.text,
          toolsUsed: brainResult.toolsUsed,
          resumeId: undefined, // Brain은 자체 세션 관리
        };
      } catch (brainErr) {
        // Brain 실패 시 기존 queryAgent()로 폴백
        logger.warn(`Brain Agent 호출 실패, Sub Agent로 폴백: ${brainErr instanceof Error ? brainErr.message : String(brainErr)}`);
        response = await queryAgent({
          prompt: effectiveInput,
          cwd,
          threadMessages,
          sessionId,
          resumeId,
          isOwner,
          attachments,
          mode,
          onProgress,
          projectContext: projectResult.context ?? undefined,
        });
      }
    }

    // 남은 타이머 정리
    if (updateTimer) clearTimeout(updateTimer);

    // 세션 업데이트 (channel 모드는 스킵)
    if (mode !== 'channel') {
      sessionManager.update(threadTs, {
        resumeId: response.resumeId,
        messageCount: sessionMessageCount + 1,
      });
    }

    // 응답 전송 — Markdown→mrkdwn 변환 후 "생각 중..." 메시지를 교체
    const responseText = truncateText(markdownToMrkdwn(response.text));

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
