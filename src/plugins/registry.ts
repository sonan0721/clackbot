import fs from 'node:fs';
import path from 'node:path';
import { getPluginsDir } from '../config/paths.js';
import { PluginManifestSchema, type PluginManifest } from './schema.js';
import { logger } from '../utils/logger.js';

// 플러그인 레지스트리 — .clackbot/plugins/*/manifest.json 스캔

export interface LoadedPlugin {
  name: string;
  displayName: string;
  description: string;
  dir: string;              // 절대 경로
  manifest: PluginManifest;
  hasMcp: boolean;
  hasDashboard: boolean;
}

/** 모든 플러그인 로드 */
export function loadPlugins(cwd?: string): LoadedPlugin[] {
  const pluginsDir = getPluginsDir(cwd);

  if (!fs.existsSync(pluginsDir)) return [];

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  const plugins: LoadedPlugin[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pluginDir = path.join(pluginsDir, entry.name);
    const manifestPath = path.join(pluginDir, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      logger.warn(`플러그인 manifest 없음: ${entry.name}/manifest.json`);
      continue;
    }

    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const manifest = PluginManifestSchema.parse(raw);

      // 폴더명과 manifest.name 일치 확인
      if (manifest.name !== entry.name) {
        logger.warn(`플러그인 이름 불일치: 폴더 '${entry.name}' vs manifest '${manifest.name}'`);
        continue;
      }

      // dashboard.page 파일 존재 확인
      if (manifest.dashboard?.page) {
        const pagePath = path.join(pluginDir, manifest.dashboard.page);
        if (!fs.existsSync(pagePath)) {
          logger.warn(`플러그인 페이지 파일 없음: ${entry.name}/${manifest.dashboard.page}`);
          continue;
        }
      }

      plugins.push({
        name: manifest.name,
        displayName: manifest.displayName || manifest.name,
        description: manifest.description || '',
        dir: pluginDir,
        manifest,
        hasMcp: !!manifest.mcp,
        hasDashboard: !!manifest.dashboard,
      });
    } catch (error) {
      logger.warn(`플러그인 로드 실패 (${entry.name}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return plugins;
}

/** 특정 플러그인 조회 */
export function getPlugin(name: string, cwd?: string): LoadedPlugin | null {
  const plugins = loadPlugins(cwd);
  return plugins.find(p => p.name === name) || null;
}
