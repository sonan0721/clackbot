// WebSocketSink 테스트 — EventBus → WebSocket 브로드캐스트
import { describe, it, expect, vi } from 'vitest';
import { WebSocketSink } from './webSocketSink.js';
import { EventBus } from '../events/eventBus.js';

describe('WebSocketSink', () => {
  it('agent:stream 이벤트를 즉시 브로드캐스트', () => {
    const bus = new EventBus();
    const mockBroadcast = vi.fn();
    const sink = new WebSocketSink(bus, mockBroadcast);

    bus.emit('agent:stream', {
      sessionId: 's1',
      type: 'token',
      data: { content: '안녕' },
    });

    expect(mockBroadcast).toHaveBeenCalledTimes(1);
    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'agent:stream', type: 'token' }),
    );

    sink.dispose();
  });

  it('agent:complete 이벤트를 브로드캐스트', () => {
    const bus = new EventBus();
    const mockBroadcast = vi.fn();
    const sink = new WebSocketSink(bus, mockBroadcast);

    bus.emit('agent:complete', {
      sessionId: 's1',
      result: { text: '완료', toolsUsed: [] },
    });

    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'agent:complete' }),
    );

    sink.dispose();
  });

  it('session:update 이벤트를 브로드캐스트', () => {
    const bus = new EventBus();
    const mockBroadcast = vi.fn();
    const sink = new WebSocketSink(bus, mockBroadcast);

    bus.emit('session:update', { sessionId: 's1', status: 'completed' });

    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session:update', status: 'completed' }),
    );

    sink.dispose();
  });

  it('dispose 후 이벤트 무시', () => {
    const bus = new EventBus();
    const mockBroadcast = vi.fn();
    const sink = new WebSocketSink(bus, mockBroadcast);
    sink.dispose();

    bus.emit('agent:stream', { sessionId: 's1', type: 'token', data: { content: 'x' } });
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
