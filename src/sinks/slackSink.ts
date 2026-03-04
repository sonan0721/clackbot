// SlackSink — EventBus → Slack 메시지 3초 디바운스 실시간 업데이트

import type { WebClient } from '@slack/web-api';
import type { EventBus } from '../events/eventBus.js';
import type { EventMap, StreamData } from '../events/types.js';
import { markdownToMrkdwn, truncateText } from '../utils/slackFormat.js';

interface SessionState {
  channelId: string;
  messageTs: string;
  buffer: string;
  activities: string[];
  timer: ReturnType<typeof setTimeout> | null;
}

const DEBOUNCE_MS = 3000;

export class SlackSink {
  private sessions = new Map<string, SessionState>();

  constructor(
    private bus: EventBus,
    private client: WebClient,
  ) {
    this.bus.on('agent:stream', this.handleStream);
    this.bus.on('agent:complete', this.handleComplete);
  }

  /** Sink에 세션을 등록한다. 이후 해당 sessionId의 이벤트만 처리. */
  startSession(sessionId: string, channelId: string, messageTs: string): void {
    this.sessions.set(sessionId, {
      channelId,
      messageTs,
      buffer: '',
      activities: [],
      timer: null,
    });
  }

  /** 리스너 해제 및 타이머 정리 */
  dispose(): void {
    this.bus.off('agent:stream', this.handleStream);
    this.bus.off('agent:complete', this.handleComplete);
    for (const state of this.sessions.values()) {
      if (state.timer) clearTimeout(state.timer);
    }
    this.sessions.clear();
  }

  // ─── 이벤트 핸들러 ───────────────────────────────────────────────

  private handleStream = (payload: EventMap['agent:stream']): void => {
    const state = this.sessions.get(payload.sessionId);
    if (!state) return;

    switch (payload.type) {
      case 'token':
        state.buffer += payload.data.content ?? '';
        break;
      case 'thinking':
        state.activities.push(`🧠 _${payload.data.thinkingSummary}_`);
        break;
      case 'tool_use':
        state.activities.push(`🔧 _${payload.data.toolName} 실행 중..._`);
        break;
    }

    this.scheduleUpdate(payload.sessionId, state);
  };

  private handleComplete = (payload: EventMap['agent:complete']): void => {
    const state = this.sessions.get(payload.sessionId);
    if (!state) return;

    // 대기 중인 디바운스 타이머가 있으면 취소
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    const text = truncateText(markdownToMrkdwn(payload.result.text));
    void this.client.chat.update({
      channel: state.channelId,
      ts: state.messageTs,
      text,
    });

    this.sessions.delete(payload.sessionId);
  };

  // ─── 디바운스 로직 ──────────────────────────────────────────────

  private scheduleUpdate(sessionId: string, state: SessionState): void {
    // 이미 타이머가 걸려 있으면 추가로 예약하지 않는다 (3초 디바운스)
    if (state.timer) return;

    state.timer = setTimeout(() => {
      state.timer = null;
      void this.flushUpdate(sessionId, state);
    }, DEBOUNCE_MS);
  }

  private async flushUpdate(sessionId: string, state: SessionState): Promise<void> {
    const lines: string[] = [];

    // 최근 활동 3개만 표시
    const recentActivities = state.activities.slice(-3);
    if (recentActivities.length > 0) {
      lines.push(recentActivities.join('\n'));
    }

    // 버퍼 프리뷰 (200자)
    if (state.buffer) {
      const preview = state.buffer.slice(0, 200);
      lines.push(`\n${markdownToMrkdwn(preview)}${state.buffer.length > 200 ? '...' : ''}`);
    }

    if (lines.length === 0) return;

    const text = truncateText(lines.join('\n'));

    try {
      await this.client.chat.update({
        channel: state.channelId,
        ts: state.messageTs,
        text,
      });
    } catch {
      // Slack API 에러 무시 (rate limit 등)
    }
  }
}
