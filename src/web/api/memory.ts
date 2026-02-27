import fs from 'node:fs';
import { Router } from 'express';
import { getMemoryPath, getLocalDir } from '../../config/paths.js';
import { listBrainFiles, readBrainFile, getMemoryHistory } from '../../store/brainMemory.js';

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
    res.json({ message: '메모리가 저장되었습니다.' });
  } catch {
    res.status(500).json({ error: '메모리 파일 저장 실패' });
  }
});

// ─── Brain 메모리 API ───

// 메모리 파일 트리
router.get('/brain', (_req, res) => {
  const cwd = getLocalDir();
  const files = listBrainFiles(cwd);
  res.json({ files });
});

// 메모리 파일 내용 또는 변경 이력
router.get('/brain/:path(*)', (req, res) => {
  const brainPath = (req.params as Record<string, string>)['path'];
  // /history 접미사 → 변경 이력 조회
  if (brainPath.endsWith('/history')) {
    const filePath = brainPath.replace(/\/history$/, '');
    const history = getMemoryHistory(filePath);
    res.json(history);
    return;
  }
  const cwd = getLocalDir();
  const content = readBrainFile(cwd, brainPath);
  res.json({ path: brainPath, content });
});

export default router;
