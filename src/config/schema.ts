import { z } from 'zod';

// 프로젝트 설정 스키마
export const ProjectSchema = z.object({
  id: z.string(),
  directory: z.string(),
  slackChannels: z.array(z.string()).default([]),
  isDefault: z.boolean().default(false),
});

export type Project = z.infer<typeof ProjectSchema>;

// 전체 설정 스키마
export const ConfigSchema = z.object({
  // Slack 설정 (login 시 저장)
  slack: z.object({
    botToken: z.string().optional(),
    appToken: z.string().optional(),
    botUserId: z.string().optional(),
    botName: z.string().optional(),
    teamId: z.string().optional(),
    teamName: z.string().optional(),
  }).default({}),

  // 접근 모드: owner(소유자 전용) / public(누구나)
  accessMode: z.enum(['owner', 'public']).default('owner'),

  // 소유자 Slack User ID (login 시 자동 감지)
  ownerUserId: z.string().optional(),

  // 세션 설정
  session: z.object({
    maxMessages: z.number().default(20),
    timeoutMinutes: z.number().default(30),
  }).default({}),

  // 웹 대시보드 포트
  webPort: z.number().default(3847),

  // 프로젝트 목록
  projects: z.array(ProjectSchema).default([]),
});

export type ClackbotConfig = z.infer<typeof ConfigSchema>;

// 기본 설정값
export const DEFAULT_CONFIG: ClackbotConfig = ConfigSchema.parse({});
