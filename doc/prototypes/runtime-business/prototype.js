(() => {
  const {fields,pages,rows,common}=window.runtimeData;
  const {schema,records}=window.basicData;
  const $=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',cart:'M3 4h3l3 12h11l2-9H7M11 20h.01M18 20h.01',box:'m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 5 9-5M12 12v9',pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',link:'m9 15 6-6M8 17l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 7l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',menu:'M7 5h14M7 12h14M7 19h14M3 5h.01M3 12h.01M3 19h.01',user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3',settings:'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',close:'m5 5 14 14M19 5 5 19',loading:'M12 3a9 9 0 1 1-9 9',empty:'M4 5h16l2 10v5H2v-5L4 5zM2 15h6l2 3h4l2-3h6',failure:'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M12 7v6M12 17h.01'};
  const icon=name=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.grid}"/></svg>`;
  let key='vehicleLoad',query={},draft={},page=1,size=20,sort=null,expanded=false,scene='normal',picker=null,toastTimer;
  const origins=new Map();
  const lookup=(type,id)=>records[type].find(row=>row.id===Number(id));
  const label=(type,row)=>row?(row[schema[type].name]||row[schema[type].code]):'';
  function reference(type,id) {
    if(id===null||id===undefined||id==='')return '<span class="muted">—</span>';
    const row=lookup(type,id);
    if(!row)return `<span class="muted">ID ${escape(id)} · 关联信息不可用</span>`;
    return `<div class="reference-cell" title="${escape(label(type,row))} · ${escape(row[schema[type].code])}"><strong>${escape(label(type,row))}</strong><small>${escape(row[schema[type].code])}</small></div>`;
  }
  function value(key,value) {
    const field=fields[key];
    if(field.target)return reference(field.target,value);
    if(value===null||value===undefined||value==='')return `<span class="muted">${key==='autoLogisticsEnabled'?'未确认':'—'}</span>`;
    if(field.options){
      const text=field.options[String(value)]||String(value);
      const color=field.options[String(value)]?({ACTIVE:'good',PRESENT:'teal',LOADED:'teal',EMPTY:'good',READY:'good',USED:'warn',true:'good',MATERIAL:'info',FIXTURE:'info',RIVETED:'good',NOT_RIVETED:'warn'}[value]||'neutral'):'neutral';
      return `<span class="runtime-tag ${color}" title="${escape(value)}">${escape(text)}</span>`;
    }
    return escape(value);
  }
  function state(kind,title,action='') {return `<div class="empty-state state-${kind}" role="${kind==='failure'?'alert':'status'}"><span class="state-symbol">${icon(kind)}</span><strong>${title}</strong>${action}</div>`;}
  function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2200);}
  function open(id){origins.set(id,document.activeElement);$(id).showModal();}
  function close(id){$(id).close();origins.get(id)?.focus();if(id==='picker')picker=null;}
  const header=(id,title,subtitle='')=>`<header class="dialog-header"><div><h2 id="${id}Title">${escape(title)}</h2>${subtitle?`<p>${escape(subtitle)}</p>`:''}</div><button class="icon-button" data-action="close" data-dialog="${id}" aria-label="关闭">${icon('close')}</button></header>`;
  function renderControl(name) {
    const field=fields[name],v=draft[name]??'';
    if(field.target)return `<div class="filter-reference"><button type="button" class="filter-related" data-action="pick" data-key="${name}" aria-label="${field.label}"><span>${v?escape(label(field.target,lookup(field.target,v))||`ID ${v}`):`全部${field.label}`}</span>⌄</button>${v?`<button class="clear-related" type="button" data-action="clear" data-key="${name}" aria-label="清除${field.label}">${icon('close')}</button>`:''}</div>`;
    if(field.options)return `<select name="${name}" aria-label="${field.label}"><option value="">全部${field.label}</option>${Object.entries(field.options).map(([v,l])=>`<option value="${v}" ${String(draft[name])===v?'selected':''}>${l}</option>`).join('')}</select>`;
    return `<input name="${name}" aria-label="${field.label}" placeholder="${field.label}" value="${escape(v)}">`;
  }
  function filters(){const config=pages[key];$('filters').innerHTML=`<div class="filter-row">${config.filters.map(renderControl).join('')}<div class="query-actions"><button type="button" class="link" data-action="expand" aria-expanded="${expanded}" aria-controls="moreFilters">${expanded?'收起':'更多条件'} ${expanded?'⌃':'⌄'}</button><button class="primary" type="submit">查询</button><button type="button" data-action="reset">重置</button><button type="button" data-action="refresh">刷新</button></div></div><div class="filter-row filter-more" id="moreFilters" ${expanded?'':'hidden'}>${config.more.map(renderControl).join('')}</div>`;}
  function readFilters(){for(const el of $('filters').querySelectorAll('[name]'))draft[el.name]=el.value.trim();}
  function sourceRows(){
    if(scene==='no-state')return [];
    const result=rows[key].map(row=>({...row}));
    if(scene==='unknown'&&result[0]){
      if(key==='containerState')Object.assign(result[0],{containerId:999,contentState:'NEW_STATE',totalQuantity:null});
      if(key==='locationState')Object.assign(result[0],{locationId:999,presenceState:'NEW_STATE',autoLogisticsEnabled:null});
      if(key==='vehicleLoad')Object.assign(result[0],{boxId:999,relationMode:'NEW_MODE'});
      if(key==='boxBinding')Object.assign(result[0],{boxId:999,bindingMode:'NEW_MODE'});
    }
    return result;
  }
  function filtered(){
    const result=sourceRows().filter(row=>Object.entries(query).every(([name,v])=>v===''||v===undefined|| (fields[name].target||fields[name].options?String(row[name])===String(v):String(row[name]??'').toLowerCase().includes(String(v).toLowerCase()))));
    if(sort)result.sort((a,b)=>(String(a[sort.key]??'').localeCompare(String(b[sort.key]??'')))*(sort.order==='ASC'?1:-1));
    return result;
  }
  function columnHeader(name){
    const sortable=['createdTime','updatedTime'].includes(name),order=sort?.key===name?sort.order:null;
    return `<th ${sortable?`aria-sort="${order==='ASC'?'ascending':order==='DESC'?'descending':'none'}"`:''}>${sortable?`<button class="sort-button" data-action="sort" data-key="${name}" aria-label="${fields[name].label}，${order==='ASC'?'升序，点击降序':order==='DESC'?'降序，点击取消排序':'未排序，点击升序'}">${fields[name].label}<span class="sort-arrows" aria-hidden="true"><span class="${order==='ASC'?'active':''}">▴</span><span class="${order==='DESC'?'active':''}">▾</span></span></button>`:fields[name].label}</th>`;
  }
  function render(){
    const config=pages[key],all=filtered(),total=scene==='empty'?0:all.length;
    page=Math.max(1,Math.min(page,Math.ceil(total/size)||1));
    const visible=all.slice((page-1)*size,page*size),widths=config.columns.map(name=>fields[name].target?200:/Time$/.test(name)?180:['quantity','totalQuantity'].includes(name)?100:fields[name].options?135:175);
    let body;
    if(scene==='loading')body=state('loading','正在加载运行数据');
    else if(scene==='failure')body=state('failure','数据加载失败，请重试','<p><button data-action="retry">重试</button></p>');
    else if(!total)body=state('empty',key.endsWith('State')?'暂无运行状态':'暂无符合条件的关系记录','<p><button data-action="reset">重置查询</button></p>');
    else body=`<table class="runtime-table" style="min-width:${widths.reduce((a,b)=>a+b,76)}px"><colgroup>${widths.map(w=>`<col style="width:${w}px">`).join('')}<col style="width:76px"></colgroup><thead><tr>${config.columns.map(columnHeader).join('')}<th class="actions">操作</th></tr></thead><tbody>${visible.map(row=>`<tr>${config.columns.map(name=>`<td class="${fields[name].target?'reference-cell':'plain-cell'}" ${fields[name].target?'':`title="${escape(fields[name].options?.[row[name]]??row[name]??'—')}"`}>${value(name,row[name])}</td>`).join('')}<td class="actions"><button class="link" data-action="detail" data-id="${row.id}">查看</button></td></tr>`).join('')}</tbody></table>`;
    $('mainTable').innerHTML=body;
    const unavailable=['loading','failure'].includes(scene);
    $('pagination').innerHTML=`<span>共 ${unavailable?'—':total} 条</span><button data-action="prev" aria-label="上一页" ${unavailable||page===1?'disabled':''}>‹</button><span class="page-current">${page}</span><button data-action="next" aria-label="下一页" ${unavailable||page*size>=total?'disabled':''}>›</button><select id="pageSize" aria-label="每页条数" ${unavailable?'disabled':''}>${[5,10,20,50].map(n=>`<option value="${n}" ${size===n?'selected':''}>${n} 条/页</option>`).join('')}</select>`;
  }
  function navigate(next){
    if(!pages[next])return;
    key=next;page=1;sort=null;expanded=false;scene='normal';query={...pages[key].defaults};draft={...query};$('scene').value=scene;
    $('scene').querySelector('[value="no-state"]').disabled=!key.endsWith('State');
    $('pageTitle').textContent=$('breadcrumb').textContent=$('activeTab').textContent=pages[key].label;$('tabIcon').innerHTML=icon(pages[key].icon);
    $('navigation').innerHTML=Object.entries(pages).map(([k,c])=>`<button class="nav-item ${k===key?'active':''}" data-action="navigate" data-key="${k}" ${k===key?'aria-current="page"':''}>${icon(c.icon)}${c.label}</button>`).join('');
    filters();render();
  }
  function detail(id){
    const row=sourceRows().find(r=>r.id===id);if(!row)return;
    const dl=names=>`<dl class="detail-grid">${names.map(name=>`<div><dt>${fields[name].label}</dt><dd>${value(name,row[name])}</dd></div>`).join('')}</dl>`;
    $('detail').innerHTML=header('detail',pages[key].label)+`<div class="dialog-body">${dl(pages[key].details)}<details class="detail-meta"><summary>追溯信息</summary>${dl([...common,...pages[key].technical])}</details></div><footer class="dialog-footer"><button data-action="close" data-dialog="detail">关闭</button></footer>`;open('detail');
  }
  function candidates(){
    const field=fields[picker.key];
    return records[field.target].filter(row=>{
      const model=field.target==='container'?lookup('model',row.containerModelId):null;
      if(field.category==='BOX'&&model?.containerCategory!=='BOX')return false;
      if(field.category==='VEHICLE'&&!['VEHICLE_SLOT','VEHICLE_DIRECT'].includes(model?.containerCategory))return false;
      if(picker.key==='vehicleSlotId'&&draft.vehicleId&&row.vehicleId!==Number(draft.vehicleId))return false;
      return `${label(field.target,row)} ${row[schema[field.target].code]}`.toLowerCase().includes(picker.keyword.toLowerCase());
    });
  }
  function pickerRows(){
    const field=fields[picker.key],all=candidates();picker.page=Math.min(picker.page,Math.ceil(all.length/5)||1);
    $('pickerTable').innerHTML=all.length?`<table><thead><tr><th>名称 / 编码</th><th>归属信息</th><th style="width:85px">状态</th></tr></thead><tbody>${all.slice((picker.page-1)*5,picker.page*5).map(row=>{
      const parent=schema[field.target].fields.find(f=>f.kind==='relation'),owner=parent?lookup(parent.target,row[parent.key]):null;
      return `<tr class="picker-row ${String(draft[picker.key])===String(row.id)?'selected':''}" data-action="choose" data-id="${row.id}" tabindex="0" aria-selected="${String(draft[picker.key])===String(row.id)}"><td>${reference(field.target,row.id)}</td><td>${escape(parent?label(parent.target,owner):'—')}</td><td><span class="badge ${row.enabled?'':'off'}">${row.enabled?'启用':'停用'}</span></td></tr>`;
    }).join('')}</tbody></table>`:state('empty','无匹配对象');
    $('pickerPages').innerHTML=`共 ${all.length} 条 <button data-action="picker-prev" ${picker.page===1?'disabled':''}>上一页</button><span class="page-current">${picker.page}</span><button data-action="picker-next" ${picker.page*5>=all.length?'disabled':''}>下一页</button>`;
  }
  function pick(name){
    readFilters();picker={key:name,page:1,keyword:''};const field=fields[name];
    const index=candidates().findIndex(row=>String(row.id)===String(draft[name]));if(index>=0)picker.page=Math.floor(index/5)+1;
    $('picker').innerHTML=header('picker',`选择${field.label}`)+`<div class="dialog-body">${draft[name]?`<div class="runtime-picker-current">已选：${escape(label(field.target,lookup(field.target,draft[name]))||`ID ${draft[name]}`)}</div>`:''}<form id="pickerFilters" class="filter-panel runtime-picker-search"><input id="pickerKeyword" aria-label="搜索名称或编码" placeholder="搜索名称或编码"><button class="primary">查询</button></form><div id="pickerTable" class="table-scroll"></div><div id="pickerPages" class="pagination"></div></div><footer class="dialog-footer"><button data-action="close" data-dialog="picker">取消</button></footer>`;pickerRows();open('picker');
  }
  function choose(id){if(!candidates().some(row=>row.id===id))return;const name=picker.key;if(name==='vehicleId'&&Number(draft[name])!==id)draft.vehicleSlotId='';draft[name]=id;close('picker');filters();$('filters').querySelector(`[data-action="pick"][data-key="${name}"]`)?.focus();}
  function setScene(next){
    if(next==='no-state'&&!key.endsWith('State'))return;
    scene=next;$('scene').value=next;page=1;
    if(next==='no-state'){query=key==='containerState'?{containerId:5}:{locationId:8};draft={...query};filters();}
    render();
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const {action,key:name,dialog}=el.dataset;
    if(action==='navigate')navigate(name);
    if(action==='expand'){readFilters();expanded=!expanded;filters();$('filters').querySelector('[data-action="expand"]').focus();}
    if(action==='pick')pick(name);
    if(action==='clear'){readFilters();draft[name]='';if(name==='vehicleId')draft.vehicleSlotId='';filters();$('filters').querySelector(`[data-action="pick"][data-key="${name}"]`)?.focus();}
    if(action==='choose')choose(Number(el.dataset.id));
    if(action==='close')close(dialog);
    if(action==='detail')detail(Number(el.dataset.id));
    if(action==='reset'){query={...pages[key].defaults};draft={...query};sort=null;page=1;setScene('normal');filters();}
    if(action==='refresh'||action==='retry'){setScene('normal');notify('已刷新演示数据');}
    if(action==='prev'||action==='next'){page+=action==='next'?1:-1;render();}
    if(action==='picker-prev'||action==='picker-next'){picker.page+=action==='picker-next'?1:-1;pickerRows();}
    if(action==='sort'&&['createdTime','updatedTime'].includes(name)){sort=sort?.key!==name?{key:name,order:'ASC'}:sort.order==='ASC'?{key:name,order:'DESC'}:null;page=1;render();document.querySelector(`[data-action="sort"][data-key="${name}"]`)?.focus();}
  });
  document.addEventListener('submit',event=>{event.preventDefault();if(event.target.id==='filters'){readFilters();query={...draft};page=1;render();}if(event.target.id==='pickerFilters'){picker.keyword=$('pickerKeyword').value.trim();picker.page=1;pickerRows();}});
  document.addEventListener('change',event=>{if(event.target.id==='scene')setScene(event.target.value);if(event.target.id==='pageSize'){size=Number(event.target.value);page=1;render();}});
  document.addEventListener('keydown',event=>{if(event.target.matches('.picker-row')&&['Enter',' '].includes(event.key)){event.preventDefault();choose(Number(event.target.dataset.id));}});
  document.querySelectorAll('dialog').forEach(el=>el.addEventListener('cancel',event=>{event.preventDefault();close(el.id);}));
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  navigate(pages[location.hash.slice(1)]?location.hash.slice(1):'vehicleLoad');
  window.RuntimePrototype={navigate,filtered,detail,pick,choose,setScene,close,getState:()=>({key,query,draft,page,size,sort,scene})};
})();
