import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import fs from 'node:fs';
import { getMemoryPath } from '../../../config/paths.js';

// [내장 도구] memory.md 읽기/쓰기

export const memoryReadTool = tool(
  'memory_read',
  '메모리 파일(.clackbot/memory.md)을 읽습니다',
  {},
  async () => {
    const memoryPath = getMemoryPath();

    try {
      if (!fs.existsSync(memoryPath)) {
        return {
          content: [{ type: 'text' as const, text: '메모리 파일이 비어 있습니다.' }],
        };
      }

      const content = fs.readFileSync(memoryPath, 'utf-8');
      return {
        content: [{ type: 'text' as const, text: content }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `메모리 읽기 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);

export const memoryWriteTool = tool(
  'memory_write',
  '메모리 파일(.clackbot/memory.md)에 내용을 추가합니다',
  {
    content: z.string().describe('추가할 메모리 내용'),
  },
  async (args) => {
    const memoryPath = getMemoryPath();

    try {
      const existing = fs.existsSync(memoryPath)
        ? fs.readFileSync(memoryPath, 'utf-8')
        : '# 메모리\n\n';

      const updated = existing.trimEnd() + '\n\n' + args.content + '\n';
      fs.writeFileSync(memoryPath, updated, 'utf-8');

      return {
        content: [{ type: 'text' as const, text: '메모리가 업데이트되었습니다.' }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `메모리 쓰기 실패: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  },
);
