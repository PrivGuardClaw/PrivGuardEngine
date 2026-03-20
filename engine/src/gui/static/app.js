/* PrivGuard Web GUI — app.js */
'use strict';

// ── i18n ──
const i18n = {
  'zh-CN': {
    // sidebar
    appTitle: 'PrivGuard',
    appSubtitle: '隐私保护管理界面',
    navRecords: '拦截记录',
    navRules: '规则管理',
    navProxy: '代理状态',
    logout: '退出登录',
    // topbar titles
    titleRecords: '拦截记录',
    titleRules: '规则管理',
    titleProxy: '代理状态',
    // connection
    connecting: '连接中...',
    connected: '已连接',
    disconnected: '连接断开',
    // records panel
    statTotal: '总拦截次数',
    statToday: '今日拦截',
    statLast: '最近活动',
    recordsTitle: '拦截记录',
    refresh: '刷新',
    filterType: 'PII 类型',
    filterAllTypes: '全部类型',
    filterStart: '开始时间',
    filterEnd: '结束时间',
    filterApply: '筛选',
    filterClear: '清除',
    thTime: '时间',
    thDirection: '方向',
    thFormat: '格式',
    thPiiType: 'PII 类型',
    thCount: '数量',
    noRecords: '暂无记录',
    dirRequest: '请求',
    dirResponse: '响应',
    detailTitle: '检测详情',
    thType: '类型',
    thMasked: '掩码值',
    thPlaceholder: '占位符',
    noDetail: '无详细信息',
    sanitizedPreview: '脱敏预览',
    pageInfo: (total, page, totalPages) => `${total} 条记录，第 ${page} / ${totalPages} 页`,
    prevPage: '上一页',
    nextPage: '下一页',
    // rules panel
    systemRules: '系统规则',
    customRules: '自定义规则',
    addRule: '+ 添加规则',
    thName: '名称',
    thConfidence: '置信度',
    thValidator: '验证器',
    thStatus: '状态',
    thPattern: '正则模式',
    thActions: '操作',
    noSystemRules: '无系统规则',
    noCustomRules: '暂无自定义规则，点击"添加规则"创建',
    enableTip: '点击启用',
    disableTip: '点击禁用',
    edit: '编辑',
    delete: '删除',
    ruleTest: '规则测试',
    testPatternLabel: '正则模式',
    testPatternPlaceholder: '例如: \\d{11}',
    testTextLabel: '测试文本',
    testTextPlaceholder: '输入要测试的文本...',
    testBtn: '测试',
    regexError: '正则错误: ',
    noMatch: '未找到匹配项',
    matchFound: (n, list) => `找到 ${n} 个匹配: ${list}`,
    // rule modal
    addRuleTitle: '添加自定义规则',
    editRuleTitle: '编辑自定义规则',
    ruleTypeLabel: '类型 (SCREAMING_SNAKE_CASE)',
    ruleTypePlaceholder: '例如: MY_CUSTOM_ID',
    ruleNameLabel: '名称',
    ruleNamePlaceholder: '例如: 自定义 ID',
    rulePatternLabel: '正则模式',
    rulePatternPlaceholder: '例如: \\d{8}',
    ruleConfidenceLabel: '置信度',
    ruleValidatorLabel: '验证器 (可选)',
    validatorNone: '无',
    cancel: '取消',
    save: '保存',
    requiredFields: '类型、名称和正则模式均为必填项',
    confirmDelete: (name) => `确认删除规则 "${name}"？`,
    // proxy panel
    proxyTitle: '代理服务器状态',
    checking: '检测中...',
    running: '运行中',
    stopped: '已停止',
    startProxy: '启动代理',
    proxyPort: '监听端口',
    upstreamUrl: '上游地址',
    autoDetect: '自动检测',
    requestCount: '处理请求数',
    lastActivity: '最近活动',
    changelog: '规则变更历史',
    noChangelog: '暂无变更记录',
    actionAdd: '添加',
    actionUpdate: '更新',
    actionDelete: '删除',
    opFailed: '操作失败: ',
    // lang
    langLabel: '中',
  },
  'en': {
    appTitle: 'PrivGuard',
    appSubtitle: 'Privacy Protection Dashboard',
    navRecords: 'Records',
    navRules: 'Rules',
    navProxy: 'Proxy',
    logout: 'Logout',
    titleRecords: 'Intercept Records',
    titleRules: 'Rule Management',
    titleProxy: 'Proxy Status',
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected',
    statTotal: 'Total Intercepts',
    statToday: 'Today',
    statLast: 'Last Activity',
    recordsTitle: 'Intercept Records',
    refresh: 'Refresh',
    filterType: 'PII Type',
    filterAllTypes: 'All Types',
    filterStart: 'Start Time',
    filterEnd: 'End Time',
    filterApply: 'Filter',
    filterClear: 'Clear',
    thTime: 'Time',
    thDirection: 'Direction',
    thFormat: 'Format',
    thPiiType: 'PII Type',
    thCount: 'Count',
    noRecords: 'No records yet',
    dirRequest: 'Request',
    dirResponse: 'Response',
    detailTitle: 'Detection Details',
    thType: 'Type',
    thMasked: 'Masked',
    thPlaceholder: 'Placeholder',
    noDetail: 'No details',
    sanitizedPreview: 'Sanitized Preview',
    pageInfo: (total, page, totalPages) => `${total} records, page ${page} / ${totalPages}`,
    prevPage: 'Prev',
    nextPage: 'Next',
    systemRules: 'System Rules',
    customRules: 'Custom Rules',
    addRule: '+ Add Rule',
    thName: 'Name',
    thConfidence: 'Confidence',
    thValidator: 'Validator',
    thStatus: 'Status',
    thPattern: 'Pattern',
    thActions: 'Actions',
    noSystemRules: 'No system rules',
    noCustomRules: 'No custom rules yet. Click "Add Rule" to create one.',
    enableTip: 'Click to enable',
    disableTip: 'Click to disable',
    edit: 'Edit',
    delete: 'Delete',
    ruleTest: 'Rule Test',
    testPatternLabel: 'Regex Pattern',
    testPatternPlaceholder: 'e.g. \\d{11}',
    testTextLabel: 'Test Text',
    testTextPlaceholder: 'Enter text to test...',
    testBtn: 'Test',
    regexError: 'Regex error: ',
    noMatch: 'No matches found',
    matchFound: (n, list) => `Found ${n} matches: ${list}`,
    addRuleTitle: 'Add Custom Rule',
    editRuleTitle: 'Edit Custom Rule',
    ruleTypeLabel: 'Type (SCREAMING_SNAKE_CASE)',
    ruleTypePlaceholder: 'e.g. MY_CUSTOM_ID',
    ruleNameLabel: 'Name',
    ruleNamePlaceholder: 'e.g. Custom ID',
    rulePatternLabel: 'Regex Pattern',
    rulePatternPlaceholder: 'e.g. \\d{8}',
    ruleConfidenceLabel: 'Confidence',
    ruleValidatorLabel: 'Validator (optional)',
    validatorNone: 'None',
    cancel: 'Cancel',
    save: 'Save',
    requiredFields: 'Type, name, and pattern are required',
    confirmDelete: (name) => `Delete rule "${name}"?`,
    proxyTitle: 'Proxy Server Status',
    checking: 'Checking...',
    running: 'Running',
    stopped: 'Stopped',
    startProxy: 'Start Proxy',
    proxyPort: 'Port',
    upstreamUrl: 'Upstream',
    autoDetect: 'Auto-detect',
    requestCount: 'Requests',
    lastActivity: 'Last Activity',
    changelog: 'Rule Change History',
    noChangelog: 'No changes yet',
    actionAdd: 'Add',
    actionUpdate: 'Update',
    actionDelete: 'Delete',
    opFailed: 'Operation failed: ',
    langLabel: 'EN',
  }
};

let currentLang = localStorage.getItem('privguard-lang') || 'zh-CN';

function t(key) {
  return i18n[currentLang][key] ?? i18n['zh-CN'][key] ?? key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('privguard-lang', lang);
  applyI18n();
}

function toggleLang() {
  setLang(currentLang === 'zh-CN' ? 'en' : 'zh-CN');
}

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
  const locale = currentLang === 'zh-CN' ? 'zh-CN' : 'en-US';
  return new Date(ts).toLocaleString(locale);
}

function el(id) { return document.getElementById(id); }

function dirBadge(d) {
  return d === 'request'
    ? `<span class="badge badge-blue">${t('dirRequest')}</span>`
    : `<span class="badge badge-green">${t('dirResponse')}</span>`;
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
  const labelKey = { add: 'actionAdd', update: 'actionUpdate', delete: 'actionDelete' };
  return `<span class="badge ${map[a] || 'badge-gray'}">${t(labelKey[a]) || a}</span>`;
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 401) { window.location.href = '/login.html'; return null; }
  return res.json();
}

// ── Escape HTML ──
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Navigation ──
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el(`panel-${name}`).classList.add('active');
  document.querySelector(`[data-panel="${name}"]`).classList.add('active');
  const titleMap = { records: 'titleRecords', rules: 'titleRules', proxy: 'titleProxy' };
  el('panelTitle').textContent = t(titleMap[name] || 'titleRecords');
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
    setConnStatus('running', t('connected'));
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
    setConnStatus('stopped', t('disconnected'));
    sseSource.close();
    sseSource = null;
    setTimeout(connectSSE, Math.min(sseRetryDelay, 30000));
    sseRetryDelay = Math.min(sseRetryDelay * 2, 30000);
  };
}

function setConnStatus(statusClass, text) {
  el('connDot').className = `status-dot ${statusClass}`;
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
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align:center;padding:32px">${t('noRecords')}</td></tr>`;
    return;
  }

  tbody.innerHTML = state.records.map(r => `
    <tr class="clickable" data-id="${r.id}" onclick="toggleRecord('${r.id}')">
      <td class="mono" style="font-size:0.8rem">${fmtTime(r.timestamp)}</td>
      <td>${dirBadge(r.direction)}</td>
      <td>${fmtBadge(r.apiFormat)}</td>
      <td>${r.piiTypes.map(pt => `<span class="badge badge-yellow" style="margin-right:3px">${pt}</span>`).join('')}</td>
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
      <strong>${t('detailTitle')}</strong>
      <span class="text-muted" style="font-size:0.8rem">ID: ${r.id}</span>
    </div>
    <table style="width:100%;margin-bottom:12px">
      <thead><tr><th>${t('thType')}</th><th>${t('thMasked')}</th><th>${t('thPlaceholder')}</th></tr></thead>
      <tbody>${items || `<tr><td colspan="3" class="text-muted">${t('noDetail')}</td></tr>`}</tbody>
    </table>
    ${r.sanitizedPreview ? `<div style="margin-top:8px"><div class="text-muted" style="font-size:0.75rem;margin-bottom:4px">${t('sanitizedPreview')}</div><pre>${escHtml(r.sanitizedPreview)}</pre></div>` : ''}
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
  const pageInfoText = typeof t('pageInfo') === 'function' ? t('pageInfo')(state.recordsTotal, state.recordsPage, totalPages) : '';
  pg.innerHTML = `
    <span>${pageInfoText}</span>
    <button class="btn btn-secondary btn-sm" onclick="changePage(-1)" ${state.recordsPage <= 1 ? 'disabled' : ''}>${t('prevPage')}</button>
    <button class="btn btn-secondary btn-sm" onclick="changePage(1)" ${state.recordsPage >= totalPages ? 'disabled' : ''}>${t('nextPage')}</button>
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
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;padding:24px">${t('noSystemRules')}</td></tr>`;
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
        <label class="toggle-switch" title="${disabled ? t('enableTip') : t('disableTip')}">
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
  if (data.error) { alert(t('opFailed') + data.error); }
  loadRules();
}

function renderCustomRules() {
  el('customRuleCount').textContent = state.customRules.length;
  const tbody = el('customRulesTbody');
  if (state.customRules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;padding:24px">${t('noCustomRules')}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.customRules.map((r, i) => `
    <tr>
      <td><span class="badge badge-purple">${escHtml(r.type)}</span></td>
      <td>${escHtml(r.name)}</td>
      <td>${confBadge(r.confidence)}</td>
      <td class="mono" style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis">${escHtml(r.pattern)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editRule(${i})">${t('edit')}</button>
        <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteRule(${i})">${t('delete')}</button>
      </td>
    </tr>
  `).join('');
}

// Rule Modal
function openRuleModal(index) {
  state.editingRuleIndex = index;
  const isEdit = index >= 0;
  el('ruleModalTitle').textContent = isEdit ? t('editRuleTitle') : t('addRuleTitle');
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
    el('patternError').textContent = t('requiredFields');
    el('patternError').classList.remove('hidden');
    return;
  }

  const isEdit = state.editingRuleIndex >= 0;
  const path = isEdit ? `/api/rules/custom/${state.editingRuleIndex}` : '/api/rules/custom';
  const method = isEdit ? 'PUT' : 'POST';
  const data = await api(method, path, rule);
  if (!data) return;

  if (data.error) {
    el('patternError').textContent = t('opFailed') + (data.detail || data.error);
    el('patternError').classList.remove('hidden');
    return;
  }
  closeRuleModal();
  loadRules();
});

function editRule(index) { openRuleModal(index); }

async function deleteRule(index) {
  const confirmMsg = typeof t('confirmDelete') === 'function' ? t('confirmDelete')(state.customRules[index]?.name) : '';
  if (!confirm(confirmMsg)) return;
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
    content.textContent = t('regexError') + data.error;
  } else if (data.matches.length === 0) {
    content.className = 'alert alert-info';
    content.textContent = t('noMatch');
  } else {
    content.className = 'alert alert-success';
    const matchFn = t('matchFound');
    content.textContent = typeof matchFn === 'function' ? matchFn(data.matches.length, data.matches.map(m => `"${m}"`).join(', ')) : '';
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
    text.textContent = t('running');
    startBtn.classList.add('hidden');
  } else {
    dot.className = 'status-dot stopped';
    text.textContent = t('stopped');
    startBtn.classList.remove('hidden');
  }

  const rows = [
    [t('proxyPort'), s.port ? `:${s.port}` : '—'],
    [t('upstreamUrl'), s.upstreamUrl || t('autoDetect')],
    [t('requestCount'), s.requestCount],
    [t('lastActivity'), s.lastActivity ? fmtTime(s.lastActivity) : '—'],
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
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center;padding:24px">${t('noChangelog')}</td></tr>`;
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

// ── i18n Apply ──
function applyI18n() {
  // sidebar
  document.querySelector('.sidebar-logo h2').textContent = t('appTitle');
  document.querySelector('.sidebar-logo p').textContent = t('appSubtitle');
  document.querySelector('[data-panel="records"] .nav-icon').nextSibling.textContent = ' ' + t('navRecords');
  document.querySelector('[data-panel="rules"] .nav-icon').nextSibling.textContent = ' ' + t('navRules');
  document.querySelector('[data-panel="proxy"] .nav-icon').nextSibling.textContent = ' ' + t('navProxy');
  el('logoutBtn').textContent = t('logout');

  // Update panel title based on active panel
  const activePanel = document.querySelector('.nav-item.active');
  if (activePanel) {
    const panel = activePanel.dataset.panel;
    const titleMap = { records: 'titleRecords', rules: 'titleRules', proxy: 'titleProxy' };
    el('panelTitle').textContent = t(titleMap[panel] || 'titleRecords');
  }

  // lang button
  el('langBtn').textContent = '🌐 ' + t('langLabel');

  // records panel - stat labels
  document.querySelectorAll('.stat-label')[0].textContent = t('statTotal');
  document.querySelectorAll('.stat-label')[1].textContent = t('statToday');
  document.querySelectorAll('.stat-label')[2].textContent = t('statLast');

  // records card header
  document.querySelector('#panel-records .card-title').textContent = t('recordsTitle');
  el('refreshRecordsBtn').textContent = t('refresh');

  // filters
  const filterLabels = document.querySelectorAll('.filters label');
  if (filterLabels[0]) filterLabels[0].textContent = t('filterType');
  if (filterLabels[1]) filterLabels[1].textContent = t('filterStart');
  if (filterLabels[2]) filterLabels[2].textContent = t('filterEnd');
  const filterTypeSelect = el('filterType');
  if (filterTypeSelect && filterTypeSelect.options[0]) {
    filterTypeSelect.options[0].textContent = t('filterAllTypes');
  }
  el('applyFilterBtn').textContent = t('filterApply');
  el('clearFilterBtn').textContent = t('filterClear');

  // records table headers
  const recordHeaders = document.querySelectorAll('#recordsTable thead th');
  if (recordHeaders.length >= 5) {
    recordHeaders[0].textContent = t('thTime');
    recordHeaders[1].textContent = t('thDirection');
    recordHeaders[2].textContent = t('thFormat');
    recordHeaders[3].textContent = t('thPiiType');
    recordHeaders[4].textContent = t('thCount');
  }

  // rules panel headers
  const sysHeaders = document.querySelectorAll('#panel-rules .card:first-child thead th');
  if (sysHeaders.length >= 5) {
    sysHeaders[0].textContent = t('thType');
    sysHeaders[1].textContent = t('thName');
    sysHeaders[2].textContent = t('thConfidence');
    sysHeaders[3].textContent = t('thValidator');
    sysHeaders[4].textContent = t('thStatus');
  }

  const customHeaders = document.querySelectorAll('#panel-rules .card:nth-child(2) thead th');
  if (customHeaders.length >= 5) {
    customHeaders[0].textContent = t('thType');
    customHeaders[1].textContent = t('thName');
    customHeaders[2].textContent = t('thConfidence');
    customHeaders[3].textContent = t('thPattern');
    customHeaders[4].textContent = t('thActions');
  }

  el('addRuleBtn').textContent = t('addRule');

  // rule test card
  const testCard = document.querySelector('#panel-rules .card:nth-child(3)');
  if (testCard) {
    testCard.querySelector('.card-title').textContent = t('ruleTest');
    const labels = testCard.querySelectorAll('label');
    if (labels[0]) labels[0].textContent = t('testPatternLabel');
    if (labels[1]) labels[1].textContent = t('testTextLabel');
    el('testPattern').placeholder = t('testPatternPlaceholder');
    el('testText').placeholder = t('testTextPlaceholder');
    el('testRuleBtn').textContent = t('testBtn');
  }

  // proxy panel
  const proxyCard = document.querySelector('#panel-proxy .card:first-child');
  if (proxyCard) proxyCard.querySelector('.card-title').textContent = t('proxyTitle');
  el('refreshProxyBtn').textContent = t('refresh');
  el('startProxyBtn').textContent = t('startProxy');

  const changelogCard = document.querySelector('#panel-proxy .card:nth-child(2)');
  if (changelogCard) changelogCard.querySelector('.card-title').textContent = t('changelog');

  // rule modal
  const modalLabels = document.querySelectorAll('#ruleModal .form-group label');
  if (modalLabels.length >= 5) {
    modalLabels[0].textContent = t('ruleTypeLabel');
    modalLabels[1].textContent = t('ruleNameLabel');
    modalLabels[2].textContent = t('rulePatternLabel');
    modalLabels[3].textContent = t('ruleConfidenceLabel');
    modalLabels[4].textContent = t('ruleValidatorLabel');
  }
  el('ruleType').placeholder = t('ruleTypePlaceholder');
  el('ruleName').placeholder = t('ruleNamePlaceholder');
  el('rulePattern').placeholder = t('rulePatternPlaceholder');
  const validatorSelect = el('ruleValidator');
  if (validatorSelect && validatorSelect.options[0]) {
    validatorSelect.options[0].textContent = t('validatorNone');
  }
  el('cancelRuleBtn').textContent = t('cancel');
  el('saveRuleBtn').textContent = t('save');

  // Re-render dynamic content with new language
  renderRecordsTable();
  renderPagination();
  renderSystemRules();
  renderCustomRules();
  if (state.proxyStatus) renderProxyStatus();
}

// ── Init ──
(async function init() {
  await loadRecords();
  connectSSE();
  applyI18n();
})();
