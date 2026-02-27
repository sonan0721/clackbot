import { describe, it, expect } from 'vitest';
import { buildBrainSystemPrompt, buildBrainQueryOptions } from './brain.js';

describe('buildBrainSystemPrompt', () => {
  it('includes core memory in prompt', () => {
    const prompt = buildBrainSystemPrompt('# 테스트 메모리', '# 세션 없음');
    expect(prompt).toContain('# 테스트 메모리');
    expect(prompt).toContain('# 세션 없음');
  });

  it('includes Brain role description', () => {
    const prompt = buildBrainSystemPrompt('', '');
    expect(prompt).toContain('Brain Agent');
  });

  it('handles empty memory gracefully', () => {
    const prompt = buildBrainSystemPrompt('', '');
    expect(prompt).toBeDefined();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('includes Slack mrkdwn format rules', () => {
    const prompt = buildBrainSystemPrompt('', '');
    expect(prompt).toContain('Slack mrkdwn');
    expect(prompt).toContain('Markdown');
  });

  it('includes decision criteria for routing', () => {
    const prompt = buildBrainSystemPrompt('', '');
    expect(prompt).toContain('직접 응답');
  });

  it('includes available tools list', () => {
    const prompt = buildBrainSystemPrompt('', '');
    expect(prompt).toContain('brain_memory');
    expect(prompt).toContain('brain_list_sessions');
    expect(prompt).toContain('slack_');
  });

  it('includes Korean language preference', () => {
    const prompt = buildBrainSystemPrompt('', '');
    expect(prompt).toContain('한국어');
  });
});

describe('buildBrainQueryOptions', () => {
  it('includes Task and Skill in allowedTools', () => {
    const opts = buildBrainQueryOptions({ cwd: '/tmp/test', mcpServers: {} });
    expect(opts.allowedTools).toContain('Task');
    expect(opts.allowedTools).toContain('Skill');
  });

  it('passes mcpServers through', () => {
    const servers = { test: { command: 'test', args: [] } };
    const opts = buildBrainQueryOptions({ cwd: '/tmp', mcpServers: servers });
    expect(opts.mcpServers).toBe(servers);
  });

  it('sets maxTurns', () => {
    const opts = buildBrainQueryOptions({ cwd: '/tmp', mcpServers: {} });
    expect(opts.maxTurns).toBeDefined();
    expect(opts.maxTurns).toBeGreaterThan(0);
  });

  it('sets cwd', () => {
    const opts = buildBrainQueryOptions({ cwd: '/tmp/test', mcpServers: {} });
    expect(opts.cwd).toBe('/tmp/test');
  });

  it('includes Read and Write in allowedTools', () => {
    const opts = buildBrainQueryOptions({ cwd: '/tmp/test', mcpServers: {} });
    expect(opts.allowedTools).toContain('Read');
    expect(opts.allowedTools).toContain('Write');
  });

  it('includes brain MCP tool names in allowedTools', () => {
    const opts = buildBrainQueryOptions({ cwd: '/tmp/test', mcpServers: {} });
    expect(opts.allowedTools).toContain('brain_memory_read');
    expect(opts.allowedTools).toContain('brain_memory_write');
    expect(opts.allowedTools).toContain('brain_memory_search');
    expect(opts.allowedTools).toContain('brain_memory_list');
    expect(opts.allowedTools).toContain('brain_list_sessions');
    expect(opts.allowedTools).toContain('brain_kill_session');
  });
});
