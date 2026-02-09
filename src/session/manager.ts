import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '../config/index.js';
import { upsertSlackSession, getSlackSession, deleteSlackSession } from '../store/conversations.js';
import { logger } from '../utils/logger.js';
import type { Session } from './types.js';

// 세션 생명주기 관리 — SQLite 영속화, 스레드별 세션, 자동 리셋

class SessionManager {
  /** 스레드에 대한 세션 조회 또는 생성 */
  getOrCreate(threadTs: string): Session {
    const existing = getSlackSession(threadTs);

    if (existing) {
      const session: Session = {
        id: existing.sessionId,
        threadTs: existing.threadTs,
        resumeId: existing.resumeId,
        messageCount: existing.messageCount,
        createdAt: existing.createdAt,
        lastActiveAt: existing.lastActiveAt,
      };

      // 자동 리셋 조건 확인
      if (this.shouldReset(session)) {
        logger.debug(`세션 자동 리셋: ${threadTs}`);
        deleteSlackSession(threadTs);
        return this.createSession(threadTs);
      }

      // 활성 시간 갱신
      session.lastActiveAt = Date.now();
      upsertSlackSession({
        threadTs: session.threadTs,
        sessionId: session.id,
        resumeId: session.resumeId,
        messageCount: session.messageCount,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
      });

      return session;
    }

    return this.createSession(threadTs);
  }

  /** 세션 업데이트 */
  update(threadTs: string, updates: Partial<Pick<Session, 'resumeId' | 'messageCount'>>): void {
    const existing = getSlackSession(threadTs);
    if (!existing) return;

    const resumeId = updates.resumeId !== undefined ? updates.resumeId : existing.resumeId;
    const messageCount = updates.messageCount !== undefined ? updates.messageCount : existing.messageCount;

    upsertSlackSession({
      threadTs,
      sessionId: existing.sessionId,
      resumeId,
      messageCount,
      createdAt: existing.createdAt,
      lastActiveAt: Date.now(),
    });
  }

  /** 세션 삭제 (수동 리셋) */
  reset(threadTs: string): void {
    deleteSlackSession(threadTs);
    logger.debug(`세션 수동 리셋: ${threadTs}`);
  }

  /** 자동 리셋 조건 확인 */
  private shouldReset(session: Session): boolean {
    const config = loadConfig();
    const { maxMessages, timeoutMinutes } = config.session;

    // 메시지 수 초과
    if (session.messageCount >= maxMessages) {
      return true;
    }

    // 타임아웃 경과
    const elapsed = Date.now() - session.lastActiveAt;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    if (elapsed > timeoutMs) {
      return true;
    }

    return false;
  }

  private createSession(threadTs: string): Session {
    const session: Session = {
      id: uuidv4(),
      threadTs,
      messageCount: 0,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    upsertSlackSession({
      threadTs: session.threadTs,
      sessionId: session.id,
      resumeId: session.resumeId,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
    });

    return session;
  }
}

export const sessionManager = new SessionManager();
