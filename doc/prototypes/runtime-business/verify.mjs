// Local DOM / contract checks only; no real browser and no backend requests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const api=JSON.parse(read('../../nari-logistics.openapi.json'));
function setup(html,files){
  const window=new Window({url:'http://prototype.local/'});
  window.fetch=()=>{throw new Error('Prototype must not call the network');};
  window.document.write(read(html).replace(/<script[^>]*>[\s\S]*?<\/script>/g,''));
  const style=window.document.createElement('style');style.textContent=read('../basic-data/style.css')+read('style.css');window.document.head.append(style);
  for(const file of files)window.eval(read(file));
  const get=id=>window.document.getElementById(id);
  const click=selector=>{const el=window.document.querySelector(selector);assert.ok(el,selector);el.click();};
  const change=(id,value)=>{get(id).value=value;get(id).dispatchEvent(new window.Event('change',{bubbles:true}));};
  const submit=id=>get(id).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  return {window,get,click,change,submit};
}
const runtime=setup('index.html',['../basic-data/data.js','data.js','prototype.js']);
try {
  const {window,get,click,change,submit}=runtime,app=window.RuntimePrototype,{pages,fields,common,rows}=window.runtimeData;
  assert.equal(window.document.querySelectorAll('.nav-item').length,4);
  for(const [key,config] of Object.entries(pages)){
    app.navigate(key);
    const response=api.components.schemas[`Nari${config.schema}Response`].properties;
    const query=api.components.schemas[`Nari${config.schema}Query`].properties;
    for(const field of [...config.columns,...config.details,...config.technical,...common])assert.ok(response[field],`${key}.${field} response`);
    for(const field of [...config.filters,...config.more])assert.ok(query[field],`${key}.${field} query`);
    for(const row of rows[key])for(const field of Object.keys(row))assert.ok(response[field],`${key} fixture field ${field}`);
    assert.equal(get('mainTable').querySelector('[type="checkbox"]'),null,'Read-only lists have no mutation selection');
    assert.ok([...get('mainTable').querySelectorAll('tbody button')].every(el=>el.textContent==='查看'));
    assert.deepEqual(Array.from(get('mainTable').querySelectorAll('[data-action="sort"]'),el=>el.dataset.key),['createdTime','updatedTime']);
    click('[data-action="sort"][data-key="updatedTime"]');assert.equal(app.getState().sort.order,'ASC');
    click('[data-action="sort"][data-key="updatedTime"]');assert.equal(app.getState().sort.order,'DESC');
    click('[data-action="sort"][data-key="updatedTime"]');assert.equal(app.getState().sort,null);
    app.detail(1);assert.ok(get('detail').open);assert.match(get('detail').textContent,/追溯信息/);app.close('detail');
    const colors=new Set(),icons=new Set();
    for(const scene of ['loading','empty','failure']){
      app.setScene(scene);const panel=get('mainTable').querySelector(`.state-${scene}`);assert.ok(panel);icons.add(panel.querySelector('path').getAttribute('d'));colors.add(window.getComputedStyle(panel.querySelector('.state-symbol')).color);
    }
    assert.equal(colors.size,3);assert.equal(icons.size,3);click('[data-action="retry"]');assert.ok(get('mainTable').querySelector('table'));
    app.setScene('unknown');assert.match(get('mainTable').textContent,/关联信息不可用/);assert.match(get('mainTable').textContent,/NEW_/);assert.ok(get('mainTable').querySelector('.neutral'));
  }
  app.navigate('vehicleLoad');assert.ok(app.filtered().every(row=>row.bindingStatus==='ACTIVE'));
  get('filters').querySelector('[name="bindingStatus"]').value='';submit('filters');assert.equal(app.filtered().length,5);
  get('filters').querySelector('[name="bindingStatus"]').value='UNBOUND';click('[data-action="refresh"]');assert.equal(app.filtered().length,5,'Refresh ignores unsubmitted draft');
  submit('filters');assert.equal(app.filtered().length,2);click('[data-action="reset"]');assert.equal(app.getState().query.bindingStatus,'ACTIVE');
  app.pick('boxId');assert.equal(get('pickerTable').querySelectorAll('tbody tr').length,3);app.choose(3);assert.equal(app.getState().draft.boxId,3);assert.equal(app.getState().query.boxId,undefined);
  app.pick('boxId');assert.equal(get('pickerTable').querySelector('[aria-selected="true"]').dataset.id,'3');app.close('picker');
  click('[data-action="clear"][data-key="boxId"]');assert.equal(get('picker').open,false);assert.equal(app.getState().draft.boxId,'');
  app.pick('vehicleId');assert.equal(get('pickerTable').querySelectorAll('tbody tr').length,3);app.choose(1);click('[data-action="expand"]');app.pick('vehicleSlotId');assert.equal(get('pickerTable').querySelectorAll('tbody tr').length,4);app.choose(1);
  app.pick('vehicleId');app.choose(2);assert.equal(app.getState().draft.vehicleSlotId,'');
  app.navigate('locationState');change('pageSize','5');assert.equal(get('mainTable').querySelectorAll('tbody tr').length,5);click('[data-action="next"]');assert.equal(get('mainTable').querySelectorAll('tbody tr').length,1);
  app.setScene('no-state');assert.match(get('mainTable').textContent,/暂无运行状态/);assert.equal(app.getState().query.locationId,8);
  app.navigate('containerState');app.setScene('no-state');assert.equal(app.getState().query.containerId,5);assert.equal(app.filtered().length,0);
  app.navigate('containerState');const zero=rows.containerState.find(row=>row.totalQuantity===0);app.detail(zero.id);assert.match(get('detail').textContent,/总数量0/);app.close('detail');
  app.navigate('boxBinding');get('filters').querySelector('[name="bindingMode"]').value='BY_ORDER';submit('filters');assert.equal(app.filtered()[0].quantity,23,'Order binding remains an aggregate row');
  rows.boxBinding[0].orderNo='<img src=x onerror=alert(1)>';app.detail(1);assert.equal(get('detail').querySelector('img'),null,'Untrusted strings rendered as text');
  assert.ok(!Object.values(fields).some(field=>field.options?.undefined),'Unknown values are not defaulted');
} finally {await runtime.window.happyDOM.close();}

const fixture=setup('../basic-data/index.html',['../basic-data/data.js','../basic-data/prototype.js','fixture-orders.js']);
try {
  const {window,get,click,submit}=fixture,app=window.RuntimeFixturePrototype,basic=window.BasicDataPrototype,data=window.basicData;
  basic.navigate('container');assert.equal(get('mainTable').querySelectorAll('[data-fixture-action="open"]').length,1);
  assert.equal(app.canManage(data.records.container[0]),false);assert.equal(app.canManage(data.records.container[3]),false);assert.equal(app.canManage(data.records.container[5]),true);
  app.open(1);assert.equal(get('fixtureManager').open,false);click('[data-fixture-action="open"]');assert.equal(app.getState().owner,6);
  assert.equal(get('fixtureManager').querySelectorAll('tbody tr').length,3);
  // A second eligible box has an independent owner scope, even with similar order numbers.
  data.records.container.push({...data.records.container[5],id:77,containerCode:'BOX-F-077',containerName:'另一治具箱'});
  app.getState().data.push({...app.getState().data[0],id:77,boxId:77});
  app.open(77);assert.equal(get('fixtureManager').querySelectorAll('tbody tr').length,1);
  app.open(6);assert.equal(get('fixtureManager').querySelectorAll('tbody tr').length,3);
  app.getState().data.pop();
  app.edit();assert.ok(get('fixtureOwner').disabled);assert.equal(get('fixtureEnabled').getAttribute('role'),'switch');
  await app.save();assert.match(get('fixtureError').textContent,/请填写订单号/);
  get('fixtureOrder').value='000000007';get('fixtureEnabled').checked=false;get('fixtureRemark').value='<b>保留为文本</b>';
  const saving=app.save();assert.ok(get('fixtureSave').disabled);assert.ok(get('fixtureSave').classList.contains('busy'));app.requestClose('fixtureEditor');assert.ok(get('fixtureEditor').open);await app.save();await saving;
  assert.equal(app.getState().data.length,4);assert.equal(app.getState().data.at(-1).orderNo,'000000007');assert.equal(app.getState().data.at(-1).enabled,false);assert.equal(app.getState().data.at(-1).boxId,6);assert.equal(get('fixtureManager').querySelector('tbody b'),null);
  app.edit(1);get('fixtureOrder').value='未保存';app.requestClose('fixtureEditor');assert.ok(get('fixtureConfirm').open);await app.confirmAction();assert.equal(app.getState().data[0].orderNo,'000240914007');assert.equal(get('fixtureEditor').open,false);
  for(const feedback of ['duplicate','writeFailure','conflict']){
    app.setFeedback(feedback);app.edit(1);get('fixtureOrder').value='000009';await app.save();assert.ok(get('fixtureEditor').open);assert.equal(get('fixtureOrder').value,'000009');assert.ok(!get('fixtureError').hidden);assert.equal(get('fixtureSave').disabled,feedback==='conflict');app.requestClose('fixtureEditor');await app.confirmAction();
  }
  app.setFeedback('normal');app.edit(1);get('fixtureRemark').value='';await app.save();assert.equal(app.getState().data[0].remark,null);
  get('fixtureFilters').querySelector('[name="orderNo"]').value='000000007';submit('fixtureFilters');assert.equal(get('fixtureManager').querySelectorAll('tbody tr').length,1);
  click('[data-fixture-action="reset"]');get('fixtureAll').click();assert.equal(app.getState().selected.size,4);click('[data-fixture-action="batch"]');assert.match(get('fixtureConfirm').textContent,/4 条/);await app.confirmAction();assert.equal(app.getState().data.length,0);assert.match(get('fixtureManager').textContent,/暂无适用订单/);
  for(const scene of ['loading','empty','failure']){app.setFeedback(scene);assert.ok(get('fixtureManager').querySelector(`.state-${scene}`));}click('[data-fixture-action="refresh"]');assert.equal(app.getState().feedback,'normal');
  // Native Escape must route through the fixture's dirty guard, not the base prototype.
  app.edit();get('fixtureOrder').value='草稿';get('fixtureEditor').dispatchEvent(new window.Event('cancel',{cancelable:true}));assert.ok(get('fixtureEditor').open);assert.ok(get('fixtureConfirm').open);
} finally {await fixture.window.happyDOM.close();}
console.log('PASS: 4 read-only runtime pages, V9 field alignment, filters/history, paging/sorting, reference picker, missing/unknown states, escaped details; embedded fixture-order eligibility and CRUD, locking, errors/conflicts, null clearing, cancel and batch delete.');
