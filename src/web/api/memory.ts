import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { getMemoryPath, getLocalDir } from '../../config/paths.js';
import { listBrainFiles, readBrainFile, getMemoryHistory } from '../../store/brainMemory.js';
import { getEventBus } from '../../events/eventBus.js';

// GET/PUT /api/memory — 메모리 조회/수정

const router = Router();

// 메모리 조회
router.get('/', (_req, res) => {
  const memoryPath = getMemoryPath();
  try {
    if (fs.existsSync(memoryPath)) {
      const content = fs.readFileSync(memoryPath, 'utf-8');
      res.json({ content });
    } else {
      res.json({ content: '' });
    }
  } catch {
    res.status(500).json({ error: '메모리 파일 읽기 실패' });
  }
});

// 메모리 수정
router.put('/', (req, res) => {
  const memoryPath = getMemoryPath();
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'content는 문자열이어야 합니다.' });
      return;
    }
    fs.writeFileSync(memoryPath, content, 'utf-8');
    try {
      getEventBus().emit('memory:update', {
        memory: { filePath: 'memory.md', source: 'dashboard' as const },
      });
    } catch { /* EventBus 미초기화 시 무시 */ }
    res.json({ message: '메모리가 저장되었습니다.' });
  } catch {
    res.status(500).json({ error: '메모리 파일 저장 실패' });
  }
});

// ─── Brain 메모리 API ───

interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileTreeNode[];
}

/** 플랫 경로 배열을 트리 구조로 변환 */
function buildFileTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const filePath of paths) {
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const currentPath = parts.slice(0, i + 1).join('/');
      const isFile = i === parts.length - 1;

      let existing = current.find(n => n.name === name);
      if (!existing) {
        existing = {
          name,
          type: isFile ? 'file' : 'directory',
          path: currentPath,
          ...(isFile ? {} : { children: [] }),
        };
        current.push(existing);
      }
      if (!isFile) {
        current = existing.children!;
      }
    }
  }

  return root;
}

// 메모리 파일 트리
router.get('/brain', (_req, res) => {
  const cwd = getLocalDir();
  const flatFiles = listBrainFiles(cwd);
  const files = buildFileTree(flatFiles);
  res.json({ files });
});

// Brain 메모리 파일 저장
router.put('/brain/:path(*)', (req, res) => {
  const brainPath = (req.params as Record<string, string>)['path'];
  const cwd = getLocalDir();
  const brainDir = path.join(cwd, 'brain');
  const fullPath = path.join(brainDir, brainPath);

  // 경로 탈출 방지
  if (!fullPath.startsWith(brainDir)) {
    res.status(400).json({ error: '잘못된 경로입니다.' });
    return;
  }

  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'content는 문자열이어야 합니다.' });
      return;
    }
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    try {
      getEventBus().emit('memory:update', {
        memory: { filePath: brainPath, source: 'dashboard' as const },
      });
    } catch { /* EventBus 미초기화 시 무시 */ }
    res.json({ message: '파일이 저장되었습니다.' });
  } catch {
    res.status(500).json({ error: '파일 저장 실패' });
  }
});

// 메모리 파일 내용 또는 변경 이력
router.get('/brain/:path(*)', (req, res) => {
  const brainPath = (req.params as Record<string, string>)['path'];

  // 경로 탈출 방지
  const cwd = getLocalDir();
  const brainDir = path.resolve(path.join(cwd, 'brain'));
  const resolved = path.resolve(path.join(brainDir, brainPath.replace(/\/history$/, '')));
  if (!resolved.startsWith(brainDir + '/') && resolved !== brainDir) {
    res.status(400).json({ error: '잘못된 경로입니다.' });
    return;
  }

  // /history 접미사 → 변경 이력 조회
  if (brainPath.endsWith('/history')) {
    const filePath = brainPath.replace(/\/history$/, '');
    const history = getMemoryHistory(filePath);
    res.json(history);
    return;
  }
  const content = readBrainFile(cwd, brainPath);
  res.json({ path: brainPath, content });
});

export default router;
