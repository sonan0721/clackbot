import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { logger } from '../utils/logger.js';

// Slack 파일 다운로드 유틸리티

export interface DownloadedFile {
  name: string;
  path: string;
  mimetype: string;
}

interface SlackFile {
  name?: string;
  mimetype?: string;
  url_private_download?: string;
}

const DOWNLOAD_DIR = path.join(os.tmpdir(), 'clackbot-files');

/** Slack 이벤트의 파일 목록을 로컬에 다운로드 */
export async function downloadSlackFiles(
  files: SlackFile[],
  botToken: string,
): Promise<DownloadedFile[]> {
  // 다운로드 디렉토리 생성
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  const results: DownloadedFile[] = [];

  for (const file of files) {
    if (!file.url_private_download || !file.name) continue;

    try {
      const response = await fetch(file.url_private_download, {
        headers: {
          'Authorization': `Bearer ${botToken}`,
        },
      });

      if (!response.ok) {
        logger.warn(`파일 다운로드 실패: ${file.name} (${response.status})`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const localPath = path.join(DOWNLOAD_DIR, `${timestamp}_${safeName}`);

      fs.writeFileSync(localPath, buffer);

      results.push({
        name: file.name,
        path: localPath,
        mimetype: file.mimetype ?? 'application/octet-stream',
      });

      logger.debug(`파일 다운로드 완료: ${file.name} → ${localPath}`);
    } catch (error) {
      logger.warn(`파일 다운로드 오류: ${file.name} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return results;
}

/** 다운로드된 파일 정리 */
export function cleanupFiles(files: DownloadedFile[]): void {
  for (const file of files) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch {
      // 정리 실패 무시
    }
  }
}
