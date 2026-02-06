// Clackbot 대시보드 SPA (Vanilla JS)

const API_BASE = '';

// API 호출 헬퍼
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// 상태 저장
const state = {
  status: null,
  conversations: { items: [], total: 0 },
  tools: { builtin: [], plugins: [] },
  projects: { projects: [] },
  config: null,
};

// 페이지 라우터
const routes = {
  '/': renderHome,
  '/conversations': renderConversations,
  '/tools': renderTools,
  '/projects': renderProjects,
  '/settings': renderSettings,
};

// 라우팅
function navigate() {
  const hash = location.hash.slice(1) || '/';
  const render = routes[hash] || renderHome;

  // 네비게이션 활성 상태 갱신
  document.querySelectorAll('.nav-link').forEach(link => {
    const page = link.getAttribute('data-page');
    const isActive =
      (hash === '/' && page === 'home') ||
      hash === '/' + page;
    link.classList.toggle('active', isActive);
  });

  render();
}

// 봇 상태 로드
async function loadStatus() {
  try {
    state.status = await api('/api/status');
    const badge = document.getElementById('bot-status');
    if (state.status.online) {
      badge.textContent = state.status.botName
        ? `@${state.status.botName}`
        : '온라인';
      badge.className = 'status-badge online';
    } else {
      badge.textContent = '오프라인';
      badge.className = 'status-badge offline';
    }
  } catch {
    const badge = document.getElementById('bot-status');
    badge.textContent = '연결 실패';
    badge.className = 'status-badge offline';
  }
}

// 홈 페이지
async function renderHome() {
  const content = document.getElementById('page-content');

  await loadStatus();

  let conversationData;
  try {
    conversationData = await api('/api/conversations?limit=5');
  } catch {
    conversationData = { items: [], total: 0 };
  }

  let toolsData;
  try {
    toolsData = await api('/api/tools');
  } catch {
    toolsData = { builtin: [], plugins: [], total: 0 };
  }

  const s = state.status || {};

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
        <div class="label">등록된 도구</div>
        <div class="value">${toolsData.total || 0}개</div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <h2>최근 대화</h2>
        <a href="#/conversations" style="color: var(--accent); text-decoration: none; font-size: 14px;">전체 보기</a>
      </div>
      ${conversationData.items.length === 0
        ? '<div class="empty-state"><p>아직 대화 이력이 없습니다.</p></div>'
        : conversationData.items.map(c => `
          <div class="conversation-item">
            <div class="conversation-input">${escapeHtml(c.inputText)}</div>
            <div class="conversation-output">${escapeHtml((c.outputText || '').slice(0, 150))}${(c.outputText || '').length > 150 ? '...' : ''}</div>
            <div class="conversation-meta">${c.createdAt} | 채널: ${c.channelId}</div>
          </div>
        `).join('')
      }
    </div>
  `;
}

// 대화 이력 페이지
async function renderConversations() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <h1 class="page-title">대화 이력</h1>
    <div class="search-bar">
      <input type="text" id="search-input" placeholder="대화 검색..." />
    </div>
    <div class="card">
      <div id="conversations-list">로딩 중...</div>
      <div id="conversations-pagination" class="pagination"></div>
    </div>
  `;

  let currentPage = 0;
  const limit = 20;

  async function loadConversations(page, search) {
    const offset = page * limit;
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set('search', search);

    const data = await api(`/api/conversations?${params}`);
    const listEl = document.getElementById('conversations-list');

    if (data.items.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>대화가 없습니다.</p></div>';
      return;
    }

    listEl.innerHTML = data.items.map(c => `
      <div class="conversation-item">
        <div class="conversation-input">${escapeHtml(c.inputText)}</div>
        <div class="conversation-output">${escapeHtml((c.outputText || '').slice(0, 200))}${(c.outputText || '').length > 200 ? '...' : ''}</div>
        <div class="conversation-meta">
          ${c.createdAt} | 사용자: ${c.userId} | 채널: ${c.channelId}
          ${c.toolsUsed.length > 0 ? ' | 도구: ' + c.toolsUsed.join(', ') : ''}
        </div>
      </div>
    `).join('');

    // 페이지네이션
    const totalPages = Math.ceil(data.total / limit);
    const paginationEl = document.getElementById('conversations-pagination');
    if (totalPages > 1) {
      let html = '';
      html += `<button ${page === 0 ? 'disabled' : ''} onclick="window.__convPage(${page - 1})">이전</button>`;
      html += `<span style="padding: 6px 12px; font-size: 13px;">${page + 1} / ${totalPages}</span>`;
      html += `<button ${page >= totalPages - 1 ? 'disabled' : ''} onclick="window.__convPage(${page + 1})">다음</button>`;
      paginationEl.innerHTML = html;
    } else {
      paginationEl.innerHTML = '';
    }
  }

  window.__convPage = (page) => {
    currentPage = page;
    const search = document.getElementById('search-input')?.value || '';
    loadConversations(page, search);
  };

  document.getElementById('search-input').addEventListener('input', debounce((e) => {
    currentPage = 0;
    loadConversations(0, e.target.value);
  }, 300));

  await loadConversations(0, '');
}

// 연동 툴 페이지
async function renderTools() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<h1 class="page-title">연동 툴</h1><div class="card">로딩 중...</div>';

  const data = await api('/api/tools');

  content.innerHTML = `
    <h1 class="page-title">연동 툴</h1>

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

    <div class="card">
      <h2>플러그인 (${data.plugins.length}개)</h2>
      ${data.plugins.length === 0
        ? '<div class="empty-state"><p>등록된 플러그인이 없습니다.<br>.clackbot/tools/ 에 JSON 파일을 추가하세요.</p></div>'
        : `<table class="table" style="margin-top: 12px;">
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
          </table>`
      }
    </div>
  `;
}

// 프로젝트 페이지
async function renderProjects() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<h1 class="page-title">프로젝트</h1><div class="card">로딩 중...</div>';

  const data = await api('/api/projects');

  content.innerHTML = `
    <h1 class="page-title">프로젝트</h1>

    <div class="card">
      <div class="card-header">
        <h2>등록된 프로젝트 (${data.total}개)</h2>
      </div>

      ${data.projects.length === 0
        ? '<div class="empty-state"><p>등록된 프로젝트가 없습니다.<br>CLI: <code>clackbot project add &lt;id&gt; &lt;directory&gt;</code></p></div>'
        : `<table class="table">
            <thead>
              <tr><th>ID</th><th>디렉토리</th><th>채널</th><th>기본</th><th>관리</th></tr>
            </thead>
            <tbody>
              ${data.projects.map(p => `
                <tr>
                  <td><strong>${escapeHtml(p.id)}</strong></td>
                  <td><code>${escapeHtml(p.directory)}</code></td>
                  <td>${p.slackChannels.length > 0 ? p.slackChannels.join(', ') : '-'}</td>
                  <td>${p.isDefault ? '기본' : ''}</td>
                  <td><button class="btn btn-danger" onclick="window.__deleteProject('${p.id}')" style="font-size: 12px; padding: 4px 8px;">삭제</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>`
      }
    </div>

    <div class="card">
      <h3>프로젝트 추가</h3>
      <div class="form-group">
        <label>프로젝트 ID</label>
        <input type="text" id="proj-id" class="form-control" placeholder="예: my-project" />
      </div>
      <div class="form-group">
        <label>디렉토리 경로</label>
        <input type="text" id="proj-dir" class="form-control" placeholder="예: /Users/me/projects/my-project" />
      </div>
      <button class="btn btn-primary" onclick="window.__addProject()">추가</button>
    </div>
  `;

  window.__deleteProject = async (id) => {
    if (!confirm(`프로젝트 '${id}'를 삭제하시겠습니까?`)) return;
    await api(`/api/projects/${id}`, { method: 'DELETE' });
    renderProjects();
  };

  window.__addProject = async () => {
    const id = document.getElementById('proj-id').value.trim();
    const directory = document.getElementById('proj-dir').value.trim();
    if (!id || !directory) { alert('ID와 디렉토리를 입력하세요.'); return; }

    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ id, directory }),
      });
      renderProjects();
    } catch (err) {
      alert('프로젝트 추가 실패: ' + err.message);
    }
  };
}

// 설정 페이지
async function renderSettings() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<h1 class="page-title">설정</h1><div class="card">로딩 중...</div>';

  const config = await api('/api/config');

  content.innerHTML = `
    <h1 class="page-title">설정</h1>

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
        <label>소유자 Slack User ID</label>
        <input type="text" id="cfg-owner" class="form-control" style="max-width: 300px;"
          value="${config.ownerUserId || ''}" placeholder="예: U0123456789" />
      </div>
    </div>

    <div class="card">
      <h2>세션 설정</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>최대 메시지 수 (자동 리셋)</label>
        <input type="number" id="cfg-max-msg" class="form-control" style="max-width: 200px;"
          value="${config.session?.maxMessages || 20}" />
      </div>
      <div class="form-group">
        <label>타임아웃 (분)</label>
        <input type="number" id="cfg-timeout" class="form-control" style="max-width: 200px;"
          value="${config.session?.timeoutMinutes || 30}" />
      </div>
    </div>

    <div class="card">
      <h2>웹 대시보드</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>포트</label>
        <input type="number" id="cfg-port" class="form-control" style="max-width: 200px;"
          value="${config.webPort || 3847}" />
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

  window.__saveSettings = async () => {
    const updates = {
      accessMode: document.getElementById('cfg-access').value,
      ownerUserId: document.getElementById('cfg-owner').value || undefined,
      webPort: Number(document.getElementById('cfg-port').value),
      session: {
        maxMessages: Number(document.getElementById('cfg-max-msg').value),
        timeoutMinutes: Number(document.getElementById('cfg-timeout').value),
      },
    };

    try {
      await api('/api/config', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      alert('설정이 저장되었습니다.');
      renderSettings();
    } catch (err) {
      alert('설정 저장 실패: ' + err.message);
    }
  };
}

// 유틸리티
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

// 초기화
window.addEventListener('hashchange', navigate);
window.addEventListener('load', () => {
  loadStatus();
  navigate();
});
