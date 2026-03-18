/* PrivGuard Web GUI — app.js */
'use strict';

// ── State ──
const state = {
  records: [], recordsTotal: 0, recordsPage: 1,
  filterType: '', filterStart: '', filterEnd: '',
  systemRules: [], customRules: [],
  disabledTypes: new Set(),
  editingRuleIndex: -1,
  proxyStatus: null,
  showRaw: new Set(),
};

// ── Helpers ──
function maskValue(v) {
  if (!v || v.length <= 4) return '****';
  return v.slice(0, 2) + '****' + v.slice(-2);
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString('zh-CN');
}

function el(id) { return document.getElementById(id); }

function dirBadge(d) {
  return d === 'request'
    ? '<span class="badge badge-blue">请求</span>'
    : '<span class="badge badge-green">响应</span>';
}

function fmtBadge(f) {
  const map = { anthropic: 'badge-purple', openai: 'badge-blue', unknown: 'badge-gray' };
  return `<span class="badge ${map[f] || 'badge-gray'}">${f}</span>`;
}

function confBadge(c) {
  const map = { high: 'badge-green', medium: 'badge-yellow', low: 'badge-gray' };
  return `<span class="badge ${map[c] || 'badge-gray'}">${c}</span>`;
}

function actionBadge(a) {
  const map = { add: 'badge-green', update: 'badge-blue', delete: 'badge-red' };
  const label = { add: '添加', update: '更新', delete: '删除' };
  return `<span class="badge ${map[a] || 'badge-gray'}">${label[a] || a}</span>`;
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 401) { window.location.href = '/login.html'; return null; }
  return res.json();
}

// ── Navigation ──
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el(`panel-${name}`).classList.add('active');
  document.querySelector(`[data-panel="${name}"]`).classList.add('active');
  const titles = { records: '拦截记录', rules: '规则管理', proxy: '代理状态' };
  el('panelTitle').textContent = titles[name] || name;
  if (name === 'rules') loadRules();
  if (name === 'proxy') loadProxyStatus();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchPanel(item.dataset.panel));
});

// ── Logout ──
el('logoutBtn').addEventListener('click', async () => {
  await api('POST', '/api/logout');
  window.location.href = '/login.html';
});

// ── SSE Connection ──
let sseRetryDelay = 1000;
let sseSource = null;

function connectSSE() {
  if (sseSource) sseSource.close();
  sseSource = new EventSource('/api/events');

  sseSource.addEventListener('connected', () => {
    sseRetryDelay = 1000;
    setConnStatus('running', '已连接');
  });

  sseSource.addEventListener('record', (e) => {
    const record = JSON.parse(e.data);
    state.records.unshift(record);
    state.recordsTotal++;
    updateStats();
    if (state.recordsPage === 1) renderRecordsTable();
  });

  sseSource.addEventListener('rule-change', () => loadRules());
  sseSource.addEventListener('proxy-status', (e) => {
    state.proxyStatus = JSON.parse(e.data);
    renderProxyStatus();
  });

  sseSource.onerror = () => {
    setConnStatus('stopped', '连接断开');
    sseSource.close();
    sseSource = null;
    setTimeout(connectSSE, Math.min(sseRetryDelay, 30000));
    sseRetryDelay = Math.min(sseRetryDelay * 2, 30000);
  };
}

function setConnStatus(state, text) {
  el('connDot').className = `status-dot ${state}`;
  el('connText').textContent = text;
}

// ── Records ──
async function loadRecords() {
  const params = new URLSearchParams({ page: state.recordsPage, pageSize: 50 });
  if (state.filterType) params.set('type', state.filterType);
  if (state.filterStart) params.set('startTime', new Date(state.filterStart).getTime());
  if (state.filterEnd) params.set('endTime', new Date(state.filterEnd).getTime());

  const data = await api('GET', `/api/records?${params}`);
  if (!data) return;
  state.records = data.records;
  state.recordsTotal = data.total;
  updateStats();
  renderRecordsTable();
  renderPagination();
}

function updateStats() {
  el('statTotal').textContent = state.recordsTotal;
  const today = state.records.filter(r => {
    const d = new Date(r.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  el('statToday').textContent = today;
  if (state.records.length > 0) {
    el('statLast').textContent = fmtTime(state.records[0].timestamp);
  }
}

function renderRecordsTable() {
  const tbody = el('recordsTbody');
  if (state.records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:32px">暂无记录</td></tr>';
    return;
  }

  tbody.innerHTML = state.records.map(r => `
    <tr class="clickable" data-id="${r.id}" onclick="toggleRecord('${r.id}')">
      <td class="mono" style="font-size:0.8rem">${fmtTime(r.timestamp)}</td>
      <td>${dirBadge(r.direction)}</td>
      <td>${fmtBadge(r.apiFormat)}</td>
      <td>${r.piiTypes.map(t => `<span class="badge badge-yellow" style="margin-right:3px">${t}</span>`).join('')}</td>
      <td><strong>${r.detectedCount}</strong></td>
      <td style="text-align:right;color:var(--text-muted)">▶</td>
    </tr>
    <tr class="detail-row hidden" id="detail-${r.id}">
      <td colspan="6">
        <div class="detail-content">
          ${renderRecordDetail(r)}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderRecordDetail(r) {
  const showRaw = state.showRaw.has(r.id);
  const items = r.items.map(item => `
    <tr>
      <td><span class="badge badge-yellow">${item.type}</span></td>
      <td class="mono">${showRaw ? item.masked : item.masked}</td>
      <td class="mono text-muted">${item.placeholder}</td>
    </tr>
  `).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <strong>检测详情</strong>
      <span class="text-muted" style="font-size:0.8rem">ID: ${r.id}</span>
    </div>
    <table style="width:100%;margin-bottom:12px">
      <thead><tr><th>类型</th><th>掩码值</th><th>占位符</th></tr></thead>
      <tbody>${items || '<tr><td colspan="3" class="text-muted">无详细信息</td></tr>'}</tbody>
    </table>
    ${r.sanitizedPreview ? `<div style="margin-top:8px"><div class="text-muted" style="font-size:0.75rem;margin-bottom:4px">脱敏预览</div><pre>${escHtml(r.sanitizedPreview)}</pre></div>` : ''}
  `;
}

function toggleRecord(id) {
  const detailRow = el(`detail-${id}`);
  if (!detailRow) return;
  const isHidden = detailRow.classList.contains('hidden');
  // Close all
  document.querySelectorAll('.detail-row').forEach(r => r.classList.add('hidden'));
  document.querySelectorAll('tr[data-id]').forEach(r => r.classList.remove('expanded'));
  if (isHidden) {
    detailRow.classList.remove('hidden');
    document.querySelector(`tr[data-id="${id}"]`)?.classList.add('expanded');
  }
}

function renderPagination() {
  const totalPages = Math.ceil(state.recordsTotal / 50) || 1;
  const pg = el('recordsPagination');
  pg.innerHTML = `
    <span>${state.recordsTotal} 条记录，第 ${state.recordsPage} / ${totalPages} 页</span>
    <button class="btn btn-secondary btn-sm" onclick="changePage(-1)" ${state.recordsPage <= 1 ? 'disabled' : ''}>上一页</button>
    <button class="btn btn-secondary btn-sm" onclick="changePage(1)" ${state.recordsPage >= totalPages ? 'disabled' : ''}>下一页</button>
  `;
}

function changePage(delta) {
  state.recordsPage = Math.max(1, state.recordsPage + delta);
  loadRecords();
}

el('refreshRecordsBtn').addEventListener('click', loadRecords);

el('applyFilterBtn').addEventListener('click', () => {
  state.filterType = el('filterType').value;
  state.filterStart = el('filterStart').value;
  state.filterEnd = el('filterEnd').value;
  state.recordsPage = 1;
  loadRecords();
});

el('clearFilterBtn').addEventListener('click', () => {
  el('filterType').value = '';
  el('filterStart').value = '';
  el('filterEnd').value = '';
  state.filterType = state.filterStart = state.filterEnd = '';
  state.recordsPage = 1;
  loadRecords();
});

// ── Rules ──
async function loadRules() {
  const data = await api('GET', '/api/rules');
  if (!data) return;
  state.systemRules = data.system || [];
  state.customRules = data.custom || [];
  state.disabledTypes = new Set(data.disabledTypes || []);
  renderSystemRules();
  renderCustomRules();
}

function renderSystemRules() {
  el('sysRuleCount').textContent = state.systemRules.length;
  const tbody = el('sysRulesTbody');
  if (state.systemRules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:24px">无系统规则</td></tr>';
    return;
  }
  tbody.innerHTML = state.systemRules.map(r => {
    const disabled = state.disabledTypes.has(r.type);
    return `
    <tr class="${disabled ? 'rule-disabled' : ''}">
      <td><span class="badge badge-gray">${escHtml(r.type)}</span></td>
      <td>${escHtml(r.name)}</td>
      <td>${confBadge(r.confidence)}</td>
      <td>${r.validate ? `<span class="badge badge-blue">${r.validate}</span>` : '<span class="text-muted">—</span>'}</td>
      <td>
        <label class="toggle-switch" title="${disabled ? '点击启用' : '点击禁用'}">
          <input type="checkbox" ${disabled ? '' : 'checked'} onchange="toggleSystemRule('${escHtml(r.type)}', !this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </td>
    </tr>`;
  }).join('');
}

async function toggleSystemRule(type, disabled) {
  const data = await api('POST', '/api/rules/system/toggle', { type, disabled });
  if (!data) return;
  if (data.error) { alert('操作失败: ' + data.error); }
  loadRules();
}

function renderCustomRules() {
  el('customRuleCount').textContent = state.customRules.length;
  const tbody = el('customRulesTbody');
  if (state.customRules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:24px">暂无自定义规则，点击"添加规则"创建</td></tr>';
    return;
  }
  tbody.innerHTML = state.customRules.map((r, i) => `
    <tr>
      <td><span class="badge badge-purple">${escHtml(r.type)}</span></td>
      <td>${escHtml(r.name)}</td>
      <td>${confBadge(r.confidence)}</td>
      <td class="mono" style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis">${escHtml(r.pattern)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editRule(${i})">编辑</button>
        <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteRule(${i})">删除</button>
      </td>
    </tr>
  `).join('');
}

// Rule Modal
function openRuleModal(index) {
  state.editingRuleIndex = index;
  const isEdit = index >= 0;
  el('ruleModalTitle').textContent = isEdit ? '编辑自定义规则' : '添加自定义规则';
  el('patternError').classList.add('hidden');

  if (isEdit) {
    const r = state.customRules[index];
    el('ruleType').value = r.type;
    el('ruleName').value = r.name;
    el('rulePattern').value = r.pattern;
    el('ruleConfidence').value = r.confidence;
    el('ruleValidator').value = r.validate || '';
  } else {
    el('ruleType').value = '';
    el('ruleName').value = '';
    el('rulePattern').value = '';
    el('ruleConfidence').value = 'medium';
    el('ruleValidator').value = '';
  }
  el('ruleModal').classList.add('open');
}

function closeRuleModal() { el('ruleModal').classList.remove('open'); }

el('addRuleBtn').addEventListener('click', () => openRuleModal(-1));
el('closeRuleModal').addEventListener('click', closeRuleModal);
el('cancelRuleBtn').addEventListener('click', closeRuleModal);

el('saveRuleBtn').addEventListener('click', async () => {
  const rule = {
    type: el('ruleType').value.trim().toUpperCase().replace(/\s+/g, '_'),
    name: el('ruleName').value.trim(),
    pattern: el('rulePattern').value.trim(),
    confidence: el('ruleConfidence').value,
  };
  const validator = el('ruleValidator').value;
  if (validator) rule.validate = validator;

  if (!rule.type || !rule.name || !rule.pattern) {
    el('patternError').textContent = '类型、名称和正则模式均为必填项';
    el('patternError').classList.remove('hidden');
    return;
  }

  const isEdit = state.editingRuleIndex >= 0;
  const path = isEdit ? `/api/rules/custom/${state.editingRuleIndex}` : '/api/rules/custom';
  const method = isEdit ? 'PUT' : 'POST';
  const data = await api(method, path, rule);
  if (!data) return;

  if (data.error) {
    el('patternError').textContent = data.error + (data.detail ? ': ' + data.detail : '');
    el('patternError').classList.remove('hidden');
    return;
  }
  closeRuleModal();
  loadRules();
});

function editRule(index) { openRuleModal(index); }

async function deleteRule(index) {
  if (!confirm(`确认删除规则 "${state.customRules[index]?.name}"？`)) return;
  await api('DELETE', `/api/rules/custom/${index}`);
  loadRules();
}

// Rule Test
el('testRuleBtn').addEventListener('click', async () => {
  const pattern = el('testPattern').value.trim();
  const text = el('testText').value;
  if (!pattern) return;

  const data = await api('POST', '/api/rules/test', { pattern, text });
  if (!data) return;

  const result = el('testResult');
  const content = el('testResultContent');
  result.classList.remove('hidden');

  if (data.error) {
    content.className = 'alert alert-error';
    content.textContent = '正则错误: ' + data.error;
  } else if (data.matches.length === 0) {
    content.className = 'alert alert-info';
    content.textContent = '未找到匹配项';
  } else {
    content.className = 'alert alert-success';
    content.textContent = `找到 ${data.matches.length} 个匹配: ${data.matches.map(m => `"${m}"`).join(', ')}`;
  }
});

// ── Proxy Status ──
async function loadProxyStatus() {
  const data = await api('GET', '/api/proxy/status');
  if (!data) return;
  state.proxyStatus = data;
  renderProxyStatus();
  loadChangelog();
}

function renderProxyStatus() {
  const s = state.proxyStatus;
  if (!s) return;

  const dot = el('proxyDot');
  const text = el('proxyStatusText');
  const startBtn = el('startProxyBtn');

  if (s.running) {
    dot.className = 'status-dot running';
    text.textContent = '运行中';
    startBtn.classList.add('hidden');
  } else {
    dot.className = 'status-dot stopped';
    text.textContent = '已停止';
    startBtn.classList.remove('hidden');
  }

  const rows = [
    ['监听端口', s.port ? `:${s.port}` : '—'],
    ['上游地址', s.upstreamUrl || '自动检测'],
    ['处理请求数', s.requestCount],
    ['最近活动', s.lastActivity ? fmtTime(s.lastActivity) : '—'],
  ];

  el('proxyInfoTbody').innerHTML = rows.map(([k, v]) => `
    <tr><td style="color:var(--text-muted);padding:6px 12px 6px 0;white-space:nowrap">${k}</td>
    <td style="padding:6px 0" class="mono">${escHtml(String(v))}</td></tr>
  `).join('');
}

el('refreshProxyBtn').addEventListener('click', loadProxyStatus);

el('startProxyBtn').addEventListener('click', async () => {
  el('startProxyBtn').disabled = true;
  await api('POST', '/api/proxy/start');
  setTimeout(loadProxyStatus, 1000);
  el('startProxyBtn').disabled = false;
});

async function loadChangelog() {
  const data = await api('GET', '/api/rules/changelog');
  if (!data || !Array.isArray(data)) return;
  const tbody = el('changelogTbody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center;padding:24px">暂无变更记录</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(log => `
    <tr>
      <td class="mono" style="font-size:0.8rem">${fmtTime(log.timestamp)}</td>
      <td>${actionBadge(log.action)}</td>
      <td><span class="badge badge-gray">${escHtml(log.ruleType)}</span></td>
      <td>${escHtml(log.ruleName)}</td>
    </tr>
  `).join('');
}

// ── Escape HTML ──
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──
(async function init() {
  await loadRecords();
  connectSSE();
})();
