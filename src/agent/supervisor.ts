import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { EventEmitter } from 'node:events';
import { loadConfig } from '../config/index.js';
import { getMcpServers } from './tools/loader.js';
import { logger } from '../utils/logger.js';

// 슈퍼바이저 에이전트 — 규칙 파일 편집, 설정 관리, Slack 명령 실행

export interface SupervisorEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'file_changed';
  data: string;
}

// 감시 대상 규칙 파일
const WATCHED_FILES = ['CLAUDE.md', 'rules.md', '.clackbot/rules.md'];

export class Supervisor extends EventEmitter {
  private resumeId?: string;

  /** 사용자 메시지를 에이전트에 전달하고 결과를 이벤트로 emit */
  async send(message: string): Promise<void> {
    const config = loadConfig();
    const cwd = process.cwd();

    const systemPrompt = `당신은 Clackbot 슈퍼바이저입니다.
봇의 규칙 파일을 편집하고, 설정을 관리하며, Slack 명령을 실행할 수 있습니다.

작업 가능 범위:
1. 규칙 파일 편집: CLAUDE.md, rules.md, .clackbot/rules.md
2. 봇 설정 확인 및 조언
3. Slack 채널에 메시지 전송 (slack_post 도구)
4. 웹 검색, 파일 읽기 등 일반 도구 사용

현재 설정:
- 접근 모드: ${config.accessMode}
- 응답 모드: ${config.replyMode}
- 성격 프리셋: ${config.personality.preset}
- 세션 최대 메시지: ${config.session.maxMessages}
- 세션 타임아웃: ${config.session.timeoutMinutes}분
- 설치된 MCP 서버: ${Object.keys(config.mcpServers).length > 0
  ? Object.keys(config.mcpServers).join(', ')
  : '(없음)'}

중요:
- 한국어로 답변하세요
- 파일 편집 시 신중하게 작업하세요
- 규칙 파일 변경 시 변경 내용을 설명하세요`;

    try {
      const mcpServers = getMcpServers(cwd);

      const q = query({
        prompt: message,
        options: {
          customSystemPrompt: systemPrompt,
          cwd,
          maxTurns: 20,
          mcpServers,
          canUseTool: async (toolName, input) => {
            // 슈퍼바이저는 넓은 권한 (Write, Edit, Bash 포함)
            const allowed = new Set([
              'Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch',
              'Write', 'Edit', 'Bash', 'Task',
            ]);
            if (allowed.has(toolName) || toolName.startsWith('mcp__')) {
              return { behavior: 'allow', updatedInput: input };
            }
            return { behavior: 'deny', message: `슈퍼바이저: ${toolName} 도구는 사용할 수 없습니다.` };
          },
          ...(this.resumeId ? { resume: this.resumeId } : {}),
        },
      });

      for await (const msg of q) {
        if (msg.type === 'assistant') {
          const assistantMsg = msg as SDKMessage & {
            message?: { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> };
            session_id?: string;
          };

          if ('session_id' in msg) {
            this.resumeId = (msg as SDKMessage & { session_id?: string }).session_id;
          }

          if (assistantMsg.message?.content) {
            for (const block of assistantMsg.message.content) {
              if (block.type === 'text' && block.text) {
                this.emit('event', { type: 'text', data: block.text } as SupervisorEvent);
              }
              if (block.type === 'tool_use' && block.name) {
                this.emit('event', {
                  type: 'tool_call',
                  data: JSON.stringify({ name: block.name, input: block.input }),
                } as SupervisorEvent);

                // 규칙 파일 변경 감지
                if (block.name === 'Write' || block.name === 'Edit') {
                  const filePath = (block.input as Record<string, unknown>)?.file_path as string;
                  if (filePath) {
                    for (const watched of WATCHED_FILES) {
                      if (filePath.endsWith(watched)) {
                        this.emit('event', {
                          type: 'file_changed',
                          data: watched,
                        } as SupervisorEvent);
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (msg.type === 'result') {
          const resultMsg = msg as SDKMessage & { subtype?: string; result?: string };
          if (resultMsg.subtype === 'success' && resultMsg.result) {
            this.emit('event', { type: 'text', data: resultMsg.result } as SupervisorEvent);
          }
        }
      }

      this.emit('event', { type: 'done', data: '' } as SupervisorEvent);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`슈퍼바이저 오류: ${errMsg}`);
      this.emit('event', { type: 'error', data: errMsg } as SupervisorEvent);
    }
  }

  /** 세션 리셋 */
  reset(): void {
    this.resumeId = undefined;
  }
}
