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
import { getEventBus } from '../../events/eventBus.js';
import { routeMessage } from '../../router/messageRouter.js';
import { SlackSink } from '../../sinks/slackSink.js';
import type { IncomingMessage } from '../../events/types.js';
import type { ActiveSession } from '../../router/types.js';

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

  // EventBus: 수신 메시지 이벤트 발행
  const bus = getEventBus();
  const incomingMessage: IncomingMessage = {
    id: `${channelId}-${threadTs}-${Date.now()}`,
    source: 'slack',
    text: inputText,
    userId,
    channelId,
    threadTs,
    isOwner,
    mode,
    attachments: attachments?.map(a => ({ name: a.name, path: a.path ?? '', mimeType: a.mimetype ?? '' })),
    threadMessages,
  };
  bus.emit('message:incoming', { source: 'slack', message: incomingMessage });

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

    // SlackSink: 실시간 스트리밍 업데이트 시작
    let slackSink: SlackSink | undefined;
    if (thinkingTs && mode !== 'channel') {
      slackSink = new SlackSink(bus, client);
      slackSink.startSession(sessionId, channelId, thinkingTs);
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

    // Agent 호출: MessageRouter로 라우팅 결정 후 실행
    let response: { text: string; toolsUsed: string[]; resumeId?: string };

    // 활성 세션 정보를 라우터 형식으로 변환
    const activeSessions: ActiveSession[] = [];
    if (activeSubAgent) {
      activeSessions.push({
        sessionId: activeSubAgent.id,
        threadTs,
        agentType: activeSubAgent.agentType as 'brain' | 'sub',
        resumeId: activeSubAgent.resumeId ?? undefined,
        status: 'active',
      });
    }

    const route = routeMessage(incomingMessage, activeSessions);

    switch (route.action) {
      case 'agent_resume': {
        // ── 활성 Sub Agent가 있으면 기존 queryAgent()로 대화 계속 ──
        const subResumeId = route.resumeId || resumeId;
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
        break;
      }
      case 'agent_new': {
        // ── channel 모드 등: 1회성 대화, Brain 불필요 → queryAgent() ──
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
        break;
      }
      case 'brain': {
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
        break;
      }
      default: {
        // direct_reply / reject — 현재 handler에서는 도달하지 않지만 안전장치
        response = { text: '요청을 처리할 수 없습니다.', toolsUsed: [], resumeId: undefined };
        break;
      }
    }

    // 남은 타이머 정리
    if (updateTimer) clearTimeout(updateTimer);
    if (slackSink) slackSink.dispose();

    // EventBus: 에이전트 완료 이벤트 발행
    bus.emit('agent:complete', {
      sessionId,
      result: { text: response.text, toolsUsed: response.toolsUsed, resumeId: response.resumeId },
    });

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
