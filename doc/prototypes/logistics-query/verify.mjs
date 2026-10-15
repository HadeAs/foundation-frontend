// Contract and local DOM checks; no real browser, API request or business mutation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const api=JSON.parse(read('../../nari-logistics.openapi.json'));
const window=new Window({url:'http://prototype.local/'});
window.fetch=()=>{throw Error('Network is prohibited in the offline prototype');};
window.document.write(read('index.html').replace(/<script[^>]*>[\s\S]*?<\/script>/g,''));
for(const file of ['../basic-data/data.js','data.js','prototype.js'])window.eval(read(file));
const $=id=>window.document.getElementById(id);
const click=selector=>{const node=window.document.querySelector(selector);assert.ok(node,selector);node.click();};
const input=(selector,value)=>{const node=window.document.querySelector(selector);assert.ok(node,selector);node.value=value;node.dispatchEvent(new window.Event('input',{bubbles:true}));};
const submit=id=>$(id).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
const change=(node,value)=>{node.value=value;node.dispatchEvent(new window.Event('change',{bubbles:true}));};
try {
  const app=window.LogisticsQueryPrototype,{pages,fields,rows,common}=window.logisticsQueryData;
  assert.equal(window.document.querySelectorAll('.nav-item').length,4);
  assert.equal(window.document.querySelector('#navigation [data-target="warehouseBox"]'),null);
  app.navigate('warehouseBox');assert.equal(app.getState().main.key,'warehouse');assert.equal(window.location.hash,'#warehouse');
  const initial=JSON.stringify(rows);
  for(const [key,config] of Object.entries(pages)){
    const response=api.components.schemas[`${config.schema}Response`].properties;
    const query=api.components.schemas[`${config.schema}Query`].properties;
    assert.ok(api.paths[`/api/v1/business/${config.resource}`].get);
    assert.ok(api.paths[`/api/v1/business/${config.resource}/{id}`].get);
    const displayed=new Set([...config.details,...config.technical,...config.snapshots,...common]);
    assert.deepEqual([...displayed].sort(),Object.keys(response).filter(field=>field!=='id').sort(),`${key}: detail coverage excludes hidden primary ID`);
    for(const field of config.columns)assert.ok(response[field],`${key} column ${field}`);
    for(const filter of [...config.filters,...config.more]){
      const keys=filter.endsWith('Range')?[filter.slice(0,-5)+'Start',filter.slice(0,-5)+'End']:[filter];
      for(const field of keys)assert.ok(query[field],`${key} query ${field}`);
    }
    const allowedSort=query.sortBy.description.split('支持：')[1].split('、').filter(field=>field!=='id');
    assert.deepEqual(Array.from(config.sort).sort(),allowedSort.sort(),`${key}: visible supported sort fields exposed`);
    for(const row of rows[key])for(const field of Object.keys(row))assert.ok(response[field],`${key} fixture ${field}`);
    for(const field of [...config.filters,...config.more].filter(field=>!field.endsWith('Range')))if(fields[field].target)assert.ok(pages[fields[field].target]||window.basicData.schema[fields[field].target]);
    if(key==='warehouseBox')continue; // Box contracts remain, but the list is parent-scoped only.
    app.navigate(key);
    assert.doesNotMatch($('mainTable').textContent,/记录 ID/);
    assert.equal($('mainTable').querySelector('[data-action="sort"][data-field="id"]'),null);
    assert.deepEqual(Array.from($('mainTable').querySelectorAll('[data-action="sort"]'),node=>node.dataset.field).sort(),allowedSort.sort());
    assert.equal(app.getState().main.sort.key,'createdTime');assert.equal(app.getState().main.sort.order,'DESC');
    assert.equal(Object.keys(app.getState().main.query).length,0);
    assert.equal($('mainTable').querySelectorAll('tbody tr').length,20);
    assert.equal($('mainTable').querySelector('[type="checkbox"]'),null);
    click('[data-action="next"][data-scope="main"]');assert.equal($('mainTable').querySelectorAll('tbody tr').length,8);
    click('[data-action="sort"][data-field="updatedTime"][data-scope="main"]');assert.equal(app.getState().main.page,1);assert.equal(app.getState().main.sort.order,'ASC');
    click('[data-action="sort"][data-field="updatedTime"][data-scope="main"]');assert.equal(app.getState().main.sort.order,'DESC');
    click('[data-action="sort"][data-field="updatedTime"][data-scope="main"]');assert.equal(app.getState().main.sort,null);
    click('[data-action="reset"][data-scope="main"]');assert.equal(app.getState().main.sort.order,'DESC');
    click('[data-action="sort"][data-field="updatedTime"][data-scope="main"]');
    assert.equal(window.document.activeElement.dataset.field,'updatedTime','Sorting preserves keyboard focus');
    click('[data-action="next"][data-scope="main"]');
    click('[data-action="refresh"][data-scope="main"]');assert.equal(app.getState().main.sort.key,'updatedTime');assert.equal(app.getState().main.page,2);
    click('[data-action="reset"][data-scope="main"]');assert.equal(app.getState().main.sort.key,'createdTime');
    app.showDetail(key,1);assert.ok($('viewer').open);assert.doesNotMatch($('viewer').textContent,/记录 ID/);assert.ok($('viewer').querySelector('.snapshot'));assert.equal($('viewer').querySelectorAll('input,textarea,select').length,0);app.closeDialog('viewer');
    for(const scene of ['loading','empty','failure']){app.setScene(scene);assert.ok($('mainTable').querySelector(`.state-${scene}`));if(scene==='failure')assert.doesNotMatch($('pagination').textContent,/共 0 条/);}
    click('[data-action="retry"][data-scope="main"]');assert.equal(app.getState().scene,'normal');
  }
  app.navigate('task');
  input('#filters [name="orderNo"]','000241015001');assert.equal(app.filtered().length,28);submit('filters');assert.equal(app.filtered().length,1);
  input('#filters [name="orderNo"]','unsubmitted');click('[data-action="refresh"][data-scope="main"]');assert.equal(app.filtered().length,1);assert.equal(app.getState().main.draft.orderNo,'unsubmitted');
  click('[data-action="reset"][data-scope="main"]');click('[data-action="expand"][data-scope="main"]');
  input('#filters [name="queueNo"]','2');click('[data-action="expand"][data-scope="main"]');submit('filters');assert.equal(app.filtered()[0].queueNo,2);
  click('[data-action="reset"][data-scope="main"]');
  app.navigate('operation');input('#filters [name="occurredTimeStart"]','2026-10-15T12:00');input('#filters [name="occurredTimeEnd"]','2026-10-14T12:00');submit('filters');assert.match($('filters').textContent,/开始时间不能晚于结束时间/);assert.equal(app.filtered().length,28);
  input('#filters [name="occurredTimeStart"]','2026-10-14T00:00');submit('filters');assert.ok(app.filtered().length>0&&app.filtered().length<28);
  app.showPicker('taskId','main');app.choose(28);assert.equal(app.getState().main.draft.taskId,28);assert.equal(app.getState().main.query.taskId,undefined);
  app.showPicker('taskId','main');assert.equal(app.getState().picker.page,6);assert.equal($('picker').querySelectorAll('th').length,1);assert.equal($('picker').querySelector('[aria-selected="true"]').dataset.id,'28');app.closeDialog('picker');
  click('[data-action="clear"][data-field="taskId"]');assert.equal($('picker').open,false);assert.equal(app.getState().main.draft.taskId,'');
  app.showPicker('taskId','main');$('picker').querySelector('.picker-row').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal($('picker').open,false);
  app.navigate('warehouse');app.showBoxes(1);const child=app.getState().stack.at(-1);assert.equal(app.filtered(child).length,2);assert.ok(app.filtered(child).every(row=>row.warehouseRecordId===1));
  assert.equal($('viewer').querySelector('[data-action="sort"][data-field="id"]'),null);
  assert.deepEqual(Array.from($('viewer').querySelectorAll('[data-action="sort"]'),node=>node.dataset.field).sort(),['createdTime','updatedTime']);
  assert.doesNotMatch($('viewer').querySelector('thead').textContent,/所属缴库记录|记录 ID/);
  click('#viewer [data-action="sort"][data-field="updatedTime"]');assert.equal(child.sort.key,'updatedTime');assert.equal(app.filtered(child)[0].id,1);
  click('#viewer [data-action="sort"][data-field="updatedTime"]');assert.equal(app.filtered(child)[0].id,2);assert.ok(app.filtered(child).every(row=>row.warehouseRecordId===1));
  assert.equal($('childFilters').querySelector('[data-field="warehouseRecordId"]'),null);
  input('#childFilters [name="orderNo"]','000241015001');submit('childFilters');assert.equal(app.filtered(child).length,1);
  app.showDetail('warehouseBox',1);assert.equal(window.document.querySelectorAll('dialog[open]').length,1);click('#viewer [data-action="back"]');assert.equal(app.getState().stack.at(-1),child);assert.equal(app.filtered(child).length,1);
  click('#viewer [data-action="reset"]');assert.equal(child.parentId,1);assert.equal(app.filtered(child).length,2);assert.ok(app.filtered(child).every(row=>row.warehouseRecordId===1));app.closeDialog('viewer');
  app.showBoxes(28);assert.match($('viewer').textContent,/暂无符合条件的记录/);app.closeDialog('viewer');
  app.navigate('receiving');app.showDetail('receiving',1);click('#viewer [data-action="detail"][data-target="task"]');assert.equal(app.getState().stack.length,2);assert.match($('viewerTitle').textContent,/物流运输任务/);click('#viewer [data-action="back"]');assert.match($('viewerTitle').textContent,/库房接收记录/);app.closeDialog('viewer');
  app.setScene('unknown');app.showDetail('receiving',28);click('#viewer [data-target="task"]');assert.match($('viewer').textContent,/ID：999/);click('#viewer [data-action="back"]');assert.match($('viewerTitle').textContent,/库房接收/);app.closeDialog('viewer');
  app.navigate('task');app.setScene('unknown');assert.match($('mainTable').textContent,/UNRECOGNIZED_STATUS/);assert.ok($('mainTable').querySelector('.runtime-tag.neutral'));
  app.setScene('detail-failure');app.showDetail('task',1);assert.match($('viewer').textContent,/详情加载失败/);click('[data-action="retry"][data-scope="viewer-detail"]');assert.match($('viewer').textContent,/业务信息/);app.closeDialog('viewer');
  assert.equal(JSON.stringify(rows),initial,'All user interactions are read only');
  rows.operation[0].reason='<img src=x onerror=alert(1)>';rows.operation[0].beforeState='<script>alert(1)</script>';
  app.navigate('operation');app.showDetail('operation',1);assert.equal($('viewer').querySelector('img,script'),null);assert.match($('viewer').textContent,/<script>alert/);app.closeDialog('viewer');
  app.navigate('warehouse');app.showBoxes(1);app.showDetail('warehouseBox',1);assert.match($('viewer').textContent,/数量0/);app.closeDialog('viewer');
  app.showDetail('container',3);assert.match($('viewerTitle').textContent,/容器台账/);assert.match($('viewer').textContent,/容器编码/);
  $('viewer').dispatchEvent(new window.Event('cancel',{cancelable:true}));assert.equal($('viewer').open,false);
  const js=read('prototype.js');assert.doesNotMatch(js,/setInterval|localStorage|fetch\(/);
  console.log('PASS: four query pages with embedded warehouse box details; five object contracts; default/switchable sorting and pagination; draft/applied filters; date validation; picker/keyboard/clear; scoped box lists; same-modal navigation and back; missing/unknown/zero; safe snapshots; loading/error/retry; no network or writes.');
} finally {await window.happyDOM.close();}
