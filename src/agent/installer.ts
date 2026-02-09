import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { loadConfig, saveConfig } from '../config/index.js';
import { getLocalDir, getPluginsDir } from '../config/paths.js';
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
    const cwd = getLocalDir();

    const systemPrompt = `당신은 Clackbot 플러그인 설치 전문가입니다.
사용자가 원하는 서비스의 MCP 서버를 검색하고 설치를 도와줍니다.

작업 절차:
1. 사용자의 요청을 파악합니다
2. npm에서 관련 MCP 서버 패키지를 검색합니다 (키워드: @modelcontextprotocol, mcp-server)
3. 적절한 패키지를 찾으면 사용자에게 설치 확인을 요청합니다
4. 필요한 환경변수가 있으면 사용자에게 직접 값을 입력받습니다
   - 각 환경변수의 용도를 설명하고 값을 요청하세요
   - 키가 없으면 발급 방법/URL을 안내한 후 "준비되면 입력해주세요"라고 말하세요
   - 모든 필수 환경변수를 수집한 후에만 설치 액션을 실행하세요
5. 모든 정보가 수집되면 JSON 액션을 출력합니다

현재 설치된 MCP 서버:
${Object.keys(config.mcpServers).length > 0
  ? Object.entries(config.mcpServers).map(([name, s]) => {
      const envKeys = s.env ? Object.keys(s.env).join(', ') : '';
      return `- ${name}: ${s.command} ${s.args.join(' ')}${envKeys ? ` (env: ${envKeys})` : ''}`;
    }).join('\n')
  : '(없음)'}

플러그인 시스템:
- 통합 플러그인은 .clackbot/plugins/{name}/ 디렉토리에 manifest.json + page.js로 구성됩니다.
- manifest.json 예시: {"name":"hello","displayName":"Hello","mcp":{...},"dashboard":{"page":"page.js","navLabel":"Hello"}}
- page.js는 IIFE로 감싸서 window.__clackbot_plugins[name]에 render(container, helpers) 함수를 등록합니다.

중요:
- 한국어로 답변하세요
- MCP 서버 설치: {"action":"install","name":"서버이름","command":"npx","args":["-y","패키지명"],"env":{"KEY":"실제값"}}
- MCP 서버 삭제: {"action":"remove","name":"서버이름"}
- MCP 서버 설정 업데이트: {"action":"configure","name":"서버이름","env":{"KEY":"실제값"}}
- 통합 플러그인 설치: {"action":"install-plugin","name":"플러그인이름","manifest":{...},"pageJs":"코드"}
- 검색만 할 때는 일반 텍스트로 답변하세요

절대 금지:
- config.json을 직접 편집하라고 안내하지 마세요
- 환경변수 값에 설명 텍스트나 플레이스홀더를 넣지 마세요 (예: "your-api-key" 금지)
- env의 값은 반드시 사용자가 입력한 실제 값이어야 합니다
- 모든 설정은 이 대화를 통해 처리합니다`;

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
          // result 텍스트는 assistant 메시지와 중복이므로 emit하지 않음
          // 단, JSON 액션 파싱은 수행
          const resultMsg = msg as SDKMessage & { subtype?: string; result?: string };
          if (resultMsg.subtype === 'success' && resultMsg.result) {
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
    const jsonBlocks = this.extractJsonBlocks(text);
    if (jsonBlocks.length === 0) return;

    for (const match of jsonBlocks) {
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

        if (action.action === 'configure' && action.name && action.env) {
          if (config.mcpServers[action.name]) {
            config.mcpServers[action.name].env = {
              ...config.mcpServers[action.name].env,
              ...action.env,
            };
            saveConfig(config);
            logger.info(`MCP 서버 설정 업데이트: ${action.name}`);
          }
        }

        if (action.action === 'install-plugin' && action.name && action.manifest) {
          const pluginDir = path.join(getPluginsDir(), action.name);
          fs.mkdirSync(pluginDir, { recursive: true });
          fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify(action.manifest, null, 2));
          if (action.pageJs) {
            fs.writeFileSync(path.join(pluginDir, 'page.js'), action.pageJs);
          }
          logger.info(`플러그인 설치됨: ${action.name}`);
        }
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }
  }

  /** 텍스트에서 중첩 가능한 JSON 블록 추출 (brace counting) */
  private extractJsonBlocks(text: string): string[] {
    const results: string[] = [];
    let i = 0;
    while (i < text.length) {
      if (text[i] === '{') {
        let depth = 0;
        let start = i;
        let inString = false;
        let escape = false;
        for (let j = i; j < text.length; j++) {
          const ch = text[j];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') depth++;
          if (ch === '}') depth--;
          if (depth === 0) {
            const candidate = text.slice(start, j + 1);
            if (/"action"\s*:\s*"(?:install|remove|install-plugin|configure)"/.test(candidate)) {
              results.push(candidate);
            }
            i = j + 1;
            break;
          }
        }
        if (depth !== 0) break; // 닫히지 않은 JSON
      } else {
        i++;
      }
    }
    return results;
  }

  /** 세션 리셋 */
  reset(): void {
    this.resumeId = undefined;
  }
}
