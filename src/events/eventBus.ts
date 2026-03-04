// 타입 안전 이벤트 허브 — v4 아키텍처 중앙 이벤트 버스

import { EventEmitter } from 'node:events';
import type { EventMap } from './types.js';

type EventHandler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

export class EventBus {
  private emitter = new EventEmitter();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  once<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    this.emitter.once(event, handler as (...args: unknown[]) => void);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  removeAllListeners(event?: keyof EventMap): void {
    this.emitter.removeAllListeners(event);
  }
}

let instance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!instance) {
    instance = new EventBus();
  }
  return instance;
}
