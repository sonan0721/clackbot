import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, relative, dirname } from 'path';
import { getBrainDir, getBrainFilePath } from '../config/paths.js';
import { initDatabase } from './conversations.js';

// ─── Brain 메모리 파일 관리 + 스냅샷 추적 ───

/** 기본 파일 콘텐츠 */
const DEFAULT_FILES: Record<string, string> = {
  'memory.md': '# Brain 메모리\n\n사용자 프로필, 선호, 핵심 패턴을 기록합니다.\n',
  'sessions.md': '# 활성 세션\n\n현재 진행 중인 Sub Agent 세션 요약.\n',
  'knowledge.md': '# 학습된 지식\n\n채널 맥락, 업무 패턴, 반복 작업 등.\n',
  'tasks.md': '# 작업 히스토리\n\n완료/진행중 작업 로그.\n',
};

/** Brain 메모리 디렉토리 초기화 (기본 파일 생성) */
export function initBrainMemory(cwd: string): void {
  const brainDir = getBrainDir(cwd);

  // brain/ 디렉토리 생성
  mkdirSync(brainDir, { recursive: true });

  // channels/ 하위 디렉토리 생성
  mkdirSync(join(brainDir, 'channels'), { recursive: true });

  // 기본 파일이 없으면 생성
  for (const [fileName, content] of Object.entries(DEFAULT_FILES)) {
    const filePath = getBrainFilePath(cwd, fileName);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, 'utf-8');
    }
  }
}

/** Brain 파일 읽기 (없으면 빈 문자열 반환) */
export function readBrainFile(cwd: string, fileName: string): string {
  const filePath = getBrainFilePath(cwd, fileName);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

/** Brain 파일 쓰기 + 스냅샷 저장 */
export function writeBrainFile(
  cwd: string,
  fileName: string,
  content: string,
  changedBy: string,
): void {
  const filePath = getBrainFilePath(cwd, fileName);

  // 하위 디렉토리가 없으면 생성
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // 파일 쓰기
  writeFileSync(filePath, content, 'utf-8');

  // 메모리 스냅샷 DB에 저장
  const database = initDatabase();
  database.prepare(`
    INSERT INTO memory_snapshots (file_path, content, changed_by, created_at)
    VALUES (?, ?, ?, ?)
  `).run(fileName, content, changedBy, Date.now());
}

/** Brain 디렉토리의 모든 .md 파일 목록 (상대 경로) */
export function listBrainFiles(cwd: string): string[] {
  const brainDir = getBrainDir(cwd);
  if (!existsSync(brainDir)) {
    return [];
  }

  const files: string[] = [];

  function walk(dir: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith('.md')) {
        files.push(relative(brainDir, fullPath));
      }
    }
  }

  walk(brainDir);
  return files.sort();
}

/** 검색 결과 타입 */
export interface BrainSearchResult {
  file: string;
  line: string;
  lineNumber: number;
}

/** 모든 Brain 파일에서 키워드 검색 (대소문자 무시) */
export function searchBrainMemory(cwd: string, query: string): BrainSearchResult[] {
  const files = listBrainFiles(cwd);
  const results: BrainSearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const file of files) {
    const content = readBrainFile(cwd, file);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lowerQuery)) {
        results.push({
          file,
          line: lines[i],
          lineNumber: i + 1,
        });
      }
    }
  }

  return results;
}

/** 메모리 스냅샷 이력 타입 */
export interface MemorySnapshot {
  id: number;
  filePath: string;
  content: string;
  changedBy: string;
  createdAt: number;
}

interface MemorySnapshotRow {
  id: number;
  file_path: string;
  content: string;
  changed_by: string;
  created_at: number;
}

/** 특정 파일의 메모리 변경 이력 조회 (최신 순) */
export function getMemoryHistory(filePath: string, limit = 50): MemorySnapshot[] {
  const database = initDatabase();
  const rows = database.prepare(
    'SELECT * FROM memory_snapshots WHERE file_path = ? ORDER BY id DESC LIMIT ?'
  ).all(filePath, limit) as MemorySnapshotRow[];

  return rows.map(row => ({
    id: row.id,
    filePath: row.file_path,
    content: row.content,
    changedBy: row.changed_by,
    createdAt: row.created_at,
  }));
}

/** 코어 메모리 로드 (memory.md + sessions.md 결합, 시스템 프롬프트용) */
export function loadCoreMemory(cwd: string): string {
  const memory = readBrainFile(cwd, 'memory.md');
  const sessions = readBrainFile(cwd, 'sessions.md');

  const parts: string[] = [];

  if (memory) {
    parts.push('=== Brain 메모리 ===');
    parts.push(memory);
  }

  if (sessions) {
    parts.push('=== 활성 세션 ===');
    parts.push(sessions);
  }

  return parts.join('\n\n');
}
