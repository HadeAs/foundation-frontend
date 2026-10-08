// 离线界面评审数据。导入及下载演示请求反馈，不调用或假定业务接口。
const $ = id => document.getElementById(id);
function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
const today = localDay();
const states = [['未到配送时间', '', true], ['待配送', 'blue', false], ['配送中', 'teal', false], ['配送完成', 'green', false], ['配送异常', 'red', false]];
const plans = [
  { id: 1, order: '000240914001', qty: 120, start: '08:00', end: '08:45', trigger: '07:30', state: 3, tasks: 3, done: 3 },
  { id: 2, order: '000240914002', qty: 96, start: '08:45', end: '09:30', trigger: '08:15', state: 2, tasks: 3, done: 2 },
  { id: 3, order: '000240914003', qty: 180, start: '09:30', end: '10:15', trigger: '09:00', state: 2, tasks: 3, done: 1 },
  { id: 4, order: '000240914004', qty: 80, start: '10:15', end: '11:00', trigger: '09:45', state: 4, tasks: 2, done: 0 },
  { id: 5, order: '000240914005', qty: 150, start: '11:00', end: '11:45', trigger: '10:30', state: 1, tasks: 2, done: 0 },
  { id: 6, order: '000240914006', qty: 100, start: '11:45', end: '12:30', trigger: '11:15', state: 1, tasks: 0, done: 0 },
  { id: 7, order: '000240914007', qty: 200, start: '13:00', end: '14:00', trigger: '12:30', state: 0, tasks: 0, done: 0 },
  { id: 8, order: '000240914008', qty: 160, start: '14:00', end: '15:00', trigger: '13:30', state: 0, tasks: 0, done: 0 },
  { id: 9, order: '000240914009', qty: 140, start: '15:00', end: '16:00', trigger: '14:30', state: 0, tasks: 0, done: 0 },
].map((p, index) => ({ ...p, sequence: index + 1, line: 'A', station: 'S10', day: today }));
let current = plans[6], selected = new Set(), reverse = false, forceConflict = false;
let draftOrder = [], importFile = '', importFailure = false, pending = false, toastTimer;
const date = time => `${today} ${time}`;
const badge = index => `<span class="status ${states[index][1]}">${states[index][0]}</span>`;
const canMaintain = plan => states[plan.state]?.[2] === true;
const sameScope = (a, b) => a.line === b.line && a.station === b.station;
function canSelect(plan) {
  const first = plans.find(p => selected.has(p.id));
  return canMaintain(plan) && (!first || sameScope(first, plan));
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reason = p => `${states[p.state]?.[0] || '状态待确认'}，不允许修改、删除、插单或调序。`;
const cancel = '<button class="btn" onclick="closeDialog()">取消</button>';
const closeButton = '<button class="btn" onclick="closeDialog()">关闭</button>';

function visiblePlans() {
  const items = plans.filter(p => (!$('orderFilter').value || p.order.includes($('orderFilter').value))
    && (!$('stateFilter').value || p.state === Number($('stateFilter').value))
    && (!$('lineFilter').value || p.line === $('lineFilter').value)
    && (!$('stationFilter').value || p.station === $('stationFilter').value)
    && (!$('dateFrom').value || p.day >= $('dateFrom').value)
    && (!$('dateTo').value || p.day <= $('dateTo').value));
  return reverse ? items.sort((a, b) => b.start.localeCompare(a.start)) : items.sort((a, b) => a.sequence - b.sequence);
}
function rowAction(action, label, p) {
  if (canMaintain(p)) return `<button class="link ${action === 'delete' ? 'danger' : ''}" onclick="openScene('${action}',${p.id})">${label}</button>`;
  return `<span class="disabled-wrap" tabindex="0" title="${reason(p)}"><button class="link" disabled>${label}</button></span>`;
}
function render() {
  const items = visiblePlans();
  $('rows').innerHTML = items.map(p => `<tr class="${selected.has(p.id) ? 'selected' : ''}">
    <td class="fixed-left" title="${!canMaintain(p) ? reason(p) : !canSelect(p) ? '只能选择同一资源与工位的计划' : '选择计划参与调序'}"><input type="checkbox" aria-label="选择计划 ${p.order}" ${selected.has(p.id) ? 'checked' : ''} ${canSelect(p) ? '' : 'disabled'} onchange="selectRow(${p.id},this.checked)"></td>
    <td class="seq">${String(p.sequence).padStart(2, '0')}</td><td class="mono">${p.order}</td><td>${p.qty}</td><td>装配一线</td><td>总装工位 S10</td>
    <td class="mono">${date(p.start)}</td><td class="mono">${date(p.end)}</td><td class="mono">${date(p.trigger)}</td><td>${badge(p.state)}</td>
    <td><button class="link" onclick="openScene('tasks',${p.id})">${p.tasks} 个</button></td>
    <td class="fixed-right"><div class="row-actions"><button class="link" onclick="openScene('history',${p.id})">变更记录</button>${rowAction('edit', '修改', p)}${rowAction('insert', '插单', p)}${rowAction('delete', '删除', p)}</div></td></tr>`).join('');
  $('totalFoot').textContent = `共 ${items.length} 条`;
  $('plans').hidden = !items.length; $('blank').hidden = !!items.length;
  if (!items.length) emptyState('empty');
  const chosen = plans.filter(p => selected.has(p.id));
  const valid = chosen.length >= 1 && chosen.every(p => canMaintain(p) && p.line === chosen[0].line && p.station === chosen[0].station);
  $('reorderBtn').disabled = !valid;
  $('reorderBtn').textContent = `调整顺序${chosen.length ? ` (${chosen.length})` : ''}`;
  $('reorderTip').title = valid ? '调整同一线体与工位内所选计划的顺序' : '请勾选同一线体与工位内至少一条未到配送时间的计划';
  const eligible = items.filter(canSelect), count = eligible.filter(p => selected.has(p.id)).length;
  $('selectAll').checked = !!eligible.length && count === eligible.length;
  $('selectAll').indeterminate = count > 0 && count < eligible.length;
  $('selectAll').disabled = !eligible.length;
}
function selectRow(id, checked = !selected.has(id)) {
  if (!canSelect(plans.find(p => p.id === id))) return;
  if (checked) selected.add(id); else selected.delete(id);
  render();
}
function selectAllRows(checked) {
  visiblePlans().forEach(p => {
    if (!checked) selected.delete(p.id);
    else if (canSelect(p)) selected.add(p.id);
  });
  render();
}
function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => $('toast').hidden = true, 3500);
}
function closeDialog() { if (!pending) $('dialog').close(); }
function modal(title, subtitle, body, footer) {
  $('dialog').className = '';
  $('dialogTitle').textContent = title; $('dialogSubtitle').textContent = subtitle;
  $('dialogBody').innerHTML = body; $('dialogFoot').innerHTML = footer;
  if (!$('dialog').open) $('dialog').showModal();
}
function busy(button, done) {
  if (button.disabled || pending) return;
  pending = true; button.disabled = true; button.classList.add('busy');
  setTimeout(() => {
    pending = false; button.disabled = false; button.classList.remove('busy'); done();
  }, 700);
}
function openScene(kind, id) {
  if (pending) return;
  current = plans.find(p => p.id === id) || plans[6]; forceConflict = kind === 'conflict';
  if (kind === 'list') { closeDialog(); render(); return; }
  if (['loading', 'empty', 'failure'].includes(kind)) { closeDialog(); emptyState(kind); return; }
  if (kind === 'import') { showImport(); return; }
  if (kind === 'import-error' || kind === 'import-ok') { importFile = `生产计划_${today}.xlsx`; importResult(kind === 'import-error'); return; }
  if (['edit', 'insert', 'conflict'].includes(kind)) { showForm(kind === 'insert'); return; }
  if (kind === 'reorder') { showReorder(); return; }
  if (kind === 'delete') { showDelete(); return; }
  if (kind === 'history') { showHistory(); return; }
  if (kind === 'exception') { current = plans[3]; showTasks(); return; }
  if (kind === 'tasks') { if (!id) current = plans[2]; showTasks(); }
}

function showForm(insert) {
  const p = current;
  modal(insert ? '插单' : '修改生产计划', insert ? '' : `生产订单 ${p.order}`,
    `<div id="conflictBanner" hidden></div>${insert ? `<div class="notice">插入到 ${p.order} 之前</div>` : ''}
    <form id="planForm" class="form-grid">
    <div class="field"><label class="req" for="editOrder">生产订单号</label><input id="editOrder" required value="${insert ? '' : p.order}" placeholder="按文本输入，保留前导零"></div>
    <div class="field"><label class="req" for="editQty">订单数量${insert ? '' : ` <span class="input-hint">（原数量：${p.qty}）</span>`}</label><input id="editQty" type="number" min="1" step="1" required value="${insert ? '' : p.qty}" placeholder="正整数"></div>
    <div class="field"><label for="editLine">资源 / 线体</label><select id="editLine" ${insert ? 'disabled' : ''} onchange="formLineChange()"><option value="A">装配一线</option><option value="B">装配二线</option></select></div>
    <div class="field"><label for="editStation">所属工位</label><select id="editStation" required ${insert ? 'disabled' : ''}><option value="S10">总装工位 S10</option><option value="S20">预装工位 S20</option></select></div>
    <div class="field"><label class="req" for="editStart">计划开始时间</label><input id="editStart" type="datetime-local" required value="${today}T${p.start}"></div>
    <div class="field"><label class="req" for="editEnd">计划完成时间</label><input id="editEnd" type="datetime-local" required value="${today}T${p.end}"></div>
    </form>`, `${cancel}<button class="btn primary" id="savePlan" onclick="saveForm(this,${insert})">${insert ? '确认插单' : '保存修改'}</button>`);
}
function formLineChange() {
  $('editStation').innerHTML = '<option value="">请选择工位</option>' + ($('editLine').value === 'A' ? '<option value="S10">总装工位 S10</option><option value="S20">预装工位 S20</option>' : '<option value="S30">装配工位 S30</option>');
}
function saveForm(button, insert) {
  $('editEnd').setCustomValidity($('editEnd').value < $('editStart').value ? '计划完成时间不能早于开始时间' : '');
  if (!$('planForm').reportValidity()) return;
  busy(button, () => {
    if (forceConflict) { showConflict(); return; }
    closeDialog(); render();
    toast(insert ? `演示：已插入到 ${current.order} 之前` : '演示：修改成功，列表已刷新');
  });
}
function showConflict() {
  $('conflictBanner').hidden = false; $('conflictBanner').className = 'notice error';
  $('conflictBanner').innerHTML = '<div><strong>数据已被其他操作修改或删除，请刷新后重试</strong><p>当前状态已变为「待配送」，本次修改未保存。你的输入已保留。</p><button class="link" onclick="toast(\'演示：最新状态为待配送，草稿已保留\')">获取最新状态</button></div>';
  $('savePlan').disabled = true; $('dialogBody').scrollTop = 0;
}
function showReorder() {
  const chosen = plans.filter(p => selected.has(p.id)).sort((a, b) => a.sequence - b.sequence);
  if (chosen.length < 1 || chosen.some(p => !canMaintain(p) || p.line !== chosen[0].line || p.station !== chosen[0].station)) {
    toast('请勾选同一线体与工位内至少一条未到配送时间的计划'); return;
  }
  const targets = plans.filter(p => !selected.has(p.id) && canMaintain(p) && sameScope(p, chosen[0])).sort((a, b) => a.sequence - b.sequence);
  draftOrder = [];
  modal('调整生产顺序', `装配一线 / 总装工位 S10 · 已选 ${chosen.length} 条`,
    `<div class="form-grid"><div class="field"><label for="moveTarget" class="req">目标计划单</label><select id="moveTarget" onchange="reorderPreview()" ${targets.length ? '' : 'disabled'}><option value="">请选择目标计划单</option>${targets.map(p => `<option value="${p.id}">${p.order} · 顺序 ${p.sequence}</option>`).join('')}</select></div><div class="field"><label for="moveSide">放置位置</label><select id="moveSide" onchange="reorderPreview()"><option value="before">之前</option><option value="after">之后</option></select></div></div>${targets.length ? '' : '<div class="notice warn" style="margin-top:16px">暂无其他同资源、工位且未到配送时间的计划，请取消勾选一条作为目标。</div>'}<div class="section-title">所选计划</div><div class="tiny muted">${chosen.map(p => p.order).join('、')}</div>`,
    `${cancel}<button class="btn primary" id="saveOrder" disabled onclick="busy(this,saveOrder)">保存顺序</button>`);
  reorderPreview();
}
function reorderPreview() {
  const chosen = plans.filter(p => selected.has(p.id)).sort((a, b) => a.sequence - b.sequence);
  const target = plans.find(p => p.id === Number($('moveTarget').value));
  draftOrder = [];
  if (!target || selected.has(target.id) || !canMaintain(target) || !sameScope(target, chosen[0]) || chosen.some(p => !canMaintain(p) || !sameScope(p, target))) {
    $('saveOrder').disabled = true; return;
  }
  const before = plans.filter(p => sameScope(p, target)).sort((a, b) => a.sequence - b.sequence);
  draftOrder = before.filter(p => !selected.has(p.id)).map(p => p.id);
  const targetIndex = draftOrder.indexOf(target.id);
  draftOrder.splice(targetIndex + ($('moveSide').value === 'after' ? 1 : 0), 0, ...chosen.map(p => p.id));
  $('saveOrder').disabled = before.every((p, i) => p.id === draftOrder[i]);
}
function saveOrder() {
  reorderPreview();
  if ($('saveOrder').disabled) return;
  const slots = plans.filter(p => draftOrder.includes(p.id)).map(p => p.sequence).sort((a, b) => a - b);
  draftOrder.forEach((id, index) => { plans.find(p => p.id === id).sequence = slots[index]; });
  selected.clear(); closeDialog(); render(); toast('演示：顺序已保存，计划时间保持不变');
}
function showDelete() {
  modal('删除确认', '',
    `<p>是否确认删除生产计划单：${current.order}</p>`,
    `${cancel}<button class="btn danger" onclick="busy(this,()=>{closeDialog();render();toast('演示：删除成功，列表已刷新')})">确认删除</button>`);
  $('dialog').classList.add('delete-confirm');
}
function showHistory() {
  modal('计划变更记录', `生产订单 ${current.order}`,
    `<ol class="timeline"><li><time>${today} 07:15:23 · 王计划</time>修改订单数量 <strong>${current.qty - 20} → ${current.qty}</strong></li><li><time>${today} 07:10:00 · 王计划</time>调整生产顺序 <strong>${current.sequence + 1} → ${current.sequence}</strong></li><li><time>${today} 07:00:10 · 王计划</time>Excel 导入创建<div class="tiny muted">生产计划_${today}.xlsx · 原始第 ${current.id + 1} 行</div></li></ol>`, closeButton);
}
function showTasks() {
  const p = current;
  modal('关联 AGV 运输任务', `生产订单 ${p.order} · ${p.tasks} 个任务`,
    p.tasks ? `${p.state === 4 ? '<div class="notice error">任务执行失败：目标工位暂不可用，等待调度处理。</div>' : ''}<table class="mini-table"><colgroup><col style="width:185px"><col style="width:90px"><col style="width:125px"><col></colgroup><thead><tr><th>任务编号</th><th>任务状态</th><th>目标工位</th><th>创建时间</th></tr></thead><tbody>${Array.from({ length: p.tasks }, (_, i) => {
      const failed = p.state === 4 && i === 1;
      const label = failed ? '执行失败' : i < p.done ? '已完成' : p.state === 1 ? '待执行' : '执行中';
      return `<tr><td>AGV${today.replaceAll('-', '')}0${31 + i}${failed ? '<span class="error-cell tiny" style="display:block">目标工位暂不可用</span>' : ''}</td><td><span class="status ${failed ? 'red' : i < p.done ? 'green' : 'blue'}">${label}</span></td><td>总装工位 S10</td><td>${date(p.trigger)}</td></tr>`;
    }).join('')}</tbody></table>` : '<div class="blank" style="min-height:180px"><h2>暂无关联 AGV 运输任务</h2></div>', closeButton);
}

function showImport() {
  importFile = '';
  modal('Excel 导入', '选择文件后立即上传，系统处理后返回导入结果',
    `<div class="upload"><svg class="icon"><use href="#upload"/></svg><p><strong>上传生产计划 Excel</strong></p><p class="tiny muted">订单号保留前导零，数量填写正整数。</p><input id="excelFile" type="file" accept=".xlsx" hidden onchange="fileChosen(this)"><button class="btn primary" onclick="$('excelFile').click()">选择并上传文件</button></div><div class="row tiny muted" style="margin-top:16px"><label>演示后端结果 <select id="importResponse"><option value="ok">导入成功</option><option value="error">导入失败</option></select></label><button class="mock-toggle" onclick="importFile='生产计划_'+today+'.xlsx';uploadImport()">上传示例文件</button></div>`, closeButton);
}
function fileChosen(input) {
  if (!input.files.length) return;
  importFile = input.files[0].name;
  if (!/\.xlsx$/i.test(importFile)) { toast('请选择 .xlsx 文件'); return; }
  uploadImport();
}
function uploadImport() {
  if (pending) return;
  importFailure = $('importResponse').value === 'error'; pending = true;
  modal('Excel 导入', importFile,
    '<div class="blank" style="min-height:190px" aria-busy="true"><button class="btn busy" disabled>上传并导入中</button><p>正在等待系统返回结果，请勿重复上传。</p></div>', '<button class="btn" disabled>处理中</button>');
  setTimeout(() => { pending = false; importResult(importFailure); }, 850);
}
function importResult(failed) {
  modal('导入结果', importFile,
    `<div class="result"><div class="result-icon" style="${failed ? 'color:var(--red);background:#fceeee' : ''}">${failed ? '!' : '✓'}</div><h3>${failed ? '导入失败' : '导入成功'}</h3><p>${failed ? '第 4 行：订单数量必须为正整数。请修改文件后重新上传。' : '成功导入 8 条生产计划。'}</p></div>`,
    failed ? `${closeButton}<button class="btn primary" onclick="showImport()">重新上传</button>` : '<button class="btn primary" onclick="closeDialog()">完成</button>');
  if (!failed) render();
}
function downloadTemplate() {
  busy($('template'), () => toast('演示：后端返回模板文件后，浏览器直接下载；无预览弹窗'));
}
function emptyState(kind) {
  $('plans').hidden = true; $('blank').hidden = false;
  if (kind === 'loading') { $('blank').innerHTML = '<div style="width:100%" aria-busy="true">' + '<div class="skeleton"></div>'.repeat(7) + '</div>'; return; }
  const text = { empty: ['暂无符合条件的生产计划', '调整筛选条件或导入生产计划。', '重置筛选'], failure: ['计划加载失败', '请检查连接后重试。', '重新加载'] }[kind];
  $('blank').innerHTML = `<div class="blank-symbol">${kind === 'failure' ? '!' : '≡'}</div><h2>${text[0]}</h2><p>${text[1]}</p><button class="btn" onclick="resetQuery()">${text[2]}</button>`;
}
function resetQuery() {
  $('query').reset(); $('lineFilter').onchange(); $('stationFilter').value = 'S10';
  $('dateFrom').value = localDay(); $('dateTo').value = localDay(); selected.clear(); render();
}
states.forEach((s, index) => {
  const option = document.createElement('option'); option.value = String(index); option.textContent = s[0]; $('stateFilter').append(option);
});
for (const id of ['dateFrom', 'dateTo']) { $(id).defaultValue = today; $(id).value = today; }
$('lineFilter').onchange = () => {
  $('stationFilter').innerHTML = '<option value="">全部工位</option>' + ($('lineFilter').value === 'A' ? '<option value="S10">总装工位 S10</option><option value="S20">预装工位 S20</option>' : $('lineFilter').value === 'B' ? '<option value="S30">装配工位 S30</option>' : '');
  $('stationFilter').disabled = !$('lineFilter').value;
};
$('query').onsubmit = event => {
  event.preventDefault();
  $('dateTo').setCustomValidity($('dateFrom').value && $('dateTo').value && $('dateFrom').value > $('dateTo').value ? '结束日期不能早于开始日期' : '');
  if (!$('query').reportValidity()) return;
  selected.clear(); render();
};
$('dateTo').onchange = () => $('dateTo').setCustomValidity('');
$('reset').onclick = resetQuery;
$('refresh').onclick = () => { render(); toast('演示：列表已刷新'); };
$('sortTime').onclick = () => { reverse = !reverse; $('sortTime').textContent = reverse ? '计划开始时间 ↓' : '计划开始时间 ↕'; render(); };
$('template').onclick = downloadTemplate;
$('reorderBtn').onclick = showReorder;
document.querySelectorAll('[data-open]').forEach(button => button.onclick = () => openScene(button.dataset.open));
$('scene').onchange = () => {
  document.querySelector('.panel-head .actions').hidden = false;
  if ($('scene').value === 'reorder') selected = new Set(plans.filter(canMaintain).slice(1, 3).map(p => p.id));
  render(); openScene($('scene').value);
};
$('dialog').addEventListener('cancel', event => { if (pending) event.preventDefault(); });
render();
