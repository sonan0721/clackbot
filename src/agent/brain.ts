import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { getMcpServers } from './tools/loader.js';
import { setBrainCwd } from './tools/builtin/brainMemory.js';
import { loadCoreMemory, readBrainFile } from '../store/brainMemory.js';
import {
  createAgentSession,
  updateAgentSession,
  logActivity,
} from '../store/agentSessions.js';
import { logger } from '../utils/logger.js';

// ─── Brain Agent 모듈 ───
// 글로벌 비서 역할의 Brain Agent. 메모리 관리, 라우팅 판단, Sub Agent 감독.

// ─── 타입 정의 ───

export interface BrainQueryParams {
  /** 사용자 프롬프트 */
  prompt: string;
  /** .clackbot 디렉토리 기준 cwd */
  cwd: string;
  /** Slack 스레드 타임스탬프 (세션 추적용) */
  threadTs?: string;
  /** Owner 여부 (Brain은 항상 Owner 권한) */
  isOwner: boolean;
  /** 스트리밍 진행 상태 콜백 */
  onProgress?: (status: string) => void;
}

export interface BrainQueryResult {
  /** 최종 응답 텍스트 */
  text: string;
  /** 사용된 도구 목록 (중복 제거) */
  toolsUsed: string[];
  /** 생성/사용된 세션 ID */
  sessionId: string;
}

// ─── 시스템 프롬프트 빌더 ───

/**
 * Brain Agent 전용 시스템 프롬프트 생성
 * @param coreMemory - loadCoreMemory()로 로드된 코어 메모리
 * @param activeSessions - 활성 세션 요약 문자열
 */
export function buildBrainSystemPrompt(coreMemory: string, activeSessions: string): string {
  const parts: string[] = [];

  // Brain Agent 역할 정의
  parts.push(`당신은 *Brain Agent* — Clackbot의 글로벌 비서 에이전트입니다.

## 역할
- 사용자의 모든 Slack 메시지를 수신하고, 적절한 응답을 제공합니다
- 장기 메모리(brain_memory)를 관리하여 사용자 선호, 맥락, 학습된 지식을 유지합니다
- 복잡한 작업이 필요하면 Sub Agent(Task/Skill)를 생성하여 위임합니다
- 활성 세션을 모니터링하고, 필요 시 종료합니다

## 사용 가능한 도구
- \`brain_memory_read\` / \`brain_memory_write\` / \`brain_memory_search\` / \`brain_memory_list\` — Brain 메모리 파일 관리
- \`brain_list_sessions\` / \`brain_kill_session\` — Sub Agent 세션 관리
- \`slack_post\` / \`slack_send_dm\` / \`slack_read_channel\` / \`slack_read_thread\` — Slack 연동
- \`Task\` — Sub Agent를 생성하여 복잡한 작업 위임
- \`Skill\` — 등록된 스킬 호출
- \`Read\` / \`Write\` / \`Edit\` — 파일 시스템 접근

## 판단 기준: 직접 응답 vs Sub Agent 위임
*직접 응답*하는 경우:
- 단순 질문/인사/일상 대화
- 메모리 조회/저장 요청
- 세션 관리 요청
- 1~2단계로 완료 가능한 간단한 작업

*Sub Agent(Task)에 위임*하는 경우:
- 여러 도구를 조합해야 하는 복잡한 작업
- 시간이 오래 걸리는 작업 (코드 분석, 리서치 등)
- 특정 프로젝트 컨텍스트가 필요한 작업

## 메모리 정책
- 사용자가 '기억해', '저장해', '메모해' 등 *명시적으로 요청*할 때만 brain_memory_write 사용
- 중요한 사용자 선호/패턴을 발견하면 memory.md에 기록
- 채널별 컨텍스트는 channels/{channelName}.md에 기록
- 불확실한 정보는 저장하지 말고 사용자에게 확인`);

  // 코어 메모리 주입
  if (coreMemory && coreMemory.trim()) {
    parts.push(`\n---\n## 코어 메모리\n${coreMemory}`);
  } else {
    parts.push(`\n---\n## 코어 메모리\n(메모리가 비어 있습니다. 사용자가 저장을 요청하면 brain_memory_write로 기록하세요.)`);
  }

  // 활성 세션 주입
  if (activeSessions && activeSessions.trim()) {
    parts.push(`\n---\n## 활성 세션\n${activeSessions}`);
  } else {
    parts.push(`\n---\n## 활성 세션\n(현재 활성 세션이 없습니다.)`);
  }

  // Slack mrkdwn 포맷 규칙
  parts.push(`\n## Slack 포맷
Slack mrkdwn 문법 사용. 굵게: *텍스트*, 기울임: _텍스트_, 취소선: ~텍스트~, 링크: <URL|텍스트>, 코드: \`코드\`, 코드블록: \`\`\`코드\`\`\`, 인용: > 텍스트. 제목(#)은 *굵은 텍스트*로 대체.
Markdown 문법(**굵게**, [링크](url), ### 제목) 사용 금지.`);

  // 한국어 선호
  parts.push(`\n## 언어
한국어로 응답하세요. 기술 용어는 영문 유지 가능.`);

  return parts.join('\n');
}

// ─── 쿼리 옵션 빌더 ───

/** buildBrainQueryOptions의 파라미터 */
export interface BrainQueryOptionsParams {
  cwd: string;
  mcpServers: Record<string, unknown>;
}

/** buildBrainQueryOptions의 반환 타입 */
export interface BrainQueryOptionsResult {
  allowedTools: string[];
  mcpServers: Record<string, unknown>;
  maxTurns: number;
  cwd: string;
}

/**
 * Brain Agent query() 호출 옵션 생성
 */
export function buildBrainQueryOptions(params: BrainQueryOptionsParams): BrainQueryOptionsResult {
  const { cwd, mcpServers } = params;

  // Brain Agent가 사용할 수 있는 도구 목록
  const allowedTools: string[] = [
    // Claude Code 내장 도구
    'Task',
    'Skill',
    'Read',
    'Write',
    'Edit',
    'Bash',
    'Grep',
    'Glob',
    'WebSearch',
    'WebFetch',
    // Brain 메모리 도구 (MCP)
    'brain_memory_read',
    'brain_memory_write',
    'brain_memory_search',
    'brain_memory_list',
    // 세션 관리 도구 (MCP)
    'brain_list_sessions',
    'brain_kill_session',
    // Slack 도구 (MCP)
    'slack_post',
    'slack_send_dm',
    'slack_read_channel',
    'slack_read_thread',
    // 메모리 도구 (기존 호환)
    'memory_read',
    'memory_write',
  ];

  return {
    allowedTools,
    mcpServers,
    maxTurns: 15,
    cwd,
  };
}

// ─── 도구 활동 포맷 ───

/** 파일 경로에서 파일명만 추출 */
function basename(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/** Brain Agent 도구 사용을 사람이 읽기 쉬운 한 줄로 포맷 */
function formatBrainToolActivity(name: string, input?: Record<string, unknown>): string {
  const toolDescriptions: Record<string, (input?: Record<string, unknown>) => string> = {
    brain_memory_read: (i) => `🧠 메모리 읽는 중${i?.file ? `: ${String(i.file)}` : ''}`,
    brain_memory_write: (i) => `🧠 메모리 저장 중${i?.file ? `: ${String(i.file)}` : ''}`,
    brain_memory_search: (i) => `🧠 메모리 검색 중${i?.query ? `: ${String(i.query)}` : ''}`,
    brain_memory_list: () => '🧠 메모리 목록 조회 중',
    brain_list_sessions: () => '📋 활성 세션 조회 중',
    brain_kill_session: (i) => `🛑 세션 종료 중${i?.sessionId ? `: ${String(i.sessionId).slice(0, 8)}` : ''}`,
    slack_post: (i) => `💬 Slack 메시지 전송 중${i?.channel ? ` → #${String(i.channel)}` : ''}`,
    slack_send_dm: () => '💬 DM 전송 중',
    slack_read_channel: (i) => `📨 채널 읽는 중${i?.channel ? `: #${String(i.channel)}` : ''}`,
    slack_read_thread: () => '📨 스레드 읽는 중',
    Read: (i) => `📖 파일 읽는 중${i?.file_path ? `: ${basename(String(i.file_path))}` : ''}`,
    Write: (i) => `✏️ 파일 작성 중${i?.file_path ? `: ${basename(String(i.file_path))}` : ''}`,
    Edit: (i) => `✏️ 파일 수정 중${i?.file_path ? `: ${basename(String(i.file_path))}` : ''}`,
    Bash: (i) => `⚡ 명령어 실행 중${i?.command ? `: ${String(i.command).slice(0, 120)}` : ''}`,
    Task: () => '🚀 Sub Agent 생성 중',
    Skill: () => '⚡ 스킬 호출 중',
  };

  const formatter = toolDescriptions[name];
  if (formatter) return formatter(input);

  return `🔧 ${name} 도구 사용 중`;
}

// ─── 메인 함수 ───

/**
 * Brain Agent 쿼리 실행
 *
 * 1. Brain cwd 설정
 * 2. 코어 메모리 로드
 * 3. 활성 세션 정보 읽기
 * 4. 시스템 프롬프트 구성
 * 5. DB에 에이전트 세션 생성
 * 6. MCP 서버 로드
 * 7. Agent SDK query() 호출 (스트리밍)
 * 8. 응답 텍스트/도구 사용 추적, 활동 로깅
 * 9. DB 세션 업데이트
 * 10. 결과 반환
 */
export async function queryBrain(params: BrainQueryParams): Promise<BrainQueryResult> {
  const { prompt, cwd, threadTs, onProgress } = params;

  // 1. Brain cwd 설정 (MCP 도구가 참조)
  setBrainCwd(cwd);

  // 2. 코어 메모리 로드
  const coreMemory = loadCoreMemory(cwd);

  // 3. 활성 세션 정보 읽기
  const activeSessions = readBrainFile(cwd, 'sessions.md');

  // 4. 시스템 프롬프트 구성
  const systemPrompt = buildBrainSystemPrompt(coreMemory, activeSessions);

  // 5. DB에 에이전트 세션 생성
  const session = createAgentSession({
    agentType: 'brain',
    threadTs,
    taskDescription: prompt.slice(0, 200),
    cwd,
  });

  // 6. MCP 서버 로드
  const mcpServers = getMcpServers(cwd);

  // 7. 쿼리 옵션 빌드
  const queryOptions = buildBrainQueryOptions({ cwd, mcpServers });

  // 8. Agent SDK 호출 (스트리밍)
  const toolsUsed: string[] = [];
  let responseText = '';

  try {
    const q = query({
      prompt,
      options: {
        customSystemPrompt: systemPrompt,
        cwd: queryOptions.cwd,
        maxTurns: queryOptions.maxTurns,
        mcpServers: queryOptions.mcpServers as Record<string, never>,
        // Brain은 항상 Owner 권한 — 모든 도구 허용
        canUseTool: async (_toolName, input) => ({
          behavior: 'allow' as const,
          updatedInput: input,
        }),
      },
    });

    // 진행 상태 추적
    const activities: string[] = [];
    const pushActivity = (line: string) => {
      activities.push(line);
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
            if (server.name === '_builtin' || server.name === 'clackbot-builtin') continue;
            if (server.status === 'connected') {
              logger.info(`[Brain] MCP 서버 연결 성공: ${server.name}`);
            } else {
              logger.warn(`[Brain] MCP 서버 연결 실패: ${server.name} (${server.status})`);
              failedServers.push(server);
              pushActivity(`⚠️ MCP 서버 연결 실패: ${server.name}`);
            }
          }
        }
      }

      // 결과 메시지에서 최종 텍스트 추출
      if (message.type === 'result') {
        const resultMsg = message as SDKMessage & { subtype?: string; result?: string };
        if (resultMsg.subtype === 'success' && resultMsg.result) {
          responseText = resultMsg.result;
        }
      }

      // assistant 메시지에서 텍스트/도구 블록 추출
      if (message.type === 'assistant') {
        const assistantMsg = message as SDKMessage & {
          message?: {
            content?: Array<{
              type: string;
              text?: string;
              name?: string;
              input?: Record<string, unknown>;
            }>;
          };
        };

        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            // 텍스트 블록 수집
            if (block.type === 'text' && block.text) {
              if (!responseText) responseText = '';
              responseText += block.text;
              const firstLine = block.text.split('\n')[0].trim().slice(0, 120);
              if (firstLine) {
                pushActivity(`💬 ${firstLine}`);
              }
            }

            // 도구 사용 추적 + 활동 로깅
            if (block.type === 'tool_use' && block.name) {
              toolsUsed.push(block.name);
              const toolLabel = formatBrainToolActivity(block.name, block.input);
              pushActivity(toolLabel);

              // DB 활동 기록
              logActivity({
                sessionId: session.id,
                agentType: 'brain',
                activityType: 'tool_use',
                toolName: block.name,
                detail: block.input ? { input: block.input } : undefined,
              });
            }
          }
        }
      }
    }

    // MCP 서버 연결 실패 요약 로깅
    if (failedServers.length > 0) {
      const names = failedServers.map(s => `${s.name}(${s.status})`).join(', ');
      logger.warn(`[Brain] MCP 서버 연결 실패 요약: ${names}`);
    }
  } catch (error) {
    // 세션 상태를 실패로 업데이트
    updateAgentSession(session.id, {
      status: 'failed',
      completedAt: Date.now(),
      resultSummary: error instanceof Error ? error.message : String(error),
    });

    logger.error(`[Brain] Agent SDK 호출 실패: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }

  // 9. DB 세션 업데이트 (완료)
  const uniqueTools = [...new Set(toolsUsed)];
  updateAgentSession(session.id, {
    status: 'completed',
    messageCount: 1,
    toolsUsed: uniqueTools,
    completedAt: Date.now(),
    resultSummary: responseText.slice(0, 500),
  });

  // 10. 결과 반환
  return {
    text: responseText || '응답을 생성하지 못했습니다.',
    toolsUsed: uniqueTools,
    sessionId: session.id,
  };
}
