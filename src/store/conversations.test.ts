import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from './conversations.js';
import { mkdtempSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('initDatabase', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'clackbot-test-'));
    // initDatabase → getDbPath → getLocalDir → <cwd>/.clackbot/
    mkdirSync(join(cwd, '.clackbot'), { recursive: true });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('creates agent_sessions table', () => {
    const db = initDatabase(cwd);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_sessions'").all();
    expect(tables).toHaveLength(1);
  });

  it('creates agent_activities table', () => {
    const db = initDatabase(cwd);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_activities'").all();
    expect(tables).toHaveLength(1);
  });

  it('creates memory_snapshots table', () => {
    const db = initDatabase(cwd);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_snapshots'").all();
    expect(tables).toHaveLength(1);
  });
});
