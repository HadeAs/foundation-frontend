(() => {
  const {schema,dictionaries,records} = window.basicData;
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    loading:'M12 3a9 9 0 1 1-9 9',
    empty:'M4 5h16l2 10v5H2v-5L4 5zM2 15h6l2 3h4l2-3h6',
    failure:'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M12 7v6M12 17h.01',
    home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    factory:'M3 21V9l6 4V7l6 5V3h5v18H3zM6 17h2m3 0h2m3 0h2',
    layers:'m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4',
    line:'M3 5h18M3 12h18M3 19h18',
    storage:'M3 21V8l9-5 9 5v13M7 21V11h10v10M7 15h10M7 19h10',
    pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    box:'m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 5 9-5M12 12v9M8 5l9 5',
    cart:'M3 4h3l3 12h11l2-9H7M11 20h.01M18 20h.01',
    user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3',
    menu:'M7 5h14M7 12h14M7 19h14M3 5h.01M3 12h.01M3 19h.01',
    settings:'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
    plus:'M12 4v16M4 12h16',close:'m5 5 14 14M19 5 5 19',search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.grid}"/></svg>`;
  const tableState = (state,title,description='',action='') => `<div class="empty-state state-${state}" role="${state==='failure'?'alert':'status'}"><span class="state-symbol">${icon(state)}</span><strong>${escape(title)}</strong>${description?`<p>${escape(description)}</p>`:''}${action}</div>`;
  const clearReferenceButton = (field,source,value) => `<button type="button" class="clear-related" data-action="clear-reference" data-key="${field.key}" data-source="${source}" aria-label="清除${field.label}" title="清除${field.label}" ${value?'':'hidden'}>${icon('close')}</button>`;
  const menus = Object.keys(schema).filter(k=>!schema[k].owner);
  const tabs = ['locationLine','locationModel','locationUsage','locationStorage'];
  const lineTabs = ['resourceLine','lineProcessStorage'];
  const managerTabs = () => lineTabs.includes(managerState?.type)?lineTabs:tabs;
  const managerHasChild = () => ['editor','picker','confirmation'].some(id=>$(id).open);
  let pageKey = 'factory', page = 1, size = 20, query = {}, filterDraft = {}, selected = new Set(), scene = 'normal', sort = null;
  let managerState = null, editorState = null, pickerState = null, deletion = null, busy = false, toastTimer;
  const focusOrigins = new Map();
  const lookup = (type,id) => records[type].find(r=>r.id===Number(id));
  const timeFields = {createdTime:{label:'创建时间',kind:'datetime'},updatedTime:{label:'更新时间',kind:'datetime'}};
  const fieldFor = (type,key) => schema[type].fields.find(f=>f.key===key) || timeFields[key];
  // Only expose visible fields allowed by the V9 sortBy contract.
  const sortableKeys = type => lineTabs.includes(type)?Object.keys(timeFields):[schema[type].code,schema[type].name,...(type==='floor'?['floorNumber']:[]),...(!schema[type].owner?Object.keys(timeFields):[])].filter(Boolean);
  function sortRows(type,rows,sorting) {
    if(!sorting)return rows;
    return [...rows].sort((a,b)=>{
      const left=a[sorting.key], right=b[sorting.key];
      const result=fieldFor(type,sorting.key).kind==='integer'?Number(left)-Number(right):String(left??'').localeCompare(String(right??''),'zh-CN');
      return sorting.order==='ASC'?result:-result;
    });
  }
  function tableHeader(type,key,scope) {
    const label=escape(fieldFor(type,key).label);
    if(!sortableKeys(type).includes(key))return `<th>${label}</th>`;
    const sorting=scope==='main'?sort:managerState.sort;
    const order=sorting?.key===key?sorting.order:null;
    const current=order==='ASC'?'升序':order==='DESC'?'降序':'未排序';
    const next=order==='ASC'?'降序':order==='DESC'?'取消排序':'升序';
    return `<th aria-sort="${order==='ASC'?'ascending':order==='DESC'?'descending':'none'}"><button class="sort-button" data-action="sort" data-scope="${scope}" data-key="${key}" aria-label="${label}，${current}，点击${next}" title="点击${next}">${label}<span class="sort-arrows" aria-hidden="true"><span class="${order==='ASC'?'active':''}">▴</span><span class="${order==='DESC'?'active':''}">▾</span></span></button></th>`;
  }
  function toggleSort(scope,key) {
    const type=scope==='main'?pageKey:managerState.type;
    if(!sortableKeys(type).includes(key))return;
    const current=scope==='main'?sort:managerState.sort;
    const next=current?.key!==key?{key,order:'ASC'}:current.order==='ASC'?{key,order:'DESC'}:null;
    if(scope==='main'){sort=next;page=1;selected.clear();renderList();}
    else {managerState.sort=next;managerState.page=1;managerState.selected.clear();renderManager();}
    document.querySelector(`[data-action="sort"][data-scope="${scope}"][data-key="${key}"]`)?.focus();
  }
  const labelOf = (type,row) => row ? (row[schema[type].name] || row[schema[type].code] || `记录 ${row.id}`) : '关联对象不存在';
  const choiceLabel = (type,row) => row ? `${labelOf(type,row)}${schema[type].code ? ` · ${row[schema[type].code]}` : ''}` : '请选择';
  const ownership = (type,row) => {
    const parent = schema[type].fields.find(f=>f.kind==='relation');
    return parent && row[parent.key] ? labelOf(parent.target,lookup(parent.target,row[parent.key])) : '—';
  };
  function notify(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,2500); }
  function openDialog(id) { const dialog=$(id); if(!dialog.open){focusOrigins.set(id,document.activeElement); dialog.showModal();} syncManagerLock(); }
  function closeDialog(id) {
    if(busy)return;
    if(id==='manager'&&managerHasChild())return;
    $(id).close(); focusOrigins.get(id)?.focus();
    if(id==='manager')managerState=null;
    if(id==='editor')editorState=null;
    if(id==='picker')pickerState=null;
    if(id==='confirmation')deletion=null;
    syncManagerLock();
  }
  function dialogHeader(id,title,subtitle='') {
    return `<header class="dialog-header"><div><h2 id="${id}Title">${escape(title)}</h2>${subtitle?`<p>${escape(subtitle)}</p>`:''}</div><button class="icon-button" data-action="close" data-dialog="${id}" aria-label="关闭">${icon('close')}</button></header>`;
  }
  const closeButton = id => `<button data-action="close" data-dialog="${id}">取消</button>`;
  function display(type,row,key) {
    const field=fieldFor(type,key), value=row[key];
    if(field.kind==='boolean')return `<span class="badge ${value?'':'off'}">${value?'启用':'停用'}</span>`;
    if(value===undefined || value===null || value==='')return '<span class="muted">—</span>';
    if(field.kind==='relation')return escape(labelOf(field.target,lookup(field.target,value)));
    if(field.kind==='enum')return `<span class="enum-tag">${escape(dictionaries[key][value] || value)}</span>`;
    return escape(value);
  }
  function canManageSlots(row) {
    const model=lookup('model',row.containerModelId);
    return model?.containerCategory==='VEHICLE_SLOT';
  }
  const hasBoxCapacity = row => row.containerCategory==='VEHICLE_SLOT';
  function table(type,rows,selection,scope) {
    const config=schema[type], extra=type==='location'||type==='container'||type==='line';
    const actionWidth=type==='container'?325:extra?255:165;
    const cols=config.columns.map(key=>{
      const field=fieldFor(type,key);
      return field.kind==='boolean'?90:field.kind==='datetime'?180:field.kind==='relation'?180:key==='remark'?200:field.kind==='enum'?160:160;
    });
    return `<table style="min-width:${42+actionWidth+cols.reduce((a,b)=>a+b,0)}px"><colgroup><col style="width:42px">${cols.map(w=>`<col style="width:${w}px">`).join('')}<col style="width:${actionWidth}px"></colgroup><thead><tr><th class="selection"><input type="checkbox" aria-label="全选当前页" data-select-all="${scope}" ${rows.length&&rows.every(r=>selection.has(r.id))?'checked':''} ${rows.length?'':'disabled'}></th>${config.columns.map(key=>tableHeader(type,key,scope)).join('')}<th class="actions">操作</th></tr></thead><tbody>${rows.map(row=>`<tr class="${selection.has(row.id)?'selected':''}"><td class="selection"><input type="checkbox" aria-label="选择${escape(labelOf(type,row))}" data-select-row="${scope}" value="${row.id}" ${selection.has(row.id)?'checked':''}></td>${config.columns.map(key=>`<td class="${key===config.code?'code':key===config.name?'name':key==='remark'?'truncate':''}" ${key==='remark'?`title="${escape(row[key])}"`:''}>${display(type,row,key)}</td>`).join('')}<td class="actions"><button class="link" data-action="detail" data-type="${type}" data-id="${row.id}">查看</button><button class="link" data-action="edit" data-type="${type}" data-id="${row.id}">编辑</button>${['location','line'].includes(type)?`<button class="link" data-action="relations" data-type="${type}" data-id="${row.id}">关联配置</button>`:''}${type==='container'&&canManageSlots(row)?`<button class="link" data-action="slots" data-id="${row.id}">装载位</button>`:''}${type==='container'&&window.RuntimeFixturePrototype?.canManage(row)?`<button class="link" data-fixture-action="open" data-id="${row.id}">适用订单</button>`:''}<button class="link danger-text" data-action="delete" data-type="${type}" data-id="${row.id}">删除</button></td></tr>`).join('')}</tbody></table>`;
  }
  function filteredRows() {
    return records[pageKey].filter(row=>{
      if(query.keyword && !schema[pageKey].fields.filter(f=>f.kind==='text').some(f=>String(row[f.key]||'').toLowerCase().includes(query.keyword.toLowerCase())))return false;
      return Object.entries(query).filter(([k,v])=>k!=='keyword'&&v!=='').every(([k,v])=>String(row[k])===String(v));
    });
  }
  function currentRows() { return sortRows(pageKey,filteredRows(),sort).slice((page-1)*size,page*size); }
  function renderFilters() {
    const query=filterDraft;
    $('filters').innerHTML=`<input name="keyword" aria-label="名称或编码" placeholder="请输入${schema[pageKey].label}名称或编码" value="${escape(query.keyword||'')}">${schema[pageKey].filters.map(key=>{
      const f=fieldFor(pageKey,key);
      if(f.kind==='relation')return `<div class="filter-reference"><button type="button" class="filter-related" data-action="filter-pick" data-key="${key}" aria-label="${f.label}"><span>${query[key]?escape(labelOf(f.target,lookup(f.target,query[key]))):`全部${f.label.replace('所属','')}`}</span>⌄</button>${clearReferenceButton(f,'filter',query[key])}</div>`;
      return `<select name="${key}" aria-label="${f.label}"><option value="">全部${f.label}</option>${Object.entries(dictionaries[key]).map(([v,l])=>`<option value="${v}" ${query[key]===v?'selected':''}>${l}</option>`).join('')}</select>`;
    }).join('')}<select name="enabled" aria-label="状态"><option value="">全部状态</option><option value="true" ${query.enabled==='true'?'selected':''}>启用</option><option value="false" ${query.enabled==='false'?'selected':''}>停用</option></select><div class="query-actions"><button class="primary" type="submit">查询</button><button type="button" data-action="reset">重置</button><button type="button" data-action="refresh">刷新</button></div>`;
  }
  function readFilters() { for(const el of $('filters').querySelectorAll('[name]'))filterDraft[el.name]=el.value.trim(); }
  function renderList() {
    const total=filteredRows().length; page=Math.max(1,Math.min(page,Math.ceil(total/size)||1));
    const rows=currentRows();
    const states={loading:['正在加载基础资料','请稍候'],empty:['暂无数据','请调整查询条件或新增资料'],failure:['数据加载失败','未能获取基础资料，请重试']};
    $('mainTable').innerHTML=states[scene]?tableState(scene,...states[scene],scene==='failure'?'<button data-action="retry">重试</button>':''):rows.length?table(pageKey,rows,selected,'main'):tableState('empty','暂无符合条件的数据','请调整查询条件','<button data-action="reset">重置查询</button>');
    $('selectionCount').textContent=selected.size?`已选 ${selected.size} 项`:'';
    $('batchDelete').disabled=!selected.size;
    $('pagination').innerHTML=`<span>共 ${scene==='empty'?0:total} 条</span><button data-action="prev" aria-label="上一页" ${page<=1?'disabled':''}>‹</button><span class="page-current">${page}</span><button data-action="next" aria-label="下一页" ${page*size>=total?'disabled':''}>›</button><select id="pageSize" aria-label="每页条数">${[5,10,20,50].map(n=>`<option ${size===n?'selected':''} value="${n}">${n} 条/页</option>`).join('')}</select>`;
    const all=$('mainTable').querySelector('[data-select-all]'); if(all)all.indeterminate=rows.some(r=>selected.has(r.id))&&!rows.every(r=>selected.has(r.id));
  }
  function navigate(key) {
    if(!menus.includes(key))return;
    pageKey=key; page=1; query={}; filterDraft={}; sort=null; selected.clear(); scene='normal'; $('scene').value='normal';
    $('breadcrumb').textContent=$('activeTab').textContent=$('pageTitle').textContent=schema[key].label;
    $('navigation').innerHTML=menus.map(k=>`<button class="nav-item ${k===key?'active':''}" data-action="navigate" data-key="${k}" ${k===key?'aria-current="page"':''}>${icon(schema[k].icon)}${schema[k].label}</button>`).join('');
    renderFilters(); renderList();
  }
  function managerRows() {
    const {type,id,query,sort}=managerState;
    return sortRows(type,records[type].filter(row=>row[schema[type].owner]===id&&Object.entries(query).every(([key,value])=>value===''||(key===schema[type].name?String(row[key]).toLowerCase().includes(value.toLowerCase()):String(row[key])===String(value)))),sort);
  }
  function managerCurrentRows() {
    const rows=managerRows(), {type,page,size}=managerState;
    return lineTabs.includes(type)?rows.slice((page-1)*size,page*size):rows;
  }
  function readManagerFilters() { for(const el of $('managerFilters')?.querySelectorAll('[name]')||[])managerState.draft[el.name]=el.value.trim(); }
  function managerFilters() {
    const {type,draft}=managerState, key=schema[type].name, field=fieldFor(type,'storageZoneId');
    return `<form id="managerFilters" class="filter-panel"><input name="${key}" aria-label="${fieldFor(type,key).label}" placeholder="请输入${fieldFor(type,key).label}" value="${escape(draft[key]||'')}">${field?`<div class="filter-reference"><button type="button" class="filter-related" data-action="manager-pick" data-key="storageZoneId" aria-label="配送存储区"><span>${draft.storageZoneId?escape(labelOf('storage',lookup('storage',draft.storageZoneId))):'全部配送存储区'}</span>⌄</button>${clearReferenceButton(field,'manager',draft.storageZoneId)}</div>`:''}<select name="enabled" aria-label="状态"><option value="">全部状态</option><option value="true" ${draft.enabled==='true'?'selected':''}>启用</option><option value="false" ${draft.enabled==='false'?'selected':''}>停用</option></select><div class="query-actions"><button type="submit" class="primary">查询</button><button type="button" data-action="manager-reset">重置</button><button type="button" data-action="manager-refresh">刷新</button></div></form>`;
  }
  function syncManagerLock() {
    if(!managerState)return;
    for(const el of $('manager').querySelectorAll('[data-action="close"],[data-action="manager-tab"]'))el.disabled=busy||managerHasChild();
  }
  function switchManagerTab(type) {
    if(managerHasChild()||!managerTabs().includes(type))return;
    Object.assign(managerState,{type,sort:null,page:1,query:{},draft:{}});managerState.selected.clear();renderManager();
  }
  function openManager(type,id) {
    if(type==='slot'&&!canManageSlots(lookup('container',id)))return;
    managerState={type,id,selected:new Set(),sort:null,page:1,size:20,query:{},draft:{}}; renderManager(); openDialog('manager');
  }
  function renderManager() {
    if(!managerState)return;
    const {type,id,selected:selection}=managerState, isLine=lineTabs.includes(type), owner=type==='slot'?'container':isLine?'line':'location', row=lookup(owner,id), total=managerRows().length;
    managerState.page=Math.max(1,Math.min(managerState.page,Math.ceil(total/managerState.size)||1));
    const rows=managerCurrentRows(), {page,size}=managerState;
    $('manager').innerHTML=dialogHeader('manager',type==='slot'?'料车装载位':isLine?'产线关联配置':'位置关联配置',choiceLabel(owner,row))+(type==='slot'?'':`<div class="manager-tabs" role="tablist" aria-label="${isLine?'产线':'位置'}关联类型">${managerTabs().map(t=>`<button role="tab" aria-selected="${type===t}" class="${type===t?'active':''}" data-action="manager-tab" data-key="${t}">${schema[t].label}</button>`).join('')}</div>`)+`<div class="dialog-body manager-content">${isLine?managerFilters():''}<div class="toolbar"><div class="manager-context">${type==='locationStorage'?'配置取料来源与配送目标，不改变位置的静态归属存储区':`所属${owner==='location'?'位置':isLine?'产线':'料车'}已固定`}<span>共 ${total} 条</span></div><div class="toolbar-actions"><button class="danger-text" data-action="manager-batch" ${selection.size?'':'disabled'}>批量删除${selection.size?` (${selection.size})`:''}</button><button class="primary" data-action="manager-create">${icon('plus')}新增</button></div></div><div class="table-scroll">${rows.length?table(type,rows,selection,'manager'):tableState('empty','暂无关联记录','请调整查询条件或新增配置')}</div>${isLine?`<div class="pagination">共 ${total} 条<button data-action="manager-prev" aria-label="上一页" ${page<=1?'disabled':''}>‹</button><span class="page-current">${page}</span><button data-action="manager-next" aria-label="下一页" ${page*size>=total?'disabled':''}>›</button><select id="managerPageSize" aria-label="每页条数">${[5,10,20,50].map(n=>`<option value="${n}" ${size===n?'selected':''}>${n} 条/页</option>`).join('')}</select></div>`:''}</div><footer class="dialog-footer"><button data-action="close" data-dialog="manager">关闭</button></footer>`;
    const all=$('manager').querySelector('[data-select-all]'); if(all)all.indeterminate=selection.size>0&&selection.size<rows.length;
    syncManagerLock();
  }
  function fieldMarkup(type,field,row,readonly) {
    const value=row[field.key]??'', id=`f-${field.key}`, locked=readonly||field.key===schema[type].owner;
    const required=field.required;
    let control;
    if(field.kind==='relation')control=`<div class="related-control"><button type="button" id="${id}" data-action="field-pick" data-key="${field.key}" ${locked?'disabled':''}><span>${value?escape(choiceLabel(field.target,lookup(field.target,value))):`请选择${field.label}`}</span>${icon('search')}</button>${locked?'':clearReferenceButton(field,'editor',value)}</div>`;
    else if(field.kind==='boolean')control=`<div class="switch-control"><input type="checkbox" role="switch" class="boolean-switch" id="${id}" ${value===true?'checked':''} ${locked?'disabled':''}><span class="switch-value" aria-hidden="true">${value===true?'启用':'停用'}</span></div>`;
    else if(field.kind==='enum')control=`<select id="${id}" ${locked?'disabled':''}><option value="">请选择${field.label}</option>${Object.entries(dictionaries[field.key]).map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('')}</select>`;
    else if(field.kind==='textarea')control=`<textarea id="${id}" maxlength="500" ${locked?'disabled':''}>${escape(value)}</textarea>`;
    else control=`<input id="${id}" value="${escape(value)}" ${['integer','positive'].includes(field.kind)?'inputmode="numeric"':'maxlength="128"'} ${locked?'disabled':''} placeholder="请输入${field.label}">`;
    return `<div class="field ${field.kind==='textarea'?'wide':''}" data-field="${field.key}"><label for="${id}">${required?'<span class="required">*</span>':''}${field.label}</label>${control}</div>`;
  }
  function openEditor(type,id=null,readonly=false) {
    const original=id?lookup(type,id):null;
    if(lineTabs.includes(type)&&(!managerState||managerState.type!==type||(id&&(!original||original.productionLineId!==managerState.id)))){notify('记录不属于当前产线，请刷新后重试');return;}
    const draft=original?{...original}:{enabled:true};
    if(schema[type].owner)draft[schema[type].owner]=managerState.id;
    editorState={type,id,draft,readonly,blocked:false};
    $('editor').innerHTML=dialogHeader('editor',`${readonly?'查看':id?'编辑':'新增'}${schema[type].label}`)+`<div class="dialog-body"><div id="formError" class="notice error" role="alert" hidden></div>${readonly?`<dl class="detail-grid">${schema[type].fields.map(f=>`<div class="${f.kind==='textarea'?'wide':''}"><dt>${f.label}</dt><dd>${display(type,draft,f.key)}</dd></div>`).join('')}<div><dt>创建时间</dt><dd>${escape(draft.createdTime)}</dd></div><div><dt>更新时间</dt><dd>${escape(draft.updatedTime)}</dd></div></dl>`:`<form id="editForm" class="form-grid">${schema[type].fields.map(f=>fieldMarkup(type,f,draft,false)).join('')}</form>`}</div><footer class="dialog-footer">${readonly?'<button data-action="close" data-dialog="editor">关闭</button>':`${closeButton('editor')}<button id="saveButton" class="primary" data-action="save">保存</button>`}</footer>`;
    if(!readonly)updateConditionalFields();
    openDialog('editor');
  }
  function readDraft() {
    if(!editorState || editorState.readonly)return;
    for(const field of schema[editorState.type].fields) {
      if(field.kind==='relation')continue;
      const control=$(`f-${field.key}`);
      if(control)editorState.draft[field.key]=field.kind==='boolean'?control.checked:control.value.trim();
    }
  }
  function updateConditionalFields() {
    if(editorState.type==='location'){syncStaticStorage();return;}
    if(editorState.type!=='model')return;
    document.querySelector('[data-field="boxCapacity"]').hidden=!hasBoxCapacity({containerCategory:$('f-containerCategory').value});
  }
  function syncStaticStorage(clear=false) {
    if(clear)editorState.draft.storageZoneId='';
    const {areaId,storageZoneId}=editorState.draft, trigger=$('f-storageZoneId');
    trigger.disabled=!areaId;
    trigger.title=areaId?'':'请先选择所属区域';
    trigger.querySelector('span').textContent=storageZoneId?choiceLabel('storage',lookup('storage',storageZoneId)):areaId?'请选择静态归属存储区':'请先选择所属区域';
    trigger.parentElement.querySelector('.clear-related').hidden=!storageZoneId;
  }
  function formError(message) { $('formError').textContent=message; $('formError').hidden=false; }
  function validateDraft() {
    const {type,draft}=editorState;
    for(const field of schema[type].fields) {
      if(document.querySelector(`[data-field="${field.key}"]`)?.hidden)continue;
      const value=draft[field.key], required=field.required;
      if(required&&(value===''||value===undefined||value===null))return `请填写${field.label}`;
      if(value!==''&&value!==undefined&&['positive','integer'].includes(field.kind)) {
        if(!/^-?\d+$/.test(String(value))||!Number.isInteger(Number(value))||Number(value)<-2147483648||Number(value)>2147483647||(field.kind==='positive'&&Number(value)<=0))return `${field.label}必须为${field.kind==='positive'?'正整数':'整数'}，且在接口整数范围内`;
      }
    }
    return '';
  }
  async function simulateWrite(button,callback) {
    if(busy)return;
    busy=true;
    const controls=[...document.querySelectorAll('dialog[open] button,dialog[open] input,dialog[open] select,dialog[open] textarea')].map(el=>[el,el.disabled]);
    for(const [el] of controls)el.disabled=true;
    button.classList.add('busy');
    try { await new Promise(resolve=>setTimeout(resolve,500)); callback(); }
    finally { busy=false; for(const [el,disabled] of controls)if(el.isConnected)el.disabled=disabled; button.classList.remove('busy'); if(editorState?.blocked&&$('saveButton'))$('saveButton').disabled=true; syncManagerLock(); }
  }
  async function save() {
    if(!editorState || editorState.readonly || editorState.blocked || busy)return;
    readDraft(); const error=validateDraft(); if(error){formError(error); return;}
    const state=editorState;
    await simulateWrite($('saveButton'),()=>{
      if(scene==='conflict'&&state.id){state.blocked=true;formError('数据已被其他操作修改或删除，请刷新后重试。已保留本次输入，请关闭后重新打开以获取最新数据。');return;}
      const saved={...state.draft};
      if(lineTabs.includes(state.type)&&!saved.remark){if(state.id)saved.remark=null;else delete saved.remark;}
      if(state.type==='model'&&!hasBoxCapacity(saved))delete saved.boxCapacity;
      for(const field of schema[state.type].fields)if(['integer','positive'].includes(field.kind)&&saved[field.key]!==undefined&&saved[field.key]!=='')saved[field.key]=Number(saved[field.key]);
      const time=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'});
      if(state.id)records[state.type][records[state.type].findIndex(r=>r.id===state.id)]={...saved,version:saved.version+1,updatedTime:time};
      else records[state.type].push({...saved,id:Math.max(0,...records[state.type].map(r=>r.id))+1,version:1,createdTime:time,updatedTime:time});
      $('editor').close(); editorState=null; focusOrigins.get('editor')?.focus(); renderList(); renderManager(); notify('已保存（原型演示）');
    });
  }
  function openPicker(type,key,source) {
    if(source==='editor')readDraft(); else if(source==='manager')readManagerFilters(); else readFilters();
    const scopedStorage=source==='editor'&&editorState.type==='location'&&key==='storageZoneId';
    const areaId=scopedStorage?editorState.draft.areaId:undefined;
    if(scopedStorage&&!areaId)return;
    const selectedId=Number(source==='editor'?editorState.draft[key]:source==='manager'?managerState.draft[key]:filterDraft[key]);
    pickerState={type,key,source,selectedId,areaId,page:1,keyword:''};
    const selectedIndex=pickerCandidates().findIndex(r=>r.id===selectedId);
    pickerState.page=selectedIndex<0?1:Math.floor(selectedIndex/5)+1;
    $('picker').innerHTML=dialogHeader('picker',`选择${schema[type].label}`)+`<div class="dialog-body"><form id="pickerFilters" class="filter-panel"><input id="pickerKeyword" aria-label="搜索名称或编码" placeholder="搜索名称或编码"><button class="primary" type="submit">查询</button></form><div id="pickerTable" class="table-scroll"></div><div id="pickerPages" class="pagination"></div></div><footer class="dialog-footer"><button data-action="close" data-dialog="picker">取消</button></footer>`;
    renderPickerRows(); openDialog('picker');
  }
  function pickerCandidates() {
    return records[pickerState.type].filter(row=>pickerState.areaId===undefined||row.areaId===Number(pickerState.areaId));
  }
  function renderPickerRows() {
    const {type,keyword}=pickerState;
    const matches=pickerCandidates().filter(r=>choiceLabel(type,r).toLowerCase().includes(keyword.toLowerCase()));
    pickerState.page=Math.min(pickerState.page,Math.ceil(matches.length/5)||1);
    $('pickerTable').innerHTML=`<table><thead><tr><th>名称 / 编码</th><th>归属信息</th><th style="width:80px">状态</th></tr></thead><tbody>${matches.slice((pickerState.page-1)*5,pickerState.page*5).map(r=>`<tr class="picker-row ${r.id===pickerState.selectedId?'selected':''}" data-action="choose" data-id="${r.id}" tabindex="0" aria-selected="${r.id===pickerState.selectedId}" aria-label="选择${escape(choiceLabel(type,r))}"><td><div class="name">${escape(labelOf(type,r))}${r.id===pickerState.selectedId?'<span class="picked-label">已选</span>':''}</div><small class="code">${escape(r[schema[type].code])}</small></td><td>${escape(ownership(type,r))}</td><td>${display(type,r,'enabled')}</td></tr>`).join('')}</tbody></table>${matches.length?'':tableState('empty','无匹配对象')}`;
    $('pickerPages').innerHTML=`共 ${matches.length} 条 <button data-action="picker-prev" ${pickerState.page<=1?'disabled':''}>上一页</button><span class="page-current">${pickerState.page}</span><button data-action="picker-next" ${pickerState.page*5>=matches.length?'disabled':''}>下一页</button>`;
  }
  function choose(id) {
    const {source,key,type}=pickerState;
    if(!pickerCandidates().some(row=>row.id===id))return;
    if(source==='editor') {
      const changed=Number(editorState.draft[key])!==id;
      editorState.draft[key]=id;
      $(`f-${key}`).querySelector('span').textContent=id?choiceLabel(type,lookup(type,id)):`请选择${fieldFor(editorState.type,key).label}`;
      $(`f-${key}`).parentElement.querySelector('.clear-related').hidden=!id;
      if(editorState.type==='location'&&key==='areaId')syncStaticStorage(changed);
    } else if(source==='manager'){managerState.draft[key]=id||'';renderManager();}
    else {filterDraft[key]=id||''; renderFilters();}
    closeDialog('picker');
  }
  function clearReference(key,source) {
    if(source==='editor') {
      if(editorState.readonly||key===schema[editorState.type].owner)return;
      readDraft();editorState.draft[key]='';
      const trigger=$(`f-${key}`);
      trigger.querySelector('span').textContent=`请选择${fieldFor(editorState.type,key).label}`;
      trigger.parentElement.querySelector('.clear-related').hidden=true;
      if(editorState.type==='location'&&key==='areaId')syncStaticStorage(true);
      trigger.focus();
    } else if(source==='manager') {
      readManagerFilters();managerState.draft[key]='';renderManager();
      $('manager').querySelector('[data-action="manager-pick"]').focus();
    } else {
      readFilters();filterDraft[key]='';renderFilters();
      $('filters').querySelector(`[data-action="filter-pick"][data-key="${key}"]`).focus();
    }
  }
  function requestDelete(type,ids) {
    if(!ids.length)return;
    deletion={type,ids:[...ids]};
    const row=lookup(type,ids[0]);
    $('confirmation').innerHTML=dialogHeader('confirmation','删除确认')+`<div class="dialog-body"><div id="deleteError" class="notice error" role="alert" hidden></div><p>${ids.length===1?`是否确认删除${schema[type].label}：${escape(labelOf(type,row))}`:`是否确认删除选中的 ${ids.length} 条${schema[type].label}？`}</p></div><footer class="dialog-footer">${closeButton('confirmation')}<button id="confirmDelete" class="danger" data-action="confirm-delete">确认删除</button></footer>`;
    openDialog('confirmation');
  }
  async function confirmDelete() {
    if(!deletion||busy)return;
    const {type,ids}=deletion;
    await simulateWrite($('confirmDelete'),()=>{
      if(scene==='reference'||scene==='conflict') {
        $('deleteError').textContent=scene==='conflict'?'数据已被其他操作修改或删除，请刷新后重试':'演示后端拒绝：该数据已被业务记录引用，无法删除。';
        $('deleteError').hidden=false; return;
      }
      records[type]=records[type].filter(r=>!ids.includes(r.id));
      selected.clear();managerState?.selected.clear();$('confirmation').close();deletion=null;
      focusOrigins.get('confirmation')?.focus();renderList();renderManager();notify('已删除（原型演示）');
    });
  }
  function setScene(value) {
    scene=value; selected.clear(); renderList();
    const row=currentRows()[0];
    if(value==='conflict'&&row)openEditor(pageKey,row.id);
    if(value==='reference'&&row)requestDelete(pageKey,[row.id]);
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');if(!el||el.disabled||busy)return;
    const {action,key,type,dialog}=el.dataset, id=Number(el.dataset.id);
    switch(action) {
      case 'navigate':navigate(key);break;
      case 'sort':toggleSort(el.dataset.scope,key);break;
      case 'create':openEditor(pageKey);break;
      case 'edit':openEditor(type,id);break;
      case 'detail':openEditor(type,id,true);break;
      case 'delete':requestDelete(type,[id]);break;
      case 'batch':requestDelete(pageKey,[...selected]);break;
      case 'confirm-delete':void confirmDelete();break;
      case 'relations':openManager(type==='line'?'resourceLine':'locationLine',id);break;
      case 'slots':openManager('slot',id);break;
      case 'manager-tab':switchManagerTab(key);break;
      case 'manager-pick':openPicker('storage','storageZoneId','manager');break;
      case 'manager-prev':managerState.page--;managerState.selected.clear();renderManager();break;
      case 'manager-next':managerState.page++;managerState.selected.clear();renderManager();break;
      case 'manager-reset':Object.assign(managerState,{query:{},draft:{},sort:null,page:1});managerState.selected.clear();renderManager();break;
      case 'manager-refresh':readManagerFilters();managerState.selected.clear();renderManager();notify('已刷新演示数据');break;
      case 'manager-create':openEditor(managerState.type);break;
      case 'manager-batch':requestDelete(managerState.type,[...managerState.selected]);break;
      case 'field-pick':openPicker(fieldFor(editorState.type,key).target,key,'editor');break;
      case 'filter-pick':openPicker(fieldFor(pageKey,key).target,key,'filter');break;
      case 'choose':choose(id);break;
      case 'clear-reference':clearReference(key,el.dataset.source);break;
      case 'picker-prev':pickerState.page--;renderPickerRows();break;
      case 'picker-next':pickerState.page++;renderPickerRows();break;
      case 'close':closeDialog(dialog);break;
      case 'save':void save();break;
      case 'prev':page--;selected.clear();renderList();break;
      case 'next':page++;selected.clear();renderList();break;
      case 'reset':query={};filterDraft={};sort=null;page=1;selected.clear();scene='normal';$('scene').value='normal';renderFilters();renderList();break;
      case 'retry':case 'refresh':scene='normal';$('scene').value='normal';selected.clear();renderList();notify('已刷新演示数据');break;
    }
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.matches('.boolean-switch'))el.nextElementSibling.textContent=el.checked?'启用':'停用';
    if(el.id==='scene')setScene(el.value);
    if(el.id==='pageSize'){size=Number(el.value);page=1;selected.clear();renderList();}
    if(el.id==='managerPageSize'){managerState.size=Number(el.value);managerState.page=1;managerState.selected.clear();renderManager();}
    if(el.id==='f-containerCategory')updateConditionalFields();
    if(el.dataset.selectRow||el.dataset.selectAll) {
      const scope=el.dataset.selectRow||el.dataset.selectAll, selection=scope==='main'?selected:managerState.selected;
      if(el.dataset.selectAll)for(const row of scope==='main'?currentRows():managerCurrentRows())el.checked?selection.add(row.id):selection.delete(row.id);
      else el.checked?selection.add(Number(el.value)):selection.delete(Number(el.value));
      scope==='main'?renderList():renderManager();
    }
  });
  document.addEventListener('submit',event=>{
    event.preventDefault();
    if(event.target.id==='filters'){readFilters();query={...filterDraft};page=1;selected.clear();renderList();}
    if(event.target.id==='managerFilters'){readManagerFilters();managerState.query={...managerState.draft};managerState.page=1;managerState.selected.clear();renderManager();}
    if(event.target.id==='pickerFilters'){pickerState.keyword=$('pickerKeyword').value.trim();pickerState.page=1;renderPickerRows();}
    if(event.target.id==='editForm')void save();
  });
  document.addEventListener('keydown',event=>{
    if(!busy&&event.target.matches('.picker-row')&&['Enter',' '].includes(event.key)) {
      event.preventDefault();choose(Number(event.target.dataset.id));return;
    }
    if(busy||managerHasChild()||!event.target.matches('[role="tab"]'))return;
    const activeTabs=managerTabs(), index=activeTabs.indexOf(managerState.type);
    const next={ArrowRight:(index+1)%activeTabs.length,ArrowLeft:(index+activeTabs.length-1)%activeTabs.length,Home:0,End:activeTabs.length-1}[event.key];
    if(next===undefined)return;
    event.preventDefault();switchManagerTab(activeTabs[next]);
    $('manager').querySelector('[aria-selected="true"]').focus();
  });
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog.id);});
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  navigate('factory');
  // Narrow test surface for local DOM checks; never used by the production app.
  window.BasicDataPrototype={navigate,openEditor,openManager,openPicker,choose,setScene,save,requestDelete,confirmDelete,closeDialog,canManageSlots,filteredRows,updateConditionalFields,getState:()=>({pageKey,selected,managerState,editorState,busy})};
})();
