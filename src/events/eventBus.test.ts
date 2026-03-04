import { describe, it, expect, vi } from 'vitest';
import { EventBus, getEventBus } from './eventBus.js';

describe('EventBus', () => {
  it('타입 안전하게 이벤트를 발행하고 구독한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('session:update', handler);
    bus.emit('session:update', { sessionId: 'test-1', status: 'active' });
    expect(handler).toHaveBeenCalledWith({ sessionId: 'test-1', status: 'active' });
  });

  it('off로 구독을 해제한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('session:update', handler);
    bus.off('session:update', handler);
    bus.emit('session:update', { sessionId: 'test-1', status: 'active' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once로 1회만 수신한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('agent:complete', handler);
    bus.emit('agent:complete', { sessionId: 's1', result: { text: 'ok', toolsUsed: [] } });
    bus.emit('agent:complete', { sessionId: 's2', result: { text: 'no', toolsUsed: [] } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('agent:stream 이벤트를 발행한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('agent:stream', handler);
    bus.emit('agent:stream', {
      sessionId: 's1',
      type: 'token',
      data: { content: 'hello' },
    });
    expect(handler).toHaveBeenCalledWith({
      sessionId: 's1',
      type: 'token',
      data: { content: 'hello' },
    });
  });

  it('new EventBus()는 별도 인스턴스를 생성한다', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();
    expect(bus1).not.toBe(bus2);
  });

  it('getEventBus()는 싱글턴 인스턴스를 반환한다', () => {
    const bus1 = getEventBus();
    const bus2 = getEventBus();
    expect(bus1).toBe(bus2);
  });
});
