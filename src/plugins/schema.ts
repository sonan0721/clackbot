import { z } from 'zod';

// 플러그인 manifest.json 스키마

export const PluginMcpSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
});

export const PluginDashboardSchema = z.object({
  page: z.string(),                      // page.js 파일명
  navLabel: z.string().optional(),       // 네비게이션 표시 이름 (없으면 displayName 사용)
});

export const PluginManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, '소문자 영문, 숫자, 하이픈만 허용'),
  displayName: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  mcp: PluginMcpSchema.optional(),       // MCP 서버 설정 (생략 시 대시보드 전용)
  dashboard: PluginDashboardSchema.optional(),  // 대시보드 설정 (생략 시 도구 전용)
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type PluginMcp = z.infer<typeof PluginMcpSchema>;
export type PluginDashboard = z.infer<typeof PluginDashboardSchema>;
