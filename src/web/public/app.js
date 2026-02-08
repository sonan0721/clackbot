// Clackbot 대시보드 SPA (Vanilla JS)

const API_BASE = '';

// SSE 연결 (페이지 간 정리용)
let consoleEventSource = null;
let supervisorEventSource = null;

// 플러그인 레지스트리
let pluginRegistry = [];
let pluginScriptsLoaded = {};
let currentPluginDestroy = null;

// API 호출 헬퍼
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// 페이지 라우터
const routes = {
  '/': renderHome,
  '/conversations': renderConversations,
  '/tools': renderTools,
  '/supervisor': renderSupervisor,
  '/settings': renderSettings,
};

// 라우팅
function navigate() {
  const hash = location.hash.slice(1) || '/';

  // 이전 플러그인 페이지 정리
  if (currentPluginDestroy) {
    try { currentPluginDestroy(); } catch { /* 무시 */ }
    currentPluginDestroy = null;
  }

  // 페이지 이탈 시 SSE 연결 정리
  if (hash !== '/supervisor' && supervisorEventSource) {
    supervisorEventSource.close();
    supervisorEventSource = null;
  }
  if (hash !== '/tools' && consoleEventSource) {
    consoleEventSource.close();
    consoleEventSource = null;
  }

  // 플러그인 라우트 매칭: /plugin/{name}
  const pluginMatch = hash.match(/^\/plugin\/([a-z0-9-]+)$/);
  const render = pluginMatch ? null : (routes[hash] || renderHome);

  // 네비게이션 활성화 처리
  document.querySelectorAll('.nav-link').forEach(link => {
    const page = link.getAttribute('data-page');
    const isActive = pluginMatch
      ? page === `plugin/${pluginMatch[1]}`
      : ((hash === '/' && page === 'home') || hash === '/' + page);
    link.classList.toggle('active', isActive);
  });

  if (pluginMatch) {
    renderPluginPage(pluginMatch[1]);
  } else {
    render();
  }
}

// 봇 상태 로드
async function loadStatus() {
  try {
    const status = await api('/api/status');
    const badge = document.getElementById('bot-status');
    if (status.online) {
      badge.textContent = status.botName ? `@${status.botName}` : '온라인';
      badge.className = 'status-badge online';
    } else {
      badge.textContent = '오프라인';
      badge.className = 'status-badge offline';
    }
    return status;
  } catch {
    const badge = document.getElementById('bot-status');
    badge.textContent = '연결 실패';
    badge.className = 'status-badge offline';
    return null;
  }
}

// ─── 홈 페이지 ───

async function renderHome() {
  const content = document.getElementById('page-content');

  const status = await loadStatus();

  let sessionData;
  try {
    sessionData = await api('/api/conversations?limit=5');
  } catch {
    sessionData = { sessions: [], total: 0 };
  }

  let toolsData;
  try {
    toolsData = await api('/api/tools');
  } catch {
    toolsData = { builtin: [], mcpServers: [], plugins: [], total: 0 };
  }

  const s = status || {};

  content.innerHTML = `
    <h1 class="page-title">대시보드</h1>
    <div class="grid">
      <div class="stat-card">
        <div class="label">봇 이름</div>
        <div class="value">${s.botName ? '@' + s.botName : '미설정'}</div>
      </div>
      <div class="stat-card">
        <div class="label">워크스페이스</div>
        <div class="value">${s.teamName || '미연결'}</div>
      </div>
      <div class="stat-card">
        <div class="label">접근 모드</div>
        <div class="value">${s.accessMode === 'public' ? '공개' : '소유자 전용'}</div>
      </div>
      <div class="stat-card">
        <div class="label">응답 모드</div>
        <div class="value">${s.replyMode === 'chat' ? '채널 응답' : '스레드 응답'}</div>
      </div>
      <div class="stat-card">
        <div class="label">등록된 도구</div>
        <div class="value">${toolsData.total || 0}개</div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <h2>최근 대화</h2>
        <a href="#/conversations" style="color: var(--accent); text-decoration: none; font-size: 14px;">전체 보기</a>
      </div>
      ${sessionData.sessions.length === 0
        ? '<div class="empty-state"><p>아직 대화 이력이 없습니다.</p></div>'
        : sessionData.sessions.map(s => `
          <div class="session-card-mini">
            <div class="session-preview">${escapeHtml((s.firstMessage || '').slice(0, 80))}${(s.firstMessage || '').length > 80 ? '...' : ''}</div>
            <div class="session-meta">${s.lastAt} · ${s.messageCount}개 메시지</div>
          </div>
        `).join('')
      }
    </div>
  `;
}

// ─── 대화 이력 페이지 (세션별 그룹핑) ───

async function renderConversations() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <h1 class="page-title">대화 이력</h1>
    <div class="search-bar">
      <input type="text" id="search-input" placeholder="대화 검색..." />
    </div>
    <div id="sessions-list"></div>
    <div id="sessions-pagination" class="pagination"></div>
  `;

  let currentPage = 0;
  const limit = 20;

  async function loadSessions(page, search) {
    const offset = page * limit;
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set('search', search);

    const data = await api(`/api/conversations?${params}`);
    const listEl = document.getElementById('sessions-list');

    if (data.sessions.length === 0) {
      listEl.innerHTML = '<div class="card"><div class="empty-state"><p>대화가 없습니다.</p></div></div>';
      document.getElementById('sessions-pagination').innerHTML = '';
      return;
    }

    listEl.innerHTML = data.sessions.map(s => `
      <div class="session-card" data-thread="${escapeHtml(s.threadTs)}">
        <div class="session-header" onclick="window.__toggleSession('${escapeHtml(s.threadTs)}')">
          <div class="session-info">
            <div class="session-title">${escapeHtml((s.firstMessage || '').slice(0, 100))}${(s.firstMessage || '').length > 100 ? '...' : ''}</div>
            <div class="session-meta">
              ${s.lastAt} · 채널: ${s.channelId} · ${s.messageCount}개 메시지
            </div>
          </div>
          <div class="session-toggle">&#9660;</div>
        </div>
        <div class="session-messages" id="messages-${escapeHtml(s.threadTs)}" style="display:none;"></div>
      </div>
    `).join('');

    // 페이지네이션
    const totalPages = Math.ceil(data.total / limit);
    const paginationEl = document.getElementById('sessions-pagination');
    if (totalPages > 1) {
      let html = '';
      html += `<button ${page === 0 ? 'disabled' : ''} onclick="window.__sessPage(${page - 1})">이전</button>`;
      html += `<span style="padding: 6px 12px; font-size: 13px;">${page + 1} / ${totalPages}</span>`;
      html += `<button ${page >= totalPages - 1 ? 'disabled' : ''} onclick="window.__sessPage(${page + 1})">다음</button>`;
      paginationEl.innerHTML = html;
    } else {
      paginationEl.innerHTML = '';
    }
  }

  // 세션 클릭 시 메시지 펼침
  window.__toggleSession = async (threadTs) => {
    const messagesEl = document.getElementById(`messages-${threadTs}`);
    if (!messagesEl) return;

    if (messagesEl.style.display !== 'none') {
      messagesEl.style.display = 'none';
      return;
    }

    // 이미 로드된 경우
    if (messagesEl.dataset.loaded) {
      messagesEl.style.display = 'block';
      return;
    }

    messagesEl.innerHTML = '<div style="padding: 12px; color: var(--text-muted);">로딩 중...</div>';
    messagesEl.style.display = 'block';

    try {
      const data = await api(`/api/conversations/${threadTs}`);
      messagesEl.innerHTML = data.messages.map(m => `
        <div class="chat-pair">
          <div class="chat-bubble chat-user">
            <div class="chat-role">사용자</div>
            <div class="chat-text">${escapeHtml(m.inputText)}</div>
            <div class="chat-time">${m.createdAt}</div>
          </div>
          <div class="chat-bubble chat-bot">
            <div class="chat-role">봇</div>
            <div class="chat-text">${escapeHtml(m.outputText || '(응답 없음)')}</div>
            ${m.toolsUsed.length > 0 ? `<div class="chat-tools">도구: ${m.toolsUsed.join(', ')}</div>` : ''}
          </div>
        </div>
      `).join('');
      messagesEl.dataset.loaded = 'true';
    } catch {
      messagesEl.innerHTML = '<div style="padding: 12px; color: var(--error);">메시지 로드 실패</div>';
    }
  };

  window.__sessPage = (page) => {
    currentPage = page;
    const search = document.getElementById('search-input')?.value || '';
    loadSessions(page, search);
  };

  document.getElementById('search-input').addEventListener('input', debounce((e) => {
    currentPage = 0;
    loadSessions(0, e.target.value);
  }, 300));

  await loadSessions(0, '');
}

// ─── 연동 툴 페이지 (MCP 서버 + 설치 콘솔) ───

async function renderTools() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<h1 class="page-title">연동 툴</h1><div class="card">로딩 중...</div>';

  const data = await api('/api/tools');

  content.innerHTML = `
    <h1 class="page-title">연동 툴</h1>

    ${data.mcpServers.length > 0 ? `
    <div class="card">
      <h2>설치된 MCP 서버 (${data.mcpServers.length}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>명령어</th><th>상태</th><th>관리</th></tr>
        </thead>
        <tbody>
          ${data.mcpServers.map(s => `
            <tr>
              <td><strong>${escapeHtml(s.name)}</strong></td>
              <td><code>${escapeHtml(s.command)} ${escapeHtml(s.args.join(' '))}</code></td>
              <td><span class="badge badge-active">활성</span></td>
              <td><button class="btn btn-danger" onclick="window.__removeMcp('${escapeHtml(s.name)}')" style="font-size: 12px; padding: 4px 8px;">삭제</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="card">
      <h2>내장 도구 (${data.builtin.length}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>설명</th><th>상태</th></tr>
        </thead>
        <tbody>
          ${data.builtin.map(t => `
            <tr>
              <td><code>${t.name}</code></td>
              <td>${escapeHtml(t.description)}</td>
              <td><span class="badge badge-active">활성</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${data.plugins.length > 0 ? `
    <div class="card">
      <h2>플러그인 JSON (${data.plugins.length}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>플러그인</th><th>설명</th><th>상태</th></tr>
        </thead>
        <tbody>
          ${data.plugins.map(t => `
            <tr>
              <td><code>${t.name}</code></td>
              <td><span class="badge badge-plugin">${t.plugin}</span></td>
              <td>${escapeHtml(t.description)}</td>
              <td>
                ${t.status === 'active'
                  ? '<span class="badge badge-active">활성</span>'
                  : `<span class="badge badge-error">인증 필요</span><br><small>누락: ${t.missingEnvVars.join(', ')}</small>`
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="card">
      <div class="card-header">
        <h2>플러그인 설치 콘솔</h2>
        <button class="btn" onclick="window.__resetConsole()" style="font-size: 12px; padding: 4px 8px;">세션 초기화</button>
      </div>
      <div class="console-container">
        <div id="console-output" class="console-output">
          <div class="console-line console-system">MCP 서버 설치 콘솔입니다. 원하는 서비스를 입력하세요.</div>
          <div class="console-line console-system">예: "trello 연동해줘", "github mcp 서버 설치"</div>
        </div>
        <div class="console-input-bar">
          <span class="console-prompt">$</span>
          <input type="text" id="console-input" class="console-input" placeholder="메시지 입력..." />
          <button class="btn btn-primary" id="console-send" onclick="window.__sendConsole()">전송</button>
        </div>
      </div>
    </div>
  `;

  // MCP 서버 삭제
  window.__removeMcp = async (name) => {
    if (!confirm(`MCP 서버 '${name}'를 삭제하시겠습니까?`)) return;
    try {
      const config = await api('/api/config');
      const mcpServers = { ...config.mcpServers };
      delete mcpServers[name];
      await api('/api/config', {
        method: 'PUT',
        body: JSON.stringify({ mcpServers }),
      });
      renderTools();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  // 콘솔 SSE 연결
  setupConsoleSSE();

  // 콘솔 입력
  const consoleInput = document.getElementById('console-input');
  consoleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.__sendConsole();
  });

  window.__sendConsole = async () => {
    const input = document.getElementById('console-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';

    try {
      await api('/api/console/send', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    } catch (err) {
      appendConsole('error', `전송 실패: ${err.message}`);
    }
  };

  window.__resetConsole = async () => {
    try {
      await api('/api/console/reset', { method: 'POST' });
      const output = document.getElementById('console-output');
      if (output) {
        output.innerHTML = '<div class="console-line console-system">세션이 초기화되었습니다.</div>';
      }
    } catch {
      // 무시
    }
  };
}

// SSE 콘솔 연결

function setupConsoleSSE() {
  // 기존 연결 정리
  if (consoleEventSource) {
    consoleEventSource.close();
    consoleEventSource = null;
  }

  consoleEventSource = new EventSource('/api/console/events');

  consoleEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') return;

      if (data.type === 'text') {
        appendConsole('text', data.data);
      } else if (data.type === 'tool_call') {
        try {
          const tool = JSON.parse(data.data);
          appendConsole('tool', `도구 호출: ${tool.name}`);
        } catch {
          appendConsole('tool', data.data);
        }
      } else if (data.type === 'error') {
        appendConsole('error', data.data);
      } else if (data.type === 'done') {
        appendConsole('system', '완료');
      }
    } catch {
      // 파싱 실패 무시
    }
  };

  consoleEventSource.onerror = () => {
    // 자동 재연결 (EventSource 기본 동작)
  };
}

function appendConsole(type, text) {
  const output = document.getElementById('console-output');
  if (!output) return;

  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const div = document.createElement('div');
    div.className = `console-line console-${type}`;
    div.textContent = line;
    output.appendChild(div);
  }

  output.scrollTop = output.scrollHeight;
}

// ─── 슈퍼바이저 페이지 ───

async function renderSupervisor() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<h1 class="page-title">슈퍼바이저</h1><div class="card">로딩 중...</div>';

  // 규칙 파일 목록 로드
  let filesData;
  try {
    filesData = await api('/api/supervisor/files');
  } catch {
    filesData = { files: [] };
  }

  const files = filesData.files || [];
  const firstSlug = files.length > 0 ? files[0].slug : '';

  content.innerHTML = `
    <h1 class="page-title">슈퍼바이저</h1>

    <div class="card">
      <h2>규칙 파일 편집기</h2>
      <div style="margin-top: 16px;">
        <div class="file-tabs" id="file-tabs">
          ${files.map((f, i) => `
            <button class="file-tab ${i === 0 ? 'active' : ''}" data-slug="${f.slug}" onclick="window.__selectFileTab('${f.slug}')">
              ${escapeHtml(f.path)}
            </button>
          `).join('')}
        </div>
        <div class="file-editor-container">
          <textarea id="file-editor" class="file-editor" placeholder="로딩 중..."></textarea>
          <div class="file-status" id="file-status"></div>
          <div class="file-actions">
            <button class="btn btn-primary" onclick="window.__saveFile()">저장</button>
            <button class="btn" onclick="window.__refreshFile()">새로고침</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>슈퍼바이저 콘솔</h2>
        <button class="btn" onclick="window.__resetSupervisor()" style="font-size: 12px; padding: 4px 8px;">세션 초기화</button>
      </div>
      <div class="console-container">
        <div id="sv-console-output" class="console-output">
          <div class="console-line console-system">슈퍼바이저 콘솔입니다. 규칙 편집, 설정 관리, Slack 명령을 실행할 수 있습니다.</div>
          <div class="console-line console-system">예: "rules.md에 금지 규칙 추가해줘", "CLAUDE.md 내용 요약해줘"</div>
        </div>
        <div class="console-input-bar">
          <span class="console-prompt">$</span>
          <input type="text" id="sv-console-input" class="console-input" placeholder="메시지 입력..." />
          <button class="btn btn-primary" id="sv-console-send" onclick="window.__sendSupervisor()" style="margin-left: 8px; padding: 6px 12px; font-size: 12px;">전송</button>
        </div>
      </div>
    </div>
  `;

  // 현재 선택된 파일 slug
  let currentSlug = firstSlug;

  // 파일 탭 선택
  window.__selectFileTab = async (slug) => {
    currentSlug = slug;
    document.querySelectorAll('.file-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.slug === slug);
    });
    await loadFileContent(slug);
  };

  // 파일 내용 로드
  async function loadFileContent(slug) {
    const editor = document.getElementById('file-editor');
    const status = document.getElementById('file-status');
    if (!editor || !status) return;

    editor.value = '';
    status.textContent = '로딩 중...';

    try {
      const data = await api(`/api/supervisor/files/${slug}`);
      editor.value = data.content || '';
      status.textContent = data.exists
        ? '파일이 존재합니다.'
        : '파일이 존재하지 않습니다. 저장하면 생성됩니다.';
    } catch {
      status.textContent = '파일 로드 실패';
    }
  }

  // 파일 저장
  window.__saveFile = async () => {
    const editor = document.getElementById('file-editor');
    const status = document.getElementById('file-status');
    if (!editor || !status || !currentSlug) return;

    try {
      await api(`/api/supervisor/files/${currentSlug}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editor.value }),
      });
      status.textContent = '저장되었습니다.';
    } catch {
      status.textContent = '저장 실패';
    }
  };

  // 파일 새로고침
  window.__refreshFile = () => {
    if (currentSlug) loadFileContent(currentSlug);
  };

  // 초기 파일 로드
  if (firstSlug) {
    await loadFileContent(firstSlug);
  }

  // 슈퍼바이저 SSE 연결
  setupSupervisorSSE();

  // 콘솔 입력
  const svInput = document.getElementById('sv-console-input');
  svInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.__sendSupervisor();
  });

  window.__sendSupervisor = async () => {
    const input = document.getElementById('sv-console-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';

    try {
      await api('/api/supervisor/send', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    } catch (err) {
      appendSupervisorConsole('error', `전송 실패: ${err.message}`);
    }
  };

  window.__resetSupervisor = async () => {
    try {
      await api('/api/supervisor/reset', { method: 'POST' });
      const output = document.getElementById('sv-console-output');
      if (output) {
        output.innerHTML = '<div class="console-line console-system">세션이 초기화되었습니다.</div>';
      }
    } catch {
      // 무시
    }
  };
}

function setupSupervisorSSE() {
  // 기존 연결 정리
  if (supervisorEventSource) {
    supervisorEventSource.close();
    supervisorEventSource = null;
  }

  supervisorEventSource = new EventSource('/api/supervisor/events');

  supervisorEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') return;

      if (data.type === 'text') {
        appendSupervisorConsole('text', data.data);
      } else if (data.type === 'tool_call') {
        try {
          const tool = JSON.parse(data.data);
          appendSupervisorConsole('tool', `도구 호출: ${tool.name}`);
        } catch {
          appendSupervisorConsole('tool', data.data);
        }
      } else if (data.type === 'error') {
        appendSupervisorConsole('error', data.data);
      } else if (data.type === 'done') {
        appendSupervisorConsole('system', '완료');
      } else if (data.type === 'file_changed') {
        appendSupervisorConsole('system', `파일 변경됨: ${data.data}`);
        // 현재 편집 중인 파일이면 자동 새로고침
        const activeTab = document.querySelector('.file-tab.active');
        if (activeTab) {
          const slug = activeTab.dataset.slug;
          const fileMap = { 'CLAUDE.md': 'claude-md', 'rules.md': 'rules-md', '.clackbot/rules.md': 'clackbot-rules-md' };
          if (fileMap[data.data] === slug) {
            window.__refreshFile();
          }
        }
      }
    } catch {
      // 파싱 실패 무시
    }
  };

  supervisorEventSource.onerror = () => {
    // 자동 재연결 (EventSource 기본 동작)
  };
}

function appendSupervisorConsole(type, text) {
  const output = document.getElementById('sv-console-output');
  if (!output) return;

  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const div = document.createElement('div');
    div.className = `console-line console-${type}`;
    div.textContent = line;
    output.appendChild(div);
  }

  output.scrollTop = output.scrollHeight;
}

// ─── 설정 페이지 (성격 preset 포함) ───

async function renderSettings() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<h1 class="page-title">설정</h1><div class="card">로딩 중...</div>';

  const config = await api('/api/config');

  const presetValue = config.personality?.preset || 'professional';
  const customPrompt = config.personality?.customPrompt || '';

  content.innerHTML = `
    <h1 class="page-title">설정</h1>

    <div class="card">
      <h2>봇 성격</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>성격 프리셋</label>
        <select id="cfg-preset" class="form-control" style="max-width: 300px;" onchange="window.__toggleCustom()">
          <option value="professional" ${presetValue === 'professional' ? 'selected' : ''}>전문적 (Professional)</option>
          <option value="friendly" ${presetValue === 'friendly' ? 'selected' : ''}>친근한 (Friendly)</option>
          <option value="detailed" ${presetValue === 'detailed' ? 'selected' : ''}>상세한 (Detailed)</option>
          <option value="custom" ${presetValue === 'custom' ? 'selected' : ''}>커스텀 (Custom)</option>
        </select>
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);" id="preset-desc"></div>
      </div>
      <div class="form-group" id="custom-prompt-group" style="display: ${presetValue === 'custom' ? 'block' : 'none'};">
        <label>커스텀 프롬프트</label>
        <textarea id="cfg-custom-prompt" class="form-control" rows="6" style="resize: vertical; font-family: monospace; font-size: 13px;"
          placeholder="봇의 성격과 응답 스타일을 자유롭게 정의하세요...">${escapeHtml(customPrompt)}</textarea>
      </div>
    </div>

    <div class="card">
      <h2>봇 설정</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>접근 모드</label>
        <select id="cfg-access" class="form-control" style="max-width: 300px;">
          <option value="owner" ${config.accessMode === 'owner' ? 'selected' : ''}>소유자 전용 (owner)</option>
          <option value="public" ${config.accessMode === 'public' ? 'selected' : ''}>공개 (public)</option>
        </select>
      </div>
      <div class="form-group">
        <label>응답 모드</label>
        <select id="cfg-reply" class="form-control" style="max-width: 300px;">
          <option value="thread" ${config.replyMode === 'thread' ? 'selected' : ''}>스레드 응답 (thread)</option>
          <option value="chat" ${config.replyMode === 'chat' ? 'selected' : ''}>채널 응답 (chat)</option>
        </select>
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">chat: 채널 최상위 멘션 시 채널에 직접 응답</div>
      </div>
      <div class="form-group">
        <label>소유자 Slack User ID</label>
        <select id="cfg-owner" class="form-control" style="max-width: 300px;">
          <option value="">로딩 중...</option>
        </select>
      </div>
    </div>

    <div class="card">
      <h2>세션 설정</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>최대 메시지 수 (자동 리셋)</label>
        <input type="number" id="cfg-max-msg" class="form-control" style="max-width: 200px;"
          value="${config.session?.maxMessages || 20}" min="1" max="1000" step="1" />
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">1~1000 사이의 정수</div>
      </div>
      <div class="form-group">
        <label>타임아웃 (분)</label>
        <input type="number" id="cfg-timeout" class="form-control" style="max-width: 200px;"
          value="${config.session?.timeoutMinutes || 30}" min="1" max="1440" step="1" />
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">1~1440 사이의 정수 (최대 24시간)</div>
      </div>
    </div>

    <div class="card">
      <h2>웹 대시보드</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>포트</label>
        <input type="number" id="cfg-port" class="form-control" style="max-width: 200px;"
          value="${config.webPort || 3847}" min="1" max="65535" step="1" />
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">1~65535 사이의 정수</div>
      </div>
    </div>

    <div class="card">
      <h2>Slack 연결 정보</h2>
      <table class="table" style="margin-top: 12px;">
        <tr><td>봇 이름</td><td>${config.slack?.botName || '미설정'}</td></tr>
        <tr><td>봇 ID</td><td>${config.slack?.botUserId || '미설정'}</td></tr>
        <tr><td>워크스페이스</td><td>${config.slack?.teamName || '미연결'}</td></tr>
        <tr><td>Bot Token</td><td>${config.slack?.botToken || '미설정'}</td></tr>
        <tr><td>App Token</td><td>${config.slack?.appToken || '미설정'}</td></tr>
      </table>
    </div>

    <button class="btn btn-primary" onclick="window.__saveSettings()" style="margin-top: 16px;">설정 저장</button>
  `;

  const presetDescriptions = {
    professional: '간결하고 명확. 3~5줄. 이모지 없음.',
    friendly: '친근한 동료 톤. 이모지 적절히 사용. 캐주얼.',
    detailed: '꼼꼼하고 상세. 5~15줄. 단계별 안내.',
    custom: '아래에 직접 프롬프트를 작성하세요.',
  };

  function updatePresetDesc() {
    const preset = document.getElementById('cfg-preset').value;
    const descEl = document.getElementById('preset-desc');
    if (descEl) descEl.textContent = presetDescriptions[preset] || '';
  }

  window.__toggleCustom = () => {
    const preset = document.getElementById('cfg-preset').value;
    const customGroup = document.getElementById('custom-prompt-group');
    if (customGroup) {
      customGroup.style.display = preset === 'custom' ? 'block' : 'none';
    }
    updatePresetDesc();
  };

  updatePresetDesc();

  // 소유자 드롭다운: 비동기로 Slack 사용자 목록 로드
  (async () => {
    const ownerSelect = document.getElementById('cfg-owner');
    try {
      const data = await api('/api/slack/users');
      ownerSelect.innerHTML = '<option value="">선택 안 함</option>';
      for (const user of data.users) {
        const opt = document.createElement('option');
        opt.value = user.id;
        opt.textContent = `${user.displayName || user.realName} (${user.id})`;
        if (user.id === config.ownerUserId) opt.selected = true;
        ownerSelect.appendChild(opt);
      }
    } catch {
      // API 실패 시 텍스트 입력으로 폴백
      const parent = ownerSelect.parentElement;
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'cfg-owner';
      input.className = 'form-control';
      input.style.maxWidth = '300px';
      input.value = config.ownerUserId || '';
      input.placeholder = '멤버 목록을 가져올 수 없어 직접 입력합니다.';
      parent.replaceChild(input, ownerSelect);
    }
  })();

  window.__saveSettings = async () => {
    const preset = document.getElementById('cfg-preset').value;
    const customPromptVal = document.getElementById('cfg-custom-prompt')?.value || '';

    const maxMsg = Number(document.getElementById('cfg-max-msg').value);
    const timeout = Number(document.getElementById('cfg-timeout').value);
    const port = Number(document.getElementById('cfg-port').value);

    // 클라이언트사이드 검증
    if (!Number.isInteger(maxMsg) || maxMsg < 1 || maxMsg > 1000) {
      alert('최대 메시지 수는 1~1000 사이의 정수여야 합니다.');
      return;
    }
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1440) {
      alert('타임아웃은 1~1440 사이의 정수여야 합니다.');
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      alert('포트는 1~65535 사이의 정수여야 합니다.');
      return;
    }

    const updates = {
      accessMode: document.getElementById('cfg-access').value,
      replyMode: document.getElementById('cfg-reply').value,
      ownerUserId: document.getElementById('cfg-owner').value || undefined,
      webPort: port,
      session: {
        maxMessages: maxMsg,
        timeoutMinutes: timeout,
      },
      personality: {
        preset,
        ...(preset === 'custom' ? { customPrompt: customPromptVal } : {}),
      },
    };

    try {
      const result = await api('/api/config', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (result.error) {
        alert('설정 저장 실패: ' + result.error);
        return;
      }
      alert('설정이 저장되었습니다.');
      renderSettings();
    } catch (err) {
      alert('설정 저장 실패: ' + err.message);
    }
  };
}

// ─── 유틸리티 ───

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── 플러그인 동적 로딩 ───

/** 플러그인 레지스트리 로드 */
async function loadPluginRegistry() {
  try {
    const data = await api('/api/plugins');
    pluginRegistry = data.plugins || [];
  } catch {
    pluginRegistry = [];
  }
}

/** 플러그인 네비게이션 렌더링 */
function renderPluginNav() {
  const navEl = document.getElementById('plugin-nav');
  const divider = document.getElementById('plugin-nav-divider');
  if (!navEl) return;

  const dashboardPlugins = pluginRegistry.filter(p => p.hasDashboard);

  if (dashboardPlugins.length === 0) {
    navEl.innerHTML = '';
    if (divider) divider.style.display = 'none';
    return;
  }

  if (divider) divider.style.display = '';

  navEl.innerHTML = dashboardPlugins.map(p => `
    <a href="#/plugin/${p.name}" class="nav-link" data-page="plugin/${p.name}">
      ${escapeHtml(p.navLabel || p.displayName)}
    </a>
  `).join('');
}

/** 플러그인 스크립트 로드 (동적 <script> 태그) */
function loadPluginScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`스크립트 로드 실패: ${url}`));
    document.head.appendChild(script);
  });
}

/** 플러그인 페이지 렌더링 */
async function renderPluginPage(name) {
  const content = document.getElementById('page-content');
  const plugin = pluginRegistry.find(p => p.name === name);

  if (!plugin || !plugin.hasDashboard) {
    content.innerHTML = '<h1 class="page-title">플러그인을 찾을 수 없습니다</h1>';
    return;
  }

  content.innerHTML = '<h1 class="page-title">로딩 중...</h1>';

  // 스크립트가 아직 로드되지 않았으면 로드
  if (!pluginScriptsLoaded[name]) {
    try {
      await loadPluginScript(plugin.pageUrl);
      pluginScriptsLoaded[name] = true;
    } catch (err) {
      content.innerHTML = `<h1 class="page-title">플러그인 로드 실패</h1>
        <div class="card"><p>${escapeHtml(err.message)}</p></div>`;
      return;
    }
  }

  // 플러그인 render 함수 호출
  const pluginModule = window.__clackbot_plugins && window.__clackbot_plugins[name];
  if (!pluginModule || typeof pluginModule.render !== 'function') {
    content.innerHTML = `<h1 class="page-title">플러그인 오류</h1>
      <div class="card"><p>플러그인 '${escapeHtml(name)}'의 render 함수를 찾을 수 없습니다.</p></div>`;
    return;
  }

  // destroy 함수 등록
  if (typeof pluginModule.destroy === 'function') {
    currentPluginDestroy = pluginModule.destroy;
  }

  // helpers 제공
  const helpers = { fetch: window.fetch.bind(window), escapeHtml, debounce, api };

  try {
    await pluginModule.render(content, helpers);
  } catch (err) {
    content.innerHTML = `<h1 class="page-title">플러그인 렌더링 실패</h1>
      <div class="card"><p>${escapeHtml(err.message)}</p></div>`;
  }
}

// ─── 초기화 ───

window.addEventListener('hashchange', navigate);
window.addEventListener('load', async () => {
  loadStatus();
  await loadPluginRegistry();
  renderPluginNav();
  navigate();
});
