import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { EventEmitter } from 'node:events';
import { loadConfig, saveConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

// 플러그인 설치 전용 에이전트

export interface InstallerEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  data: string;
}

export class PluginInstaller extends EventEmitter {
  private resumeId?: string;

  /** 사용자 메시지를 에이전트에 전달하고 결과를 이벤트로 emit */
  async send(message: string): Promise<void> {
    const config = loadConfig();
    const cwd = process.cwd();

    const systemPrompt = `당신은 Clackbot 플러그인 설치 전문가입니다.
사용자가 원하는 서비스의 MCP 서버를 검색하고 설치를 도와줍니다.

작업 절차:
1. 사용자의 요청을 파악합니다
2. npm에서 관련 MCP 서버 패키지를 검색합니다 (키워드: @modelcontextprotocol, mcp-server)
3. 적절한 패키지를 찾으면 사용자에게 설치 확인을 요청합니다
4. 사용자가 승인하면 npx로 실행 가능한 명령어를 구성합니다
5. 필요한 환경변수(API 키 등)가 있으면 사용자에게 안내합니다

현재 설치된 MCP 서버:
${Object.keys(config.mcpServers).length > 0
  ? Object.entries(config.mcpServers).map(([name, s]) => `- ${name}: ${s.command} ${s.args.join(' ')}`).join('\n')
  : '(없음)'}

중요:
- 한국어로 답변하세요
- 설치 결과를 JSON 형태로 보고하세요: {"action":"install","name":"서버이름","command":"npx","args":["-y","패키지명"],"env":{"KEY":"설명"}}
- 삭제 요청 시: {"action":"remove","name":"서버이름"}
- 검색만 할 때는 일반 텍스트로 답변하세요`;

    try {
      const q = query({
        prompt: message,
        options: {
          customSystemPrompt: systemPrompt,
          cwd,
          maxTurns: 20,
          canUseTool: async (toolName, input) => {
            // 설치 에이전트는 더 넓은 권한
            const allowed = new Set(['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Bash', 'Write', 'Task']);
            if (allowed.has(toolName) || toolName.startsWith('mcp__')) {
              return { behavior: 'allow', updatedInput: input };
            }
            return { behavior: 'deny', message: `설치 에이전트: ${toolName} 도구는 사용할 수 없습니다.` };
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
                this.emit('event', { type: 'text', data: block.text } as InstallerEvent);

                // JSON 액션 파싱
                this.tryParseAction(block.text);
              }
              if (block.type === 'tool_use' && block.name) {
                this.emit('event', {
                  type: 'tool_call',
                  data: JSON.stringify({ name: block.name, input: block.input }),
                } as InstallerEvent);
              }
            }
          }
        }

        if (msg.type === 'result') {
          const resultMsg = msg as SDKMessage & { subtype?: string; result?: string };
          if (resultMsg.subtype === 'success' && resultMsg.result) {
            this.emit('event', { type: 'text', data: resultMsg.result } as InstallerEvent);
            this.tryParseAction(resultMsg.result);
          }
        }
      }

      this.emit('event', { type: 'done', data: '' } as InstallerEvent);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`설치 에이전트 오류: ${errMsg}`);
      this.emit('event', { type: 'error', data: errMsg } as InstallerEvent);
    }
  }

  /** 에이전트 응답에서 JSON 액션을 찾아 config에 반영 */
  private tryParseAction(text: string): void {
    // JSON 블록 추출 (```json ... ``` 또는 { ... })
    const jsonMatches = text.match(/\{[^{}]*"action"\s*:\s*"(?:install|remove)"[^{}]*\}/g);
    if (!jsonMatches) return;

    for (const match of jsonMatches) {
      try {
        const action = JSON.parse(match);
        const config = loadConfig();

        if (action.action === 'install' && action.name && action.command) {
          config.mcpServers[action.name] = {
            command: action.command,
            args: action.args ?? [],
            ...(action.env ? { env: action.env } : {}),
          };
          saveConfig(config);
          logger.info(`MCP 서버 설치됨: ${action.name}`);
        }

        if (action.action === 'remove' && action.name) {
          delete config.mcpServers[action.name];
          saveConfig(config);
          logger.info(`MCP 서버 제거됨: ${action.name}`);
        }
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }
  }

  /** 세션 리셋 */
  reset(): void {
    this.resumeId = undefined;
  }
}
