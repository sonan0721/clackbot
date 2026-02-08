// Trello 대시보드 플러그인 예제
// .clackbot/plugins/trello/ 에 복사하여 사용

(function() {
  window.__clackbot_plugins = window.__clackbot_plugins || {};
  window.__clackbot_plugins['trello'] = {
    render: async function(container, helpers) {
      container.innerHTML = `
        <h1 class="page-title">Trello</h1>

        <div class="card">
          <h2>보드 목록</h2>
          <div id="trello-boards" style="margin-top: 16px;">
            <p style="color: var(--text-muted);">Trello API 키가 설정되지 않았습니다.</p>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 8px;">
              manifest.json의 env에 TRELLO_API_KEY와 TRELLO_TOKEN을 설정하세요.
            </p>
          </div>
        </div>

        <div class="card">
          <h2>빠른 카드 생성</h2>
          <div style="margin-top: 16px;">
            <div class="form-group">
              <label>카드 제목</label>
              <input type="text" id="trello-card-title" class="form-control" style="max-width: 400px;"
                placeholder="새 카드 제목 입력..." />
            </div>
            <div class="form-group">
              <label>설명</label>
              <textarea id="trello-card-desc" class="form-control" rows="3" style="max-width: 400px; resize: vertical;"
                placeholder="카드 설명 (선택)"></textarea>
            </div>
            <button class="btn btn-primary" onclick="alert('Trello API 연동이 필요합니다.')">카드 생성</button>
          </div>
        </div>

        <div class="card">
          <p style="color: var(--text-muted); font-size: 13px;">
            이것은 예제 플러그인입니다. 실제 Trello 연동을 위해서는 API 키 설정이 필요합니다.
          </p>
        </div>
      `;
    },
    destroy: function() {
      // 클린업 로직 (SSE 연결 해제 등)
    },
  };
})();
