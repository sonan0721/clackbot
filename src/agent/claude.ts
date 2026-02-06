import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { buildSystemPrompt } from './systemPrompt.js';
import { canUseTool } from './permissions.js';
import { getMcpServers } from './tools/loader.js';
import { logger } from '../utils/logger.js';

// Claude Agent SDK query() 래퍼

export interface QueryParams {
  prompt: string;
  cwd: string;
  threadMessages?: Array<{ user: string; text: string }>;
  sessionId: string;
  resumeId?: string;
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
  const { prompt, cwd, threadMessages, resumeId } = params;

  // 스레드 컨텍스트를 프롬프트에 포함
  let fullPrompt = prompt;
  if (threadMessages && threadMessages.length > 0) {
    const context = threadMessages
      .map(m => `[${m.user}]: ${m.text}`)
      .join('\n');
    fullPrompt = `스레드 대화 컨텍스트:\n${context}\n\n현재 메시지:\n${prompt}`;
  }

  // 시스템 프롬프트 생성
  const systemPrompt = buildSystemPrompt(cwd);

  // MCP 서버 설정 (내장 + 플러그인)
  const mcpServers = getMcpServers(cwd);

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
        maxTurns: 10,
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
