import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { buildSystemPrompt } from './systemPrompt.js';
import { createCanUseTool } from './permissions.js';
import { getMcpServers } from './tools/loader.js';
import { logger } from '../utils/logger.js';

// Claude Agent SDK query() 래퍼

export interface Attachment {
  name: string;
  path: string;
  mimetype: string;
}

export interface QueryParams {
  prompt: string;
  cwd: string;
  threadMessages?: Array<{ user: string; text: string }>;
  sessionId: string;
  resumeId?: string;
  isOwner: boolean;
  attachments?: Attachment[];
  context?: 'dm' | 'mention';
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
  const { prompt, cwd, threadMessages, resumeId, isOwner, attachments, context = 'mention' } = params;

  // 스레드 컨텍스트를 프롬프트에 포함
  let fullPrompt = prompt;
  if (threadMessages && threadMessages.length > 0) {
    const threadContext = threadMessages
      .map(m => `[${m.user}]: ${m.text}`)
      .join('\n');
    fullPrompt = `스레드 대화 컨텍스트:\n${threadContext}\n\n현재 메시지:\n${prompt}`;
  }

  // 첨부파일 정보를 프롬프트에 추가
  if (attachments && attachments.length > 0) {
    const attachmentLines = attachments.map(a => {
      if (a.mimetype.startsWith('image/')) {
        return `첨부 이미지: ${a.name} (경로: ${a.path}) — Read 도구로 확인하세요`;
      }
      return `첨부 파일: ${a.name} (경로: ${a.path}) — Read 도구로 확인하세요`;
    });
    fullPrompt += `\n\n${attachmentLines.join('\n')}`;
  }

  // 시스템 프롬프트 생성 (컨텍스트 분리)
  const systemPrompt = buildSystemPrompt(cwd, context);

  // MCP 서버 설정 (내장 + 플러그인)
  const mcpServers = getMcpServers(cwd);

  // 역할 기반 권한
  const canUseTool = createCanUseTool(isOwner);

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
        maxTurns: isOwner ? 20 : 10,
        ...(resumeId ? { resume: resumeId } : {}),
      },
    });

    for await (const message of q) {
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
          message?: { content?: Array<{ type: string; text?: string; name?: string }> };
          session_id?: string;
        };

        // 세션 ID 추출
        if ('session_id' in message) {
          newResumeId = (message as SDKMessage & { session_id?: string }).session_id;
        }

        // 텍스트 수집
        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            if (block.type === 'text' && block.text) {
              if (!responseText) responseText = '';
              responseText += block.text;
            }
            // 도구 사용 추적
            if (block.type === 'tool_use' && block.name) {
              toolsUsed.push(block.name);
            }
          }
        }
      }
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
