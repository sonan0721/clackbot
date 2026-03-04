// SlackSink 테스트 — 3초 디바운스 실시간 업데이트
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackSink } from './slackSink.js';
import { EventBus } from '../events/eventBus.js';

describe('SlackSink', () => {
  let bus: EventBus;
  let mockClient: { chat: { update: ReturnType<typeof vi.fn> } };
  let sink: SlackSink;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = new EventBus();
    mockClient = { chat: { update: vi.fn().mockResolvedValue({}) } };
    sink = new SlackSink(bus, mockClient as any);
  });

  afterEach(() => {
    sink.dispose();
    vi.useRealTimers();
  });

  it('agent:stream token 이벤트를 3초 디바운스로 chat.update 호출', async () => {
    sink.startSession('s1', 'C001', 'ts-msg');
    bus.emit('agent:stream', { sessionId: 's1', type: 'token', data: { content: '안녕' } });
    bus.emit('agent:stream', { sessionId: 's1', type: 'token', data: { content: '하세요' } });
    expect(mockClient.chat.update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockClient.chat.update).toHaveBeenCalledTimes(1);
    expect(mockClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('안녕하세요') }),
    );
  });

  it('thinking 이벤트를 요약 형태로 표시', async () => {
    sink.startSession('s1', 'C001', 'ts-msg');
    bus.emit('agent:stream', {
      sessionId: 's1',
      type: 'thinking',
      data: { thinkingSummary: '채널 분석 중' },
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('채널 분석 중') }),
    );
  });

  it('tool_use 이벤트를 도구명과 함께 표시', async () => {
    sink.startSession('s1', 'C001', 'ts-msg');
    bus.emit('agent:stream', {
      sessionId: 's1',
      type: 'tool_use',
      data: { toolName: 'slack_read_channel' },
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('slack_read_channel') }),
    );
  });

  it('agent:complete로 최종 응답 교체', () => {
    sink.startSession('s1', 'C001', 'ts-msg');
    bus.emit('agent:complete', {
      sessionId: 's1',
      result: { text: '최종 응답입니다', toolsUsed: ['Read'] },
    });
    expect(mockClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('최종 응답입니다') }),
    );
  });

  it('관련 없는 sessionId 이벤트는 무시', async () => {
    sink.startSession('s1', 'C001', 'ts-msg');
    bus.emit('agent:stream', { sessionId: 'other', type: 'token', data: { content: '무시' } });
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockClient.chat.update).not.toHaveBeenCalled();
  });
});
