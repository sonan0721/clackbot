import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initDatabase, closeDatabase } from './conversations.js';
import {
  initBrainMemory,
  readBrainFile,
  writeBrainFile,
  listBrainFiles,
  searchBrainMemory,
  getMemoryHistory,
  loadCoreMemory,
} from './brainMemory.js';

describe('brainMemory', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'clackbot-test-'));
    mkdirSync(join(cwd, '.clackbot'), { recursive: true });
    initDatabase(cwd);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('initializes brain directory with default files', () => {
    initBrainMemory(cwd);
    const files = listBrainFiles(cwd);
    expect(files).toContain('memory.md');
    expect(files).toContain('sessions.md');
    expect(files).toContain('knowledge.md');
    expect(files).toContain('tasks.md');
  });

  it('writes and reads brain files', () => {
    initBrainMemory(cwd);
    writeBrainFile(cwd, 'memory.md', '# 테스트 메모리\n- 항목1', 'brain');
    const content = readBrainFile(cwd, 'memory.md');
    expect(content).toContain('# 테스트 메모리');
  });

  it('returns empty string for non-existent file', () => {
    initBrainMemory(cwd);
    const content = readBrainFile(cwd, 'nonexistent.md');
    expect(content).toBe('');
  });

  it('saves memory snapshots on write', () => {
    initBrainMemory(cwd);
    writeBrainFile(cwd, 'memory.md', 'v1', 'brain');
    writeBrainFile(cwd, 'memory.md', 'v2', 'user');
    const history = getMemoryHistory('memory.md');
    expect(history).toHaveLength(2);
    expect(history[0].changedBy).toBe('user');  // most recent first
    expect(history[1].changedBy).toBe('brain');
  });

  it('searches across all brain files', () => {
    initBrainMemory(cwd);
    writeBrainFile(cwd, 'memory.md', '주간보고는 금요일', 'brain');
    writeBrainFile(cwd, 'knowledge.md', '팀 미팅은 월요일', 'brain');
    const results = searchBrainMemory(cwd, '금요일');
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe('memory.md');
  });

  it('search is case insensitive', () => {
    initBrainMemory(cwd);
    writeBrainFile(cwd, 'memory.md', 'Hello World', 'brain');
    const results = searchBrainMemory(cwd, 'hello');
    expect(results).toHaveLength(1);
  });

  it('creates subdirectory files (channels)', () => {
    initBrainMemory(cwd);
    writeBrainFile(cwd, 'channels/dev.md', '# dev 채널', 'brain');
    const content = readBrainFile(cwd, 'channels/dev.md');
    expect(content).toBe('# dev 채널');
    const files = listBrainFiles(cwd);
    expect(files).toContain('channels/dev.md');
  });

  it('loadCoreMemory combines memory and sessions', () => {
    initBrainMemory(cwd);
    writeBrainFile(cwd, 'memory.md', '사용자: 소난', 'brain');
    writeBrainFile(cwd, 'sessions.md', '활성 세션 없음', 'brain');
    const core = loadCoreMemory(cwd);
    expect(core).toContain('사용자: 소난');
    expect(core).toContain('활성 세션 없음');
  });
});
