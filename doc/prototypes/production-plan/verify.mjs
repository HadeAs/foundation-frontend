// node doc/prototypes/production-plan/verify.mjs — DOM checks, no browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
const window = new Window();
try {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  window.document.write(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, ''));
  window.eval(readFileSync(new URL('./prototype.js', import.meta.url), 'utf8'));
  const get = id => window.document.getElementById(id);
  assert.equal(get('rows').children.length, 9);
  assert.equal(get('dateFrom').value, window.localDay());
  assert.equal(get('dateTo').value, window.localDay());
  assert.equal(get('stateFilter').options.length, 6);
  assert.ok(!get('stateFilter').textContent.includes('部分完成'));
  assert.ok(!get('rows').textContent.includes('调序'));
  window.selectRow(5, true); window.selectRow(6, true);
  assert.equal(get('reorderBtn').disabled, true);
  window.selectRow(7, true); assert.equal(get('reorderBtn').disabled, false);
  window.showReorder();
  assert.deepEqual([...get('moveTarget').options].map(p => p.value), ['', '8', '9']);
  get('moveTarget').value = '8'; get('moveSide').value = 'after'; window.reorderPreview();
  assert.equal(get('saveOrder').disabled, false, 'Single selected plan can move');
  window.closeDialog();
  window.selectRow(8, true); assert.equal(get('reorderBtn').disabled, false);
  window.showReorder(); assert.equal(get('saveOrder').disabled, true);
  assert.equal(get('orderPreview'), null);
  assert.ok(!get('dialogBody').textContent.includes('所选计划按原业务顺序整体移动'));
  assert.equal(get('moveSide').value, 'before');
  assert.deepEqual([...get('moveTarget').options].map(p => p.value), ['', '9']);
  get('moveTarget').value = '9'; window.reorderPreview();
  assert.equal(get('saveOrder').disabled, true, 'Already before target: no change');
  get('moveSide').value = 'after'; window.reorderPreview();
  assert.equal(get('saveOrder').disabled, false);
  window.saveOrder();
  assert.equal(get('rows').lastElementChild.children[2].textContent, '000240914008');
  window.selectRow(7, true);
  const otherStationPlan = window.visiblePlans().find(p => p.id === 9);
  otherStationPlan.station = 'S20';
  window.selectRow(9, true);
  assert.equal(get('reorderBtn').textContent, '调整顺序 (1)', 'Cross-station selection rejected');
  otherStationPlan.station = 'S10';
  window.selectAllRows(true); window.showReorder();
  assert.equal(get('moveTarget').disabled, true, 'No unselected target');
  assert.equal(get('saveOrder').disabled, true);
  window.closeDialog(); window.selectAllRows(false);
  window.openScene('insert', 8);
  assert.equal(get('dialogSubtitle').textContent, '');
  assert.match(get('dialogBody').querySelector('.notice').textContent, /插入到 000240914008 之前/);
  assert.ok(!get('dialogBody').textContent.includes('继承目标'));
  assert.equal(get('editLine').disabled, true); assert.equal(get('insertTarget'), null);
  window.closeDialog();
  window.openScene('delete', 8);
  assert.ok(get('dialog').classList.contains('delete-confirm'));
  assert.equal(get('dialogBody').textContent, '是否确认删除生产计划单：000240914008');
  assert.equal(get('dialogSubtitle').textContent, '');
  window.closeDialog();
  for (const scene of ['import', 'import-error', 'import-ok', 'edit', 'delete', 'history', 'tasks', 'exception', 'conflict']) {
    window.openScene(scene);
    assert.equal(get('dialog').open, true, scene);
    assert.equal(get('dialog').classList.contains('drawer'), false, scene);
    window.closeDialog();
  }
  window.openScene('history'); assert.ok(!get('dialogBody').textContent.includes('AGV')); window.closeDialog();
  window.openScene('tasks', 6); assert.match(get('dialogBody').textContent, /暂无关联/); window.closeDialog();
  window.openScene('conflict'); get('editQty').value = '240'; window.showConflict();
  assert.match(window.document.querySelector('label[for="editQty"]').textContent, /原数量：200/);
  assert.equal(get('editQty').value, '240'); assert.equal(get('savePlan').disabled, true); window.closeDialog();
  window.openScene('import'); window.uploadImport();
  assert.match(get('dialogBody').textContent, /上传并导入中/);
  window.closeDialog(); assert.equal(get('dialog').open, true);
  await new Promise(resolve => setTimeout(resolve, 900));
  assert.equal(get('dialogTitle').textContent, '导入结果');
  assert.ok(!get('dialogBody').textContent.includes('确认导入')); window.closeDialog();
  for (const scene of ['loading', 'empty', 'failure']) {
    window.openScene(scene); assert.equal(get('blank').hidden, false);
  }
  console.log('PASS: today defaults, state restrictions, multi-select reorder, fixed insertion, split modals, direct import and conflicts.');
} finally { await window.happyDOM.close(); }
