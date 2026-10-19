;(() => {
  const { fields, pages, common, rows } = window.logisticsQueryData
  const standaloneKeys = ['task', 'operation', 'warehouse', 'receiving']
  const basic = window.basicData
  const $ = (id) => document.getElementById(id)
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    )
  const paths = {
    home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    truck:
      'M3 5h11v12H3zM14 9h4l3 4v4h-7M5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
    history: 'M3 12a9 9 0 1 0 2-6M3 3v5h5M12 7v5l3 2',
    warehouse: 'M3 21V8l9-5 9 5v13M7 21V11h10v10M7 15h10M7 18h10',
    box: 'm3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 5 9-5M12 12v9',
    receive: 'M4 3h16v18H4zM8 12l3 3 6-7',
    menu: 'M7 5h14M7 12h14M7 19h14M3 5h.01M3 12h.01M3 19h.01',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3',
    close: 'm5 5 14 14M19 5 5 19',
    back: 'm14 5-7 7 7 7M7 12h14',
    search: 'M17 17l5 5M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    loading: 'M12 3a9 9 0 1 1-9 9',
    empty: 'M4 5h16l2 10v5H2v-5L4 5zM2 15h6l2 3h4l2-3h6',
    failure: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M12 7v6M12 17h.01',
  }
  const icon = (name) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.grid}"/></svg>`
  const listState = (key, parentId) => ({
    type: 'list',
    key,
    parentId,
    query: {},
    draft: {},
    page: 1,
    size: 20,
    sort: { key: 'createdTime', order: 'DESC' },
    expanded: false,
    error: '',
  })
  let main = listState('task'),
    scene = 'normal',
    stack = [],
    picker = null,
    toastTimer
  const origins = new Map()
  const context = (scope) => (scope === 'viewer' ? stack.at(-1) : main)
  function openDialog(id) {
    if (!$(id).open) {
      origins.set(id, document.activeElement)
      $(id).showModal()
    }
  }
  function closeDialog(id) {
    $(id).close()
    if (id === 'viewer') stack = []
    if (id === 'picker') picker = null
    origins.get(id)?.focus()
  }
  function notify(message) {
    $('toast').textContent = message
    $('toast').hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => ($('toast').hidden = true), 2200)
  }
  function source(key) {
    const sourceRows = rows[key] || basic.records[key] || []
    if (scene !== 'unknown' || !pages[key]) return sourceRows
    return sourceRows.map((row) =>
      row.id !== 28
        ? row
        : {
            ...row,
            ...{
              task: { taskStatus: 'UNRECOGNIZED_STATUS', containerId: 999 },
              operation: { taskId: 999, evidenceSource: 'FUTURE_SOURCE' },
              warehouse: { objectId: 999 },
              warehouseBox: { boxId: 999, wmsCleanupStatus: 'NEW_STATUS' },
              receiving: { logisticsTaskId: 999 },
            }[key],
          },
    )
  }
  const find = (key, id) => source(key).find((row) => String(row.id) === String(id))
  function recordLabel(key, row) {
    if (!row) return ''
    if (pages[key])
      return key === 'warehouseBox'
        ? `箱明细 · ${row.orderNo || '无订单号'}`
        : String(row[pages[key].identity] ?? `ID ${row.id}`)
    const schema = basic.schema[key]
    return (
      [row[schema?.name], row[schema?.code]]
        .filter((v, i, all) => v && all.indexOf(v) === i)
        .join(' · ') || `ID ${row.id}`
    )
  }
  function value(fieldKey, raw, links = true) {
    const field = fields[fieldKey] || { label: fieldKey }
    if (raw === null || raw === undefined || raw === '') return '<span class="muted">—</span>'
    if (field.target) {
      const row = find(field.target, raw),
        label = row ? recordLabel(field.target, row) : `ID ${raw} · 关联信息不可用`
      return links
        ? `<button type="button" class="link record-link" data-action="detail" data-target="${field.target}" data-id="${escape(raw)}" title="${escape(label)}">${escape(label)}</button>`
        : escape(label)
    }
    if (field.options) {
      const entry = field.options[raw]
      return `<span class="runtime-tag ${entry?.[1] || 'neutral'}" title="${escape(raw)}">${escape(entry?.[0] || raw)}</span>`
    }
    return `<span class="cell-text" title="${escape(raw)}">${escape(raw)}</span>`
  }
  function fieldControl(key, ctx, scope) {
    if (key.endsWith('Range')) {
      const base = key.slice(0, -5),
        label = fields[base].label
      return `<div class="date-range"><span class="date-name">${label}</span><label><span class="sr-only" hidden>${label}开始</span><input type="datetime-local" name="${base}Start" aria-label="${label}开始" value="${escape(ctx.draft[base + 'Start'])}"></label><span class="muted">—</span><input type="datetime-local" name="${base}End" aria-label="${label}结束" value="${escape(ctx.draft[base + 'End'])}"></div>`
    }
    const field = fields[key],
      raw = ctx.draft[key] ?? ''
    if (field.target) {
      const label = raw
        ? recordLabel(field.target, find(field.target, raw)) || `ID ${raw}`
        : `选择${field.label}`
      return `<div class="query-control reference"><button type="button" data-action="pick" data-field="${key}" data-scope="${scope}" aria-label="选择${field.label}"><span class="reference-label">${escape(label)}</span>${icon('search')}</button>${raw !== '' ? `<button type="button" class="clear-related" data-action="clear" data-field="${key}" data-scope="${scope}" aria-label="清除${field.label}">${icon('close')}</button>` : ''}</div>`
    }
    if (field.options)
      return `<div class="query-control"><select name="${key}" aria-label="${field.label}"><option value="">全部${field.label}</option>${Object.entries(
        field.options,
      )
        .map(
          ([code, [label]]) =>
            `<option value="${code}" ${String(raw) === code ? 'selected' : ''}>${label}</option>`,
        )
        .join('')}</select></div>`
    return `<div class="query-control"><input name="${key}" aria-label="${field.label}" placeholder="${field.label}" ${field.number ? 'type="number" step="1" min="0"' : 'type="text"'} value="${escape(raw)}"></div>`
  }
  function filterHTML(ctx, scope) {
    const config = pages[ctx.key],
      extra = config.more.filter((key) => !(ctx.parentId && key === 'warehouseRecordId'))
    const count = extra.reduce(
      (n, key) =>
        n +
        (key.endsWith('Range')
          ? Boolean(ctx.draft[key.slice(0, -5) + 'Start'] || ctx.draft[key.slice(0, -5) + 'End'])
          : Boolean(ctx.draft[key])),
      0,
    )
    return `<div class="query-fields">${config.filters.map((key) => fieldControl(key, ctx, scope)).join('')}<div class="query-actions"><button type="button" class="link" data-action="expand" data-scope="${scope}" aria-expanded="${ctx.expanded}">${ctx.expanded ? '收起' : '更多条件'}${count ? ` (${count})` : ''}</button><button class="primary" type="submit">查询</button><button type="button" data-action="reset" data-scope="${scope}">重置</button><button type="button" data-action="refresh" data-scope="${scope}">刷新</button></div></div><div class="advanced-fields" ${ctx.expanded ? '' : 'hidden'}><div class="query-fields">${extra.map((key) => fieldControl(key, ctx, scope)).join('')}</div></div>${ctx.error ? `<p role="alert" class="filter-error">${escape(ctx.error)}</p>` : ''}`
  }
  function filtered(ctx = main) {
    let result = source(ctx.key).filter(
      (row) => !ctx.parentId || String(row.warehouseRecordId) === String(ctx.parentId),
    )
    result = result.filter((row) =>
      Object.entries(ctx.query).every(([key, input]) => {
        if (input === '') return true
        const range = key.endsWith('Start') ? 'Start' : key.endsWith('End') ? 'End' : null
        if (range) {
          const raw = row[key.slice(0, -range.length)]
          if (!raw) return false
          const bound = input.replace('T', ' ') + (input.length === 16 ? ':00' : '')
          return range === 'Start' ? raw >= bound : raw <= bound
        }
        const field = fields[key]
        if (field.number || field.options) return String(row[key] ?? '') === String(input)
        return String(row[key] ?? '')
          .toLowerCase()
          .includes(String(input).toLowerCase())
      }),
    )
    if (ctx.sort)
      result.sort((a, b) => {
        const key = ctx.sort.key,
          x = a[key],
          y = b[key]
        const compare = fields[key].number
          ? Number(x) - Number(y)
          : String(x ?? '').localeCompare(String(y ?? ''))
        return compare * (ctx.sort.order === 'ASC' ? 1 : -1)
      })
    return result
  }
  function stateHTML(kind, text, scope) {
    return `<div class="empty-state state-${kind}" role="${kind === 'failure' ? 'alert' : 'status'}"><span class="state-symbol">${icon(kind)}</span><strong>${text}</strong>${kind === 'failure' ? `<p>演示请求失败，原查询条件已保留。</p><button type="button" data-action="retry" data-scope="${scope}">重新加载</button>` : ''}</div>`
  }
  function tableHTML(ctx, scope) {
    if (['loading', 'empty', 'failure'].includes(scene))
      return stateHTML(
        scene,
        { loading: '正在加载记录', empty: '暂无符合条件的记录', failure: '记录加载失败' }[scene],
        scope,
      )
    const config = pages[ctx.key],
      result = filtered(ctx)
    ctx.page = Math.max(1, Math.min(ctx.page, Math.ceil(result.length / ctx.size) || 1))
    if (!result.length) return stateHTML('empty', '暂无符合条件的记录', scope)
    const cols = config.columns.filter((key) => !(ctx.parentId && key === 'warehouseRecordId'))
    const width = (key) =>
      fields[key].time
        ? 172
        : fields[key].target
          ? 210
          : ['quantity', 'queueNo', 'objectId'].includes(key)
            ? 100
            : key === 'reason'
              ? 240
              : 180
    return `<table class="logistics-table" style="min-width:${cols.reduce((sum, key) => sum + width(key), ctx.key === 'warehouse' ? 148 : 82)}px"><colgroup>${cols.map((key) => `<col style="width:${width(key)}px">`).join('')}<col style="width:${ctx.key === 'warehouse' ? 148 : 82}px"></colgroup><thead><tr>${cols.map((key) => `<th ${config.sort.includes(key) ? `aria-sort="${ctx.sort?.key === key ? (ctx.sort.order === 'ASC' ? 'ascending' : 'descending') : 'none'}"` : ''}>${config.sort.includes(key) ? `<button class="sort-button" data-action="sort" data-scope="${scope}" data-field="${key}">${fields[key].label}<span class="sort-arrows" aria-hidden="true"><span class="${ctx.sort?.key === key && ctx.sort.order === 'ASC' ? 'active' : ''}">▴</span><span class="${ctx.sort?.key === key && ctx.sort.order === 'DESC' ? 'active' : ''}">▾</span></span></button>` : fields[key].label}</th>`).join('')}<th class="actions">操作</th></tr></thead><tbody>${result
      .slice((ctx.page - 1) * ctx.size, ctx.page * ctx.size)
      .map(
        (row) =>
          `<tr data-id="${row.id}">${cols.map((key) => `<td>${key === config.identity ? `<button class="link record-link" data-action="detail" data-target="${ctx.key}" data-id="${row.id}">${escape(row[key])}</button>` : value(key, row[key])}</td>`).join('')}<td class="actions"><button class="link" data-action="detail" data-target="${ctx.key}" data-id="${row.id}">查看</button>${ctx.key === 'warehouse' ? `<button class="link" data-action="boxes" data-id="${row.id}">箱明细</button>` : ''}</td></tr>`,
      )
      .join('')}</tbody></table>`
  }
  function paginationHTML(ctx, scope) {
    if (['loading', 'failure'].includes(scene)) return '<span class="muted">总数待确认</span>'
    const total = scene === 'empty' ? 0 : filtered(ctx).length,
      pagesCount = Math.max(1, Math.ceil(total / ctx.size))
    return `<span>共 ${total} 条</span><button data-action="prev" data-scope="${scope}" aria-label="上一页" ${ctx.page <= 1 ? 'disabled' : ''}>‹</button><span class="page-current">${ctx.page}</span><span class="muted">/ ${pagesCount}</span><button data-action="next" data-scope="${scope}" aria-label="下一页" ${ctx.page >= pagesCount ? 'disabled' : ''}>›</button><select data-page-size="${scope}" aria-label="每页条数">${[10, 20, 50, 100].map((n) => `<option value="${n}" ${ctx.size === n ? 'selected' : ''}>${n} 条/页</option>`).join('')}</select>`
  }
  function renderMain() {
    const config = pages[main.key]
    $('navigation').innerHTML = standaloneKeys
      .map((key) => {
        const p = pages[key]
        return `<button class="nav-item ${main.key === key ? 'active' : ''}" data-action="navigate" data-target="${key}" ${main.key === key ? 'aria-current="page"' : ''}>${icon(p.icon)}${p.name}</button>`
      })
      .join('')
    $('breadcrumb').textContent =
      $('activeTab').textContent =
      $('pageTitle').textContent =
        config.name
    $('tabIcon').innerHTML = icon(config.icon)
    $('filters').innerHTML = filterHTML(main, 'main')
    $('mainTable').innerHTML = tableHTML(main, 'main')
    $('pagination').innerHTML = paginationHTML(main, 'main')
  }
  function grid(keys, row) {
    return `<dl class="detail-grid">${keys.map((key) => `<div><dt>${escape(fields[key]?.label || key)}</dt><dd>${value(key, row[key])}</dd></div>`).join('')}</dl>`
  }
  function snapshot(key, raw) {
    let formatted = raw
    if (raw !== null && raw !== undefined && raw !== '') {
      try {
        formatted = JSON.stringify(JSON.parse(raw), null, 2)
      } catch {
        /* Non-JSON snapshots stay plain text. */
      }
    }
    return `<details class="snapshot"><summary>${fields[key].label}</summary><pre>${escape(formatted === null || formatted === undefined || formatted === '' ? '—' : formatted)}</pre></details>`
  }
  function renderViewer() {
    const ctx = stack.at(-1)
    if (!ctx) return
    const config = pages[ctx.key],
      row = ctx.type === 'detail' ? find(ctx.key, ctx.id) : null
    const name = config?.name || basic.schema[ctx.key]?.label || '关联对象'
    let content,
      title = ctx.type === 'list' ? '缴库成功箱明细' : `${name}详情`,
      subtitle =
        ctx.type === 'list'
          ? `所属缴库申请：${recordLabel('warehouse', find('warehouse', ctx.parentId)) || ctx.parentId}`
          : row
            ? recordLabel(ctx.key, row)
            : `ID ${ctx.id}`
    if (ctx.type === 'list')
      content = `<form id="childFilters" class="child-filters runtime-filters" aria-label="箱明细查询条件">${filterHTML(ctx, 'viewer')}</form><div class="view-table-wrap">${tableHTML(ctx, 'viewer')}</div><div class="pagination child-pagination">${paginationHTML(ctx, 'viewer')}</div>`
    else if (ctx.failed) content = stateHTML('failure', '详情加载失败', 'viewer-detail')
    else if (!row)
      content = `<div class="empty-state state-empty"><span class="state-symbol">${icon('empty')}</span><strong>关联记录不存在或暂不可用</strong><p>保留原始 ID：${escape(ctx.id)}，可返回继续查看。</p></div>`
    else if (config)
      content = `<section class="detail-section"><h3>业务信息</h3>${grid(config.details, row)}${ctx.key === 'warehouse' ? `<button class="link" data-action="boxes" data-id="${row.id}">查看所属箱明细</button>` : ''}</section>${config.snapshots.map((key) => snapshot(key, row[key])).join('')}<details class="snapshot"><summary>追溯信息</summary>${grid([...common, ...config.technical], row)}</details>`
    else {
      const schema = basic.schema[ctx.key]
      content = `<section class="detail-section"><h3>关联对象信息</h3><dl class="detail-grid">${[
        ...new Set([schema.code, schema.name, 'createdTime', 'updatedTime']),
      ]
        .filter(Boolean)
        .map(
          (key) =>
            `<div><dt>${escape(fields[key]?.label || schema.fields.find((field) => field.key === key)?.label || key)}</dt><dd>${escape(row[key] ?? '—')}</dd></div>`,
        )
        .join('')}</dl></section>`
    }
    $('viewer').classList.toggle('large-dialog', ctx.type === 'list')
    $('viewer').innerHTML =
      `<div class="dialog-header"><div class="viewer-heading">${stack.length > 1 ? `<button class="icon-button" data-action="back" aria-label="返回">${icon('back')}</button>` : ''}<div><h2 id="viewerTitle">${escape(title)}</h2><p>${escape(subtitle)}</p></div></div><button class="icon-button" data-action="close" data-dialog="viewer" aria-label="关闭">${icon('close')}</button></div><div class="dialog-body">${content}</div><div class="dialog-footer">${stack.length > 1 ? '<button data-action="back">返回</button>' : ''}<button data-action="close" data-dialog="viewer">关闭</button></div>`
    openDialog('viewer')
    $('viewer').querySelector('.dialog-header button')?.focus()
  }
  function showDetail(key, id) {
    stack.push({ type: 'detail', key, id, failed: scene === 'detail-failure' })
    renderViewer()
  }
  function showBoxes(id) {
    stack.push(listState('warehouseBox', id))
    renderViewer()
  }
  function renderContext(scope) {
    if (scope === 'viewer') renderViewer()
    else renderMain()
  }
  function navigate(key) {
    if (key === 'warehouseBox') key = 'warehouse'
    if (!standaloneKeys.includes(key)) key = 'task'
    main = listState(key)
    scene = 'normal'
    $('scene').value = scene
    if ($('viewer').open) closeDialog('viewer')
    if ($('picker').open) closeDialog('picker')
    history.replaceState(null, '', `#${key}`)
    renderMain()
  }
  function query(ctx, scope) {
    ctx.error = ''
    for (const [key, input] of Object.entries(ctx.draft)) {
      if (
        key.endsWith('Start') &&
        input &&
        ctx.draft[key.replace(/Start$/, 'End')] &&
        input > ctx.draft[key.replace(/Start$/, 'End')]
      )
        ctx.error = '开始时间不能晚于结束时间'
      if (
        input !== '' &&
        fields[key]?.number &&
        (!Number.isSafeInteger(Number(input)) || Number(input) < 0)
      )
        ctx.error = '数字条件请输入非负整数'
    }
    if (!ctx.error) {
      ctx.query = { ...ctx.draft }
      ctx.page = 1
    }
    renderContext(scope)
  }
  function sortBy(ctx, key) {
    if (!pages[ctx.key].sort.includes(key)) return
    ctx.sort =
      ctx.sort?.key !== key
        ? { key, order: 'ASC' }
        : ctx.sort.order === 'ASC'
          ? { key, order: 'DESC' }
          : null
    ctx.page = 1
  }
  function showPicker(field, scope) {
    const target = fields[field].target,
      current = context(scope).draft[field],
      index = source(target).findIndex((row) => String(row.id) === String(current))
    picker = { field, scope, target, query: '', page: index < 0 ? 1 : Math.floor(index / 5) + 1 }
    renderPicker()
  }
  function renderPicker() {
    const ctx = context(picker.scope),
      current = ctx.draft[picker.field],
      target = picker.target
    const result = source(target).filter((row) =>
      `${recordLabel(target, row)} ${row.id}`.toLowerCase().includes(picker.query.toLowerCase()),
    )
    const totalPages = Math.max(1, Math.ceil(result.length / 5))
    picker.page = Math.min(picker.page, totalPages)
    $('picker').innerHTML =
      `<div class="dialog-header"><h2 id="pickerTitle">选择${fields[picker.field].label}</h2><button class="icon-button" data-action="close" data-dialog="picker" aria-label="关闭">${icon('close')}</button></div><div class="dialog-body"><form id="pickerSearch" class="picker-search"><input name="search" aria-label="搜索名称、编码或编号" placeholder="搜索名称、编码或编号" value="${escape(picker.query)}"><button class="primary">查询</button></form>${current ? `<div class="reference-current">当前已选：${escape(recordLabel(target, find(target, current)) || `ID ${current}`)}<span class="picked-label">已选</span></div>` : ''}<div class="table-scroll"><table><thead><tr><th>名称 / 编码 / 编号</th></tr></thead><tbody>${result
        .slice((picker.page - 1) * 5, picker.page * 5)
        .map(
          (row) =>
            `<tr class="picker-row" tabindex="0" aria-selected="${String(row.id) === String(current)}" data-action="choose" data-id="${row.id}"><td>${escape(recordLabel(target, row))}${String(row.id) === String(current) ? '<span class="picked-label">已选</span>' : ''}</td></tr>`,
        )
        .join(
          '',
        )}</tbody></table>${result.length ? '' : stateHTML('empty', '暂无符合条件的候选', 'picker')}</div><div class="pagination"><span>共 ${result.length} 条</span><button data-action="picker-prev" ${picker.page <= 1 ? 'disabled' : ''}>‹</button><span class="page-current">${picker.page}</span><button data-action="picker-next" ${picker.page >= totalPages ? 'disabled' : ''}>›</button></div></div><div class="dialog-footer"><button data-action="close" data-dialog="picker">取消</button></div>`
    openDialog('picker')
  }
  function choose(id) {
    const scope = picker.scope
    context(scope).draft[picker.field] = Number(id)
    closeDialog('picker')
    renderContext(scope)
    document.querySelector(`[data-action="pick"][data-scope="${scope}"]`)?.focus()
  }
  document.addEventListener('input', (event) => {
    const form = event.target.closest('form')
    if (!form || !['filters', 'childFilters'].includes(form.id) || !event.target.name) return
    context(form.id === 'filters' ? 'main' : 'viewer').draft[event.target.name] = event.target.value
  })
  document.addEventListener('change', (event) => {
    if (event.target.id === 'scene') {
      scene = event.target.value
      renderMain()
      return
    }
    if (event.target.dataset.pageSize) {
      const scope = event.target.dataset.pageSize,
        ctx = context(scope)
      ctx.size = Number(event.target.value)
      ctx.page = 1
      renderContext(scope)
      return
    }
    if (event.target.name) event.target.dispatchEvent(new Event('input', { bubbles: true }))
  })
  document.addEventListener('submit', (event) => {
    event.preventDefault()
    if (event.target.id === 'pickerSearch') {
      picker.query = event.target.elements.search.value.trim()
      picker.page = 1
      renderPicker()
      return
    }
    const scope = event.target.id === 'childFilters' ? 'viewer' : 'main'
    query(context(scope), scope)
  })
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]')
    if (!button || button.disabled) return
    const { action, target, id, field, dialog } = button.dataset,
      scope = button.dataset.scope || 'main',
      ctx = context(scope)
    if (action === 'navigate') return navigate(target)
    if (action === 'detail') return showDetail(target, id)
    if (action === 'boxes') return showBoxes(id)
    if (action === 'back') {
      stack.pop()
      return renderViewer()
    }
    if (action === 'close') return closeDialog(dialog)
    if (action === 'pick') return showPicker(field, scope)
    if (action === 'choose') return choose(id)
    if (action === 'picker-prev' || action === 'picker-next') {
      picker.page += action === 'picker-prev' ? -1 : 1
      return renderPicker()
    }
    if (action === 'clear') {
      ctx.draft[field] = ''
      renderContext(scope)
      return
    }
    if (action === 'retry' && scope === 'viewer-detail') {
      stack.at(-1).failed = false
      return renderViewer()
    }
    if (action === 'expand') ctx.expanded = !ctx.expanded
    if (action === 'reset') Object.assign(ctx, listState(ctx.key, ctx.parentId))
    if (action === 'sort') sortBy(ctx, field)
    if (action === 'prev' || action === 'next') ctx.page += action === 'prev' ? -1 : 1
    if (action === 'refresh' || action === 'retry') {
      scene = 'normal'
      $('scene').value = scene
      notify('已按已应用条件刷新（演示）')
    }
    renderContext(scope)
    if (action === 'sort')
      document
        .querySelector(`[data-action="sort"][data-scope="${scope}"][data-field="${field}"]`)
        ?.focus()
  })
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('.picker-row') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault()
      choose(event.target.dataset.id)
    }
  })
  ;['viewer', 'picker'].forEach((id) =>
    $(id).addEventListener('cancel', (event) => {
      event.preventDefault()
      closeDialog(id)
    }),
  )
  document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)))
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)))
  navigate(location.hash.slice(1) || 'task')
  window.LogisticsQueryPrototype = {
    navigate,
    filtered,
    showDetail,
    showBoxes,
    closeDialog,
    showPicker,
    choose,
    sortBy,
    getState: () => ({ main, scene, stack, picker }),
    setScene: (value) => {
      scene = value
      $('scene').value = value
      renderMain()
    },
  }
})()
