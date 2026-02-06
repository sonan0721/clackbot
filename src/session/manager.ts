import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { Session } from './types.js';

// 세션 생명주기 관리 — 스레드별 세션, 자동 리셋

class SessionManager {
  private sessions = new Map<string, Session>();

  /** 스레드에 대한 세션 조회 또는 생성 */
  getOrCreate(threadTs: string): Session {
    const existing = this.sessions.get(threadTs);

    if (existing) {
      // 자동 리셋 조건 확인
      if (this.shouldReset(existing)) {
        logger.debug(`세션 자동 리셋: ${threadTs}`);
        this.sessions.delete(threadTs);
        return this.createSession(threadTs);
      }

      // 활성 시간 갱신
      existing.lastActiveAt = Date.now();
      return existing;
    }

    return this.createSession(threadTs);
  }

  /** 세션 업데이트 */
  update(threadTs: string, updates: Partial<Pick<Session, 'resumeId' | 'messageCount'>>): void {
    const session = this.sessions.get(threadTs);
    if (!session) return;

    if (updates.resumeId !== undefined) session.resumeId = updates.resumeId;
    if (updates.messageCount !== undefined) session.messageCount = updates.messageCount;
    session.lastActiveAt = Date.now();
  }

  /** 세션 삭제 (수동 리셋) */
  reset(threadTs: string): void {
    this.sessions.delete(threadTs);
    logger.debug(`세션 수동 리셋: ${threadTs}`);
  }

  /** 모든 세션 초기화 */
  clear(): void {
    this.sessions.clear();
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

    this.sessions.set(threadTs, session);
    return session;
  }
}

export const sessionManager = new SessionManager();
