import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { buildSystemPrompt } from './systemPrompt.js';
import { createCanUseTool } from './permissions.js';
import { getMcpServers } from './tools/loader.js';
import { loadConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getEventBus } from '../events/eventBus.js';
import type { ConversationMode } from '../slack/listeners/handler.js';
import type { ProjectContext } from './projectContext.js';

// Claude Agent SDK query() 래퍼

/** 도구 사용을 사람이 읽기 쉬운 한 줄로 포맷 */
function formatToolActivity(name: string, input?: Record<string, unknown>): string {
  // 잘 알려진 도구명 → 한글 설명
  const toolDescriptions: Record<string, (input?: Record<string, unknown>) => string> = {
    Read: (i) => `📖 파일 읽는 중${i?.file_path ? `: ${basename(String(i.file_path))}` : ''}`,
    Write: (i) => `✏️ 파일 작성 중${i?.file_path ? `: ${basename(String(i.file_path))}` : ''}`,
    Edit: (i) => `✏️ 파일 수정 중${i?.file_path ? `: ${basename(String(i.file_path))}` : ''}`,
    Bash: (i) => `⚡ 명령어 실행 중${i?.command ? `: ${String(i.command).slice(0, 120)}` : ''}`,
    Grep: (i) => `🔍 검색 중${i?.pattern ? `: ${String(i.pattern).slice(0, 80)}` : ''}`,
    Glob: (i) => `🔍 파일 탐색 중${i?.pattern ? `: ${String(i.pattern).slice(0, 80)}` : ''}`,
    WebSearch: (i) => `🌐 웹 검색 중${i?.query ? `: ${String(i.query).slice(0, 80)}` : ''}`,
    WebFetch: () => '🌐 웹 페이지 확인 중',
    slack_post: (i) => `💬 Slack 메시지 전송 중${i?.channel ? ` → #${String(i.channel)}` : ''}`,
    slack_send_dm: () => '💬 DM 전송 중',
    slack_read_channel: (i) => `📨 채널 읽는 중${i?.channel ? `: #${String(i.channel)}` : ''}`,
    memory_read: () => '🧠 메모리 확인 중',
    memory_write: () => '🧠 메모리 저장 중',
  };

  const formatter = toolDescriptions[name];
  if (formatter) return formatter(input);

  // MCP 도구 등 알 수 없는 도구
  return `🔧 ${name} 도구 사용 중`;
}

/** 파일 경로에서 파일명만 추출 */
function basename(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

export interface Attachment {
  name: string;
  path: string;
  mimetype: string;
}

export interface QueryParams {
  prompt: string;
  cwd: string;
  threadMessages?: Array<{ user: string; text: string; botId?: string }>;
  sessionId: string;
  resumeId?: string;
  isOwner: boolean;
  attachments?: Attachment[];
  /** 대화 모드 */
  mode: ConversationMode;
  /** 스트리밍 중 진행 상태 콜백 (도구 사용, 텍스트 생성 등) */
  onProgress?: (status: string) => void;
  /** 프로젝트 컨텍스트 (로컬 Claude Code 지식 공유) */
  projectContext?: ProjectContext;
}

export interface QueryResult {
  text: string;
  toolsUsed: string[];
  resumeId?: string;
}

/**
 * Claude Agent SDK를 사용하여 응답 생성
 */
export async function queryAgent(params: QueryParams): Promise<QueryResult> {
  const { prompt, cwd, threadMessages, resumeId, isOwner, attachments, mode, onProgress, projectContext } = params;

  // mode → 시스템 프롬프트 컨텍스트 매핑
  const promptContext = mode === 'channel' ? 'channel' : mode === 'dm' ? 'dm' : 'mention' as const;

  // 스레드 컨텍스트를 프롬프트에 포함 (최근 10개 메시지만)
  let fullPrompt = prompt;
  if (threadMessages && threadMessages.length > 0) {
    const recentMessages = threadMessages.slice(-10);
    const threadContext = recentMessages
      .map(m => {
        const role = m.botId ? `🤖 앱(${m.user})` : `👤 사용자(${m.user})`;
        return `[${role}]: ${m.text}`;
      })
      .join('\n');
    const truncatedNote = threadMessages.length > 10
      ? `(이전 ${threadMessages.length - 10}개 메시지 생략)\n`
      : '';
    fullPrompt = `스레드 대화 컨텍스트:\n${truncatedNote}${threadContext}\n\n현재 메시지:\n${prompt}`;
  }

  // 첨부파일 정보를 프롬프트에 추가 (이미지는 강조 지시)
  if (attachments && attachments.length > 0) {
    const attachmentLines = attachments.map(a => {
      if (a.mimetype.startsWith('image/')) {
        return `[필수] 첨부 이미지: ${a.name} (경로: ${a.path}) — 반드시 Read 도구로 이미지를 확인한 후 답변하세요`;
      }
      return `첨부 파일: ${a.name} (경로: ${a.path}) — Read 도구로 확인하세요`;
    });
    fullPrompt += `\n\n${attachmentLines.join('\n')}`;
  }

  // 시스템 프롬프트 생성 (컨텍스트 분리 + 프로젝트 지식 주입)
  const systemPrompt = buildSystemPrompt(cwd, promptContext, projectContext);

  // MCP 서버 설정 (channel 모드는 도구 불가 → MCP 프로세스 불필요)
  const mcpServers = mode === 'channel' ? {} : getMcpServers(cwd);

  // 역할 + 모드 기반 권한
  const config = loadConfig();
  const botName = config.slack?.botName || '비서봇';
  const canUseTool = createCanUseTool(isOwner, botName, mode);

  // Agent SDK 호출
  const toolsUsed: string[] = [];
  let responseText = '';
  let newResumeId: string | undefined;

  try {
    const q = query({
      prompt: fullPrompt,
      options: {
        customSystemPrompt: systemPrompt,
        cwd,
        canUseTool,
        mcpServers,
        maxTurns: mode === 'channel' ? 3 : mode === 'dm' ? 15 : isOwner ? 10 : 5,
        ...(resumeId ? { resume: resumeId } : {}),
      },
    });

    // EventBus (스트리밍 이벤트 발행용)
    const bus = getEventBus();

    // 진행 상태 추적 (최근 활동 기록)
    const activities: string[] = [];
    const pushActivity = (line: string) => {
      activities.push(line);
      // 최근 5개만 유지
      if (activities.length > 5) activities.shift();
      onProgress?.(activities.join('\n'));
    };

    // MCP 서버 연결 실패 추적
    const failedServers: Array<{ name: string; status: string }> = [];

    for await (const message of q) {
      // system init 메시지에서 MCP 서버 연결 상태 캡처
      if (message.type === 'system') {
        const sysMsg = message as SDKMessage & {
          subtype?: string;
          mcp_servers?: Array<{ name: string; status: string }>;
        };
        if (sysMsg.subtype === 'init' && sysMsg.mcp_servers) {
          for (const server of sysMsg.mcp_servers) {
            // 내장 도구 서버는 로그 생략
            if (server.name === '_builtin' || server.name === 'clackbot-builtin') continue;
            if (server.status === 'connected') {
              logger.info(`MCP 서버 연결 성공: ${server.name}`);
            } else {
              logger.warn(`MCP 서버 연결 실패: ${server.name} (${server.status})`);
              failedServers.push(server);
              pushActivity(`⚠️ MCP 서버 연결 실패: ${server.name}`);
            }
          }
        }
      }

      // 결과 메시지에서 최종 텍스트 추출
      if (message.type === 'result') {
        const resultMsg = message as SDKMessage & { subtype?: string; result?: string; session_id?: string };
        if (resultMsg.subtype === 'success' && resultMsg.result) {
          responseText = resultMsg.result;
        }
      }

      // assistant 메시지에서 텍스트 블록 추출
      if (message.type === 'assistant') {
        const assistantMsg = message as SDKMessage & {
          message?: { content?: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }> };
          session_id?: string;
        };

        // 세션 ID 추출
        if ('session_id' in message) {
          newResumeId = (message as SDKMessage & { session_id?: string }).session_id;
        }

        // 텍스트 수집 + 진행 상태 보고
        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            if (block.type === 'text' && block.text) {
              if (!responseText) responseText = '';
              responseText += block.text;
              // 텍스트의 첫 줄을 활동으로 기록
              const firstLine = block.text.split('\n')[0].trim().slice(0, 120);
              if (firstLine) {
                pushActivity(`💬 ${firstLine}`);
              }
              // EventBus: 텍스트 토큰 이벤트 발행
              bus.emit('agent:stream', {
                sessionId: params.sessionId,
                type: 'token',
                data: { content: block.text },
              });
            }
            // 도구 사용 추적 + 진행 상태 보고
            if (block.type === 'tool_use' && block.name) {
              toolsUsed.push(block.name);
              const toolLabel = formatToolActivity(block.name, block.input);
              pushActivity(toolLabel);
              // EventBus: 도구 사용 이벤트 발행
              bus.emit('agent:stream', {
                sessionId: params.sessionId,
                type: 'tool_use',
                data: { toolName: block.name },
              });
            }
          }
        }
      }

      // user 메시지의 tool_result 블록에서 도구 결과 이벤트 발행
      if (message.type === 'user') {
        const userMsg = message as SDKMessage & {
          message?: {
            content?: Array<{
              type: string;
              tool_use_id?: string;
              content?: string | Array<{ type: string; text?: string }>;
            }>;
          };
        };
        if (userMsg.message?.content) {
          for (const block of userMsg.message.content) {
            if (block.type === 'tool_result') {
              // tool_result의 content를 문자열로 추출
              let resultText: string | undefined;
              if (typeof block.content === 'string') {
                resultText = block.content;
              } else if (Array.isArray(block.content)) {
                const textParts: string[] = [];
                for (const c of block.content) {
                  if (c.type === 'text' && c.text) textParts.push(c.text);
                }
                resultText = textParts.join('\n');
              }
              bus.emit('agent:stream', {
                sessionId: params.sessionId,
                type: 'tool_result',
                data: { toolResult: resultText?.slice(0, 500) },
              });
            }
          }
        }
      }
    }

    // 연결 실패한 MCP 서버 요약 로깅
    if (failedServers.length > 0) {
      const names = failedServers.map(s => `${s.name}(${s.status})`).join(', ');
      logger.warn(`MCP 서버 연결 실패 요약: ${names}`);
    }
  } catch (error) {
    logger.error(`Agent SDK 호출 실패: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }

  return {
    text: responseText || '응답을 생성하지 못했습니다.',
    toolsUsed: [...new Set(toolsUsed)],
    resumeId: newResumeId,
  };
}
