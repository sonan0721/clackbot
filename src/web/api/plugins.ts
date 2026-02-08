import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlugins, getPlugin } from '../../plugins/registry.js';

// 플러그인 API 라우터

const router = Router();

/** GET /api/plugins — 플러그인 목록 */
router.get('/', (_req, res) => {
  const plugins = loadPlugins();

  res.json({
    plugins: plugins.map(p => ({
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      hasMcp: p.hasMcp,
      hasDashboard: p.hasDashboard,
      pageUrl: p.hasDashboard ? `/api/plugins/${p.name}/page.js` : null,
      navLabel: p.manifest.dashboard?.navLabel || p.displayName,
    })),
    total: plugins.length,
  });
});

/** GET /api/plugins/:name/page.js — 플러그인 페이지 스크립트 서빙 */
router.get('/:name/page.js', (req, res) => {
  const plugin = getPlugin(req.params.name);

  if (!plugin || !plugin.hasDashboard || !plugin.manifest.dashboard?.page) {
    res.status(404).json({ error: '플러그인 페이지를 찾을 수 없습니다.' });
    return;
  }

  const pagePath = path.resolve(plugin.dir, plugin.manifest.dashboard.page);

  // 경로 순회(path traversal) 방지
  if (!pagePath.startsWith(plugin.dir)) {
    res.status(403).json({ error: '접근이 거부되었습니다.' });
    return;
  }

  if (!fs.existsSync(pagePath)) {
    res.status(404).json({ error: '페이지 파일이 존재하지 않습니다.' });
    return;
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(fs.readFileSync(pagePath, 'utf-8'));
});

/** DELETE /api/plugins/:name — 플러그인 삭제 */
router.delete('/:name', (req, res) => {
  const plugin = getPlugin(req.params.name);

  if (!plugin) {
    res.status(404).json({ error: '플러그인을 찾을 수 없습니다.' });
    return;
  }

  try {
    fs.rmSync(plugin.dir, { recursive: true, force: true });
    res.json({ ok: true, message: `플러그인 '${plugin.name}'이 삭제되었습니다.` });
  } catch (error) {
    res.status(500).json({ error: `삭제 실패: ${error instanceof Error ? error.message : String(error)}` });
  }
});

export default router;
