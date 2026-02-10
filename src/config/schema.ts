import { z } from 'zod';

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

  // 소유자 Slack User ID (login 시 자동 감지)
  ownerUserId: z.string().optional(),

  // 세션 설정
  session: z.object({
    maxMessages: z.number().int().min(1).max(1000).default(50),
    timeoutMinutes: z.number().int().min(1).max(1440).default(30),
  }).default({}),

  // 웹 대시보드 포트
  webPort: z.number().int().min(1).max(65535).default(3847),

  // 성격 프리셋
  personality: z.object({
    preset: z.enum([
      'intj', 'intp', 'entj', 'entp',
      'infj', 'infp', 'enfj', 'enfp',
      'istj', 'isfj', 'estj', 'esfj',
      'istp', 'isfp', 'estp', 'esfp',
      'custom',
    ]).default('istj'),
    customPrompt: z.string().optional(),
    thinkingMessage: z.string().default('생각 중...'),
  }).default({}),

  // MCP 서버 설정 (플러그인 설치 시 저장)
  mcpServers: z.record(z.union([
    // SSE 타입
    z.object({
      type: z.literal('sse'),
      url: z.string(),
      headers: z.record(z.string()).optional(),
    }),
    // HTTP 타입
    z.object({
      type: z.literal('http'),
      url: z.string(),
      headers: z.record(z.string()).optional(),
    }),
    // stdio 타입 (기본값 — type 없는 기존 config도 호환)
    z.object({
      type: z.literal('stdio').default('stdio'),
      command: z.string(),
      args: z.array(z.string()).default([]),
      env: z.record(z.string()).optional(),
    }),
  ])).default({}),
});

export type ClackbotConfig = z.infer<typeof ConfigSchema>;

// 기본 설정값
export const DEFAULT_CONFIG: ClackbotConfig = ConfigSchema.parse({});
