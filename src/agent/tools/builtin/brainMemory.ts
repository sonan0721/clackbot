import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import {
  readBrainFile,
  writeBrainFile,
  searchBrainMemory,
  listBrainFiles,
} from '../../../store/brainMemory.js';
import {
  getActiveSessions,
  updateAgentSession,
} from '../../../store/agentSessions.js';

// [내장 도구] Brain 메모리 관리 + 세션 조회/종료
// Brain Agent가 자체 메모리를 읽고/쓰고/검색하며, Sub Agent 세션을 관리

// Brain 디렉토리의 cwd (외부에서 주입)
let brainCwd: string = process.cwd();

export function setBrainCwd(cwd: string): void {
  brainCwd = cwd;
}

// ─── Brain 메모리 도구 ───

export const brainMemoryReadTool = tool(
  'brain_memory_read',
  'Brain의 메모리 파일을 읽습니다. 파일명: memory.md, sessions.md, knowledge.md, tasks.md, channels/{name}.md',
  {
    file: z.string().describe('읽을 파일명 (예: memory.md, channels/general.md)'),
  },
  async (args) => {
    try {
      const content = readBrainFile(brainCwd, args.file);
      if (!content) {
        return {
          content: [{ type: 'text' as const, text: `파일이 비어 있거나 존재하지 않습니다: ${args.file}` }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: content }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Brain 메모리 읽기 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);

export const brainMemoryWriteTool = tool(
  'brain_memory_write',
  'Brain의 메모리 파일에 내용을 씁니다. 안정적 사실만 저장하세요.',
  {
    file: z.string().describe('쓸 파일명 (예: memory.md, channels/general.md)'),
    content: z.string().describe('파일에 쓸 내용'),
  },
  async (args) => {
    try {
      writeBrainFile(brainCwd, args.file, args.content, 'brain');
      return {
        content: [{ type: 'text' as const, text: `Brain 메모리가 업데이트되었습니다: ${args.file}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Brain 메모리 쓰기 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);

export const brainMemorySearchTool = tool(
  'brain_memory_search',
  'Brain의 모든 메모리 파일에서 키워드를 검색합니다.',
  {
    query: z.string().describe('검색할 키워드'),
  },
  async (args) => {
    try {
      const results = searchBrainMemory(brainCwd, args.query);
      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `검색 결과가 없습니다: "${args.query}"` }],
        };
      }

      const formatted = results
        .map(r => `[${r.file}:${r.lineNumber}] ${r.line}`)
        .join('\n');

      return {
        content: [{ type: 'text' as const, text: `검색 결과 (${results.length}건):\n${formatted}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Brain 메모리 검색 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);

export const brainMemoryListTool = tool(
  'brain_memory_list',
  'Brain 메모리의 모든 파일 목록을 반환합니다.',
  {},
  async () => {
    try {
      const files = listBrainFiles(brainCwd);
      if (files.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'Brain 메모리 파일이 없습니다.' }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: `Brain 메모리 파일 목록:\n${files.join('\n')}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `파일 목록 조회 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);

// ─── 세션 관리 도구 ───

export const brainListSessionsTool = tool(
  'brain_list_sessions',
  '활성 중인 Sub Agent 세션 목록을 조회합니다.',
  {},
  async () => {
    try {
      const sessions = getActiveSessions();
      if (sessions.length === 0) {
        return {
          content: [{ type: 'text' as const, text: '활성 세션이 없습니다.' }],
        };
      }

      const formatted = sessions
        .map(s => [
          `- ID: ${s.id}`,
          `  유형: ${s.agentType}`,
          s.taskDescription ? `  설명: ${s.taskDescription}` : null,
          `  메시지: ${s.messageCount}개`,
          `  마지막 활동: ${new Date(s.lastActiveAt).toISOString()}`,
        ].filter(Boolean).join('\n'))
        .join('\n');

      return {
        content: [{ type: 'text' as const, text: `활성 세션 ${sessions.length}개:\n${formatted}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `세션 목록 조회 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);

export const brainKillSessionTool = tool(
  'brain_kill_session',
  'Sub Agent 세션을 종료합니다.',
  {
    sessionId: z.string().describe('종료할 세션 ID'),
  },
  async (args) => {
    try {
      updateAgentSession(args.sessionId, {
        status: 'expired',
        completedAt: Date.now(),
      });
      return {
        content: [{ type: 'text' as const, text: `세션이 종료되었습니다: ${args.sessionId}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `세션 종료 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);

// ─── 도구 배열 (등록용) ───

export const brainTools = [
  brainMemoryReadTool,
  brainMemoryWriteTool,
  brainMemorySearchTool,
  brainMemoryListTool,
  brainListSessionsTool,
  brainKillSessionTool,
];
