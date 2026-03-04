// WebSocketSink — EventBus 이벤트를 WebSocket 클라이언트에 즉시 브로드캐스트

import type { EventBus } from '../events/eventBus.js';
import type { EventMap } from '../events/types.js';

type BroadcastFn = (data: unknown) => void;

export class WebSocketSink {
  constructor(
    private bus: EventBus,
    private broadcast: BroadcastFn,
  ) {
    this.bus.on('agent:stream', this.handleStream);
    this.bus.on('agent:complete', this.handleComplete);
    this.bus.on('session:update', this.handleSessionUpdate);
  }

  dispose(): void {
    this.bus.off('agent:stream', this.handleStream);
    this.bus.off('agent:complete', this.handleComplete);
    this.bus.off('session:update', this.handleSessionUpdate);
  }

  private handleStream = (payload: EventMap['agent:stream']): void => {
    this.broadcast({
      event: 'agent:stream',
      sessionId: payload.sessionId,
      type: payload.type,
      data: payload.data,
    });
  };

  private handleComplete = (payload: EventMap['agent:complete']): void => {
    this.broadcast({
      event: 'agent:complete',
      sessionId: payload.sessionId,
      result: payload.result,
    });
  };

  private handleSessionUpdate = (payload: EventMap['session:update']): void => {
    this.broadcast({
      event: 'session:update',
      sessionId: payload.sessionId,
      status: payload.status,
    });
  };
}
