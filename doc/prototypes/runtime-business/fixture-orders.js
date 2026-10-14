// Embedded review-only maintenance. No fetch, storage, or production integration.
(() => {
  const {records}=window.basicData;
  const $=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data=[
    {id:1,boxId:6,orderNo:'000240914007',enabled:true,remark:'选择焊工序',version:2,createdTime:'2026-10-13 08:30:00',updatedTime:'2026-10-14 08:30:00'},
    {id:2,boxId:6,orderNo:'000240914008',enabled:true,remark:'共用治具',version:1,createdTime:'2026-10-13 09:00:00',updatedTime:'2026-10-14 09:00:00'},
    {id:3,boxId:6,orderNo:'000240914006',enabled:false,remark:'旧订单停用',version:3,createdTime:'2026-10-12 08:30:00',updatedTime:'2026-10-13 17:00:00'},
  ];
  let owner=null,query={},page=1,size=20,selected=new Set(),sort=null,editor=null,confirmation=null,busy=false,feedback='normal',toastTimer;
  const origins=new Map();
  function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2200);}
  for(const [id,cls] of [['fixtureManager','large-dialog'],['fixtureEditor',''],['fixtureConfirm','confirm-dialog']]){const dialog=document.createElement('dialog');dialog.id=id;dialog.className=cls;dialog.setAttribute('aria-labelledby',`${id}Title`);dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose(id);});document.body.append(dialog);}
  const closeIcon='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg>';
  const btn=(action,text,cls='',extra='')=>`<button class="${cls}" data-fixture-action="${action}" ${extra}>${text}</button>`;
  const header=(id,title,subtitle='')=>`<header class="dialog-header"><div><h2 id="${id}Title">${escape(title)}</h2>${subtitle?`<p>${escape(subtitle)}</p>`:''}</div>${btn('close',closeIcon,'icon-button',`data-dialog="${id}" aria-label="关闭"`)}</header>`;
  function canManage(row){const model=records.model.find(m=>m.id===row?.containerModelId);return model?.containerCategory==='BOX'&&model?.usageType==='FIXTURE_BOX';}
  function show(id){if(!$(id).open){origins.set(id,document.activeElement);$(id).showModal();}}
  function close(id){if(busy)return;$(id).close();origins.get(id)?.focus();if(id==='fixtureEditor')editor=null;if(id==='fixtureManager')owner=null;if(id==='fixtureConfirm')confirmation=null;}
  function current(){return records.container.find(r=>r.id===owner);}
  function filtered(){const result=data.filter(r=>r.boxId===owner&&(!query.orderNo||r.orderNo.includes(query.orderNo))&&(!query.enabled||String(r.enabled)===query.enabled));if(sort)result.sort((a,b)=>String(a[sort.key]).localeCompare(String(b[sort.key]))*(sort.order==='ASC'?1:-1));return result;}
  function visible(){return filtered().slice((page-1)*size,page*size);}
  function state(kind,title){const path={loading:'M12 3a9 9 0 1 1-9 9',empty:'M4 5h16l2 10v5H2v-5L4 5zM2 15h6l2 3h4l2-3h6',failure:'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M12 7v6M12 17h.01'};return `<div class="empty-state fixture-state state-${kind}" role="${kind==='failure'?'alert':'status'}"><span class="state-symbol"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${path[kind]}"/></svg></span><strong>${title}</strong>${kind==='failure'?btn('refresh','重试'):''}</div>`;}
  function render(){
    if(!owner)return;const total=filtered().length;page=Math.min(page,Math.ceil(total/size)||1);const rows=visible(),available=!['loading','empty','failure'].includes(feedback);
    const timeHeader=(key,title)=>`<th aria-sort="${sort?.key===key?(sort.order==='ASC'?'ascending':'descending'):'none'}">${btn('sort',`${title} ${sort?.key===key?(sort.order==='ASC'?'▴':'▾'):'↕'}`,'sort-button',`data-key="${key}"`)}</th>`;
    const table=`<table style="min-width:940px"><colgroup><col style="width:42px"><col style="width:170px"><col style="width:80px"><col style="width:160px"><col style="width:170px"><col style="width:170px"><col style="width:148px"></colgroup><thead><tr><th class="selection"><input type="checkbox" id="fixtureAll" aria-label="全选当前页" ${rows.length&&rows.every(r=>selected.has(r.id))?'checked':''}></th><th>订单号</th><th>状态</th><th>备注</th>${timeHeader('createdTime','创建时间')}${timeHeader('updatedTime','更新时间')}<th class="actions">操作</th></tr></thead><tbody>${rows.map(r=>`<tr class="${selected.has(r.id)?'selected':''}"><td class="selection"><input type="checkbox" data-fixture-row="${r.id}" aria-label="选择订单 ${escape(r.orderNo)}" ${selected.has(r.id)?'checked':''}></td><td class="code">${escape(r.orderNo)}</td><td><span class="badge ${r.enabled?'':'off'}">${r.enabled?'启用':'停用'}</span></td><td class="truncate" title="${escape(r.remark)}">${escape(r.remark)||'—'}</td><td>${escape(r.createdTime)}</td><td>${escape(r.updatedTime)}</td><td class="actions">${btn('view','查看','link',`data-id="${r.id}"`)}${btn('edit','编辑','link',`data-id="${r.id}"`)}${btn('delete','删除','link danger-text',`data-id="${r.id}"`)}</td></tr>`).join('')}</tbody></table>`;
    $('fixtureManager').innerHTML=header('fixtureManager','治具箱适用订单',`${current().containerName} · ${current().containerCode}`)+`<div class="dialog-body manager-content"><div class="review-bar"><span>原型反馈演示</span><div class="review-tools"><select id="fixtureFeedback" aria-label="适用订单评审场景">${Object.entries({normal:'正常',loading:'查询加载中',empty:'查询空数据',failure:'查询加载失败',duplicate:'保存被拒绝',conflict:'版本冲突',writeFailure:'写入失败'}).map(([v,l])=>`<option value="${v}" ${feedback===v?'selected':''}>${l}</option>`).join('')}</select></div></div><form id="fixtureFilters" class="filter-panel fixture-filter"><input name="orderNo" aria-label="订单号" placeholder="请输入订单号" value="${escape(query.orderNo)}"><select name="enabled" aria-label="状态"><option value="">全部状态</option><option value="true" ${query.enabled==='true'?'selected':''}>启用</option><option value="false" ${query.enabled==='false'?'selected':''}>停用</option></select><div class="query-actions"><button class="primary" type="submit">查询</button>${btn('reset','重置','', 'type="button"')}${btn('refresh','刷新','','type="button"')}</div></form><div class="toolbar"><span></span><div class="toolbar-actions">${btn('batch',`批量删除${selected.size?` (${selected.size})`:''}`,'danger-text',selected.size&&available?'':'disabled')}${btn('create','新增','primary')}</div></div><div class="fixture-table-wrap">${!available?state(feedback,({loading:'正在加载适用订单',empty:'暂无适用订单',failure:'适用订单加载失败'})[feedback]):rows.length?table:state('empty','暂无适用订单')}</div><div class="pagination"><span>共 ${available?total:feedback==='empty'?0:'—'} 条</span>${btn('prev','‹','',page<=1||!available?'disabled aria-label="上一页"':'aria-label="上一页"')}<span class="page-current">${page}</span>${btn('next','›','',page*size>=total||!available?'disabled aria-label="下一页"':'aria-label="下一页"')}<select id="fixtureSize" aria-label="每页条数">${[5,10,20,50].map(n=>`<option value="${n}" ${size===n?'selected':''}>${n} 条/页</option>`).join('')}</select></div></div><footer class="dialog-footer">${btn('close','关闭','', 'data-dialog="fixtureManager"')}</footer>`;
    if($('fixtureAll'))$('fixtureAll').indeterminate=rows.some(r=>selected.has(r.id))&&!rows.every(r=>selected.has(r.id));
  }
  function open(id){const row=records.container.find(r=>r.id===id);if(!canManage(row))return;owner=id;query={};page=1;sort=null;selected.clear();feedback='normal';render();show('fixtureManager');}
  function edit(id=null,readonly=false){
    if(!owner||!canManage(current()))return;const original=id?data.find(r=>r.id===id&&r.boxId===owner):null;if(id&&!original)return;
    editor={id,readonly,blocked:false,initial:{orderNo:original?.orderNo??'',enabled:original?.enabled??true,remark:original?.remark??''},version:original?.version};
    const values=editor.initial;
    $('fixtureEditor').innerHTML=header('fixtureEditor',`${readonly?'查看':id?'编辑':'新增'}适用订单`)+`<div class="dialog-body"><div id="fixtureError" class="notice error" role="alert" hidden></div>${readonly?`<dl class="detail-grid"><div><dt>治具箱</dt><dd>${escape(current().containerName)} · ${escape(current().containerCode)}</dd></div><div><dt>订单号</dt><dd>${escape(original.orderNo)}</dd></div><div><dt>状态</dt><dd>${original.enabled?'启用':'停用'}</dd></div><div><dt>备注</dt><dd>${escape(original.remark)||'—'}</dd></div><div><dt>创建时间</dt><dd>${escape(original.createdTime)}</dd></div><div><dt>更新时间</dt><dd>${escape(original.updatedTime)}</dd></div></dl>`:`<form id="fixtureForm" class="form-grid"><div class="field"><label for="fixtureOwner">治具箱</label><input id="fixtureOwner" value="${escape(current().containerName)} · ${escape(current().containerCode)}" disabled></div><div class="field"><label for="fixtureOrder"><span class="required">*</span>订单号</label><input id="fixtureOrder" maxlength="128" placeholder="请输入订单号" value="${escape(values.orderNo)}" required></div><div class="field"><label for="fixtureEnabled">状态</label><div class="switch-control"><input id="fixtureEnabled" type="checkbox" role="switch" class="boolean-switch" ${values.enabled?'checked':''}><span class="switch-value">${values.enabled?'启用':'停用'}</span></div></div><div class="field wide"><label for="fixtureRemark">备注</label><textarea id="fixtureRemark" maxlength="500">${escape(values.remark)}</textarea></div></form>`}</div><footer class="dialog-footer">${btn('close',readonly?'关闭':'取消','', 'data-dialog="fixtureEditor"')}${readonly?'':btn('save','保存','primary','id="fixtureSave"')}</footer>`;show('fixtureEditor');
  }
  const draft=()=>({orderNo:$('fixtureOrder').value,enabled:$('fixtureEnabled').checked,remark:$('fixtureRemark').value});
  function error(text){$('fixtureError').hidden=false;$('fixtureError').textContent=text;}
  function confirm(mode,ids=[]){
    confirmation={mode,ids};
    const text=mode==='discard'?'当前修改尚未保存，是否放弃？':ids.length===1?`是否确认删除治具箱适用订单：${data.find(r=>r.id===ids[0]).orderNo}`:`是否确认删除选中的 ${ids.length} 条治具箱适用订单？`;
    $('fixtureConfirm').innerHTML=header('fixtureConfirm',mode==='discard'?'放弃修改':'删除确认')+`<div class="dialog-body"><div id="fixtureDeleteError" class="notice error" role="alert" hidden></div><p>${escape(text)}</p></div><footer class="dialog-footer">${btn('close','取消','','data-dialog="fixtureConfirm"')}${btn('confirm',mode==='discard'?'放弃修改':'确认删除','danger','id="fixtureConfirmButton"')}</footer>`;show('fixtureConfirm');
  }
  function requestClose(id){if(busy)return;if(id==='fixtureEditor'&&editor&&!editor.readonly&&JSON.stringify(draft())!==JSON.stringify(editor.initial)){confirm('discard');return;}close(id);}
  async function write(button,callback){
    if(busy)return;busy=true;const controls=[...document.querySelectorAll('#fixtureManager button,#fixtureManager input,#fixtureManager select,#fixtureEditor button,#fixtureEditor input,#fixtureEditor textarea,#fixtureConfirm button')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);button.classList.add('busy');
    try{await new Promise(resolve=>setTimeout(resolve,400));callback();}finally{busy=false;controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});button.classList.remove('busy');if(editor?.blocked&&$('fixtureSave'))$('fixtureSave').disabled=true;}
  }
  async function save(){
    if(busy||!editor||editor.readonly||editor.blocked)return;const values=draft();
    if(!values.orderNo.trim()){error('请填写订单号');return;}if(values.orderNo.length>128||values.remark.length>500){error('订单号最多 128 字符，备注最多 500 字符');return;}
    if(!canManage(current())){error('当前容器不再是专用治具箱，请刷新后重试');return;}
    await write($('fixtureSave'),()=>{
      if(feedback==='conflict'&&editor.id){editor.blocked=true;error('数据已被其他操作修改或删除，请刷新后重试。输入已保留，请关闭后重新打开。');return;}
      if(feedback==='duplicate'){error('演示后端拒绝：该治具箱已配置此订单。输入已保留。');return;}
      if(feedback==='writeFailure'){error('演示请求失败，输入已保留。请确认后重试。');return;}
      const time=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}),existing=data.find(r=>r.id===editor.id);
      if(existing)Object.assign(existing,values,{remark:values.remark||null,version:existing.version+1,updatedTime:time});
      else data.push({...values,boxId:owner,id:Math.max(0,...data.map(r=>r.id))+1,version:1,createdTime:time,updatedTime:time});
      $('fixtureEditor').close();editor=null;selected.clear();feedback='normal';render();$('fixtureManager').querySelector('[data-fixture-action="create"]').focus();notify('已保存适用订单（原型演示）');
    });
  }
  async function confirmAction(){
    if(!confirmation||busy)return;if(confirmation.mode==='discard'){close('fixtureConfirm');close('fixtureEditor');return;}
    await write($('fixtureConfirmButton'),()=>{
      if(['conflict','writeFailure','duplicate'].includes(feedback)){$('fixtureDeleteError').hidden=false;$('fixtureDeleteError').textContent=feedback==='conflict'?'数据已被其他操作修改或删除，请刷新后重试':'演示后端拒绝删除，记录与选择已保留。';return;}
      const ids=confirmation.ids;for(let i=data.length-1;i>=0;i--)if(data[i].boxId===owner&&ids.includes(data[i].id))data.splice(i,1);
      $('fixtureConfirm').close();confirmation=null;selected.clear();render();$('fixtureManager').querySelector('[data-fixture-action="create"]').focus();notify('已删除适用订单（原型演示）');
    });
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-fixture-action]');if(!el||el.disabled||busy)return;const {fixtureAction:action,id,dialog,key}=el.dataset;
    if(action==='open')open(Number(id));if(action==='create')edit();if(action==='edit'||action==='view')edit(Number(id),action==='view');if(action==='save')void save();if(action==='close')requestClose(dialog);
    if(action==='delete')confirm('delete',[Number(id)]);if(action==='batch'&&selected.size)confirm('delete',[...selected]);if(action==='confirm')void confirmAction();
    if(action==='reset'){query={};sort=null;page=1;selected.clear();render();}
    if(action==='refresh'){feedback='normal';selected.clear();render();}
    if(action==='prev'||action==='next'){page+=action==='next'?1:-1;selected.clear();render();}
    if(action==='sort'){sort=sort?.key!==key?{key,order:'ASC'}:sort.order==='ASC'?{key,order:'DESC'}:null;page=1;selected.clear();render();$('fixtureManager').querySelector(`[data-fixture-action="sort"][data-key="${key}"]`).focus();}
  });
  document.addEventListener('change',event=>{
    const el=event.target;if(el.id==='fixtureFeedback'){feedback=el.value;selected.clear();render();}
    if(el.id==='fixtureSize'){size=Number(el.value);page=1;selected.clear();render();}
    if(el.id==='fixtureAll'){visible().forEach(r=>el.checked?selected.add(r.id):selected.delete(r.id));render();}
    if(el.dataset.fixtureRow){el.checked?selected.add(Number(el.dataset.fixtureRow)):selected.delete(Number(el.dataset.fixtureRow));render();}
    if(el.id==='fixtureEnabled')el.nextElementSibling.textContent=el.checked?'启用':'停用';
  });
  document.addEventListener('submit',event=>{if(event.target.id==='fixtureFilters'){event.preventDefault();query=Object.fromEntries(new FormData(event.target));page=1;selected.clear();render();}if(event.target.id==='fixtureForm'){event.preventDefault();void save();}});
  window.RuntimeFixturePrototype={canManage,open,edit,save,confirmAction,requestClose,getState:()=>({owner,query,selected,editor,busy,feedback,data}),setFeedback:value=>{feedback=value;render();}};
  if(location.hash==='#container')window.BasicDataPrototype.navigate('container');
})();
