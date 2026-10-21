// Local DOM checks only; does not launch a browser or call the backend.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Window } from 'happy-dom'

const window = new Window()
const document = window.document
const get = (id) => document.getElementById(id)
const click = (selector) => {
  const element = document.querySelector(selector)
  assert.ok(element, selector)
  element.click()
}
const change = (id, value) => {
  get(id).value = value
  get(id).dispatchEvent(new window.Event('change', { bubbles: true }))
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 550))
try {
  document.write(
    readFileSync(new URL('./index.html', import.meta.url), 'utf8').replace(
      /<script[^>]*>[\s\S]*?<\/script>/g,
      '',
    ),
  )
  const style = document.createElement('style')
  style.textContent = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
  document.head.append(style)
  for (const file of ['data.js', 'prototype.js'])
    window.eval(readFileSync(new URL(file, import.meta.url), 'utf8'))
  const app = window.BasicDataPrototype,
    data = window.basicData
  assert.equal(Object.keys(data.schema).length, 15)
  assert.equal(document.querySelectorAll('.nav-item').length, 8)
  assert.equal(get('pageTitle').textContent, '工厂')
  assert.equal(get('mainTable').querySelectorAll('tbody tr').length, 3)
  assert.ok(!get('mainTable').querySelector('select'), 'No inline status switch')

  // Every object's CRUD form follows the request schema and remains accessible.
  const api = JSON.parse(
    readFileSync(new URL('../../nari-logistics.openapi.json', import.meta.url), 'utf8'),
  )
  const names = {
    factory: 'Factory',
    floor: 'Floor',
    area: 'Area',
    line: 'ProductionLine',
    storage: 'StorageZone',
    location: 'Location',
    model: 'ContainerModel',
    container: 'Container',
    locationLine: 'LocationLine',
    locationModel: 'LocationContainerModel',
    locationUsage: 'LocationUsage',
    locationStorage: 'LocationStorageZone',
    slot: 'VehicleSlot',
    resourceLine: 'ResourceLine',
    lineProcessStorage: 'LineProcessStorageZone',
  }
  // Sort affordances exactly match visible fields allowed by each V9 query.
  for (const [type, name] of Object.entries(names)) {
    const allowed = api.components.schemas[`Nari${name}Query`].properties.sortBy.description
      .split('支持：')[1]
      .split('、')
    if (data.schema[type].owner) app.openManager(type, 1)
    else app.navigate(type)
    const root = get(data.schema[type].owner ? 'manager' : 'mainTable')
    assert.deepEqual(
      Array.from(root.querySelectorAll('[data-action="sort"]'), (el) => el.dataset.key),
      Array.from(data.schema[type].columns).filter((key) => allowed.includes(key)),
      type,
    )
    if (!data.schema[type].owner) {
      assert.deepEqual(Array.from(data.schema[type].columns).slice(-2), [
        'createdTime',
        'updatedTime',
      ])
      assert.deepEqual(
        Array.from(root.querySelectorAll('thead th'))
          .slice(-3)
          .map((el) => el.textContent.replace(/[▴▾]/g, '')),
        ['创建时间', '更新时间', '操作'],
      )
      const cells = root.querySelector('tbody tr').cells
      assert.equal(cells[cells.length - 3].textContent, data.records[type][0].createdTime)
      assert.equal(cells[cells.length - 2].textContent, data.records[type][0].updatedTime)
    } else if (!['resourceLine', 'lineProcessStorage'].includes(type))
      assert.ok(
        !data.schema[type].columns.includes('createdTime'),
        'Original embedded tables unchanged',
      )
    if (data.schema[type].owner) app.closeDialog('manager')
  }
  const mainCodes = () =>
    Array.from(get('mainTable').querySelectorAll('tbody .code'), (el) => el.textContent)
  const sortBy = (key, scope = 'main') =>
    click(`[data-action="sort"][data-scope="${scope}"][data-key="${key}"]`)
  app.navigate('factory')
  const originalCodes = mainCodes()
  sortBy('factoryCode')
  assert.deepEqual(mainCodes(), ['NR-CZ', 'NR-NJ', 'NR-TEST'])
  assert.equal(
    get('mainTable').querySelector('[aria-sort="ascending"] button').dataset.key,
    'factoryCode',
  )
  assert.equal(document.activeElement.dataset.key, 'factoryCode', 'Focus survives header rerender')
  sortBy('factoryCode')
  assert.deepEqual(mainCodes(), ['NR-TEST', 'NR-NJ', 'NR-CZ'])
  sortBy('factoryCode')
  assert.deepEqual(mainCodes(), originalCodes, 'Cancel restores demo source order')
  assert.deepEqual(
    Array.from(data.records.factory, (r) => r.factoryCode),
    originalCodes,
    'Sorting does not mutate source records',
  )
  sortBy('factoryCode')
  sortBy('factoryName')
  assert.equal(
    get('mainTable').querySelectorAll('[aria-sort="ascending"]').length,
    1,
    'Single field only',
  )
  assert.equal(
    get('mainTable')
      .querySelector('[data-key="factoryCode"]')
      .parentElement.getAttribute('aria-sort'),
    'none',
  )
  click('[data-action="reset"]')
  assert.equal(get('mainTable').querySelector('[aria-sort="ascending"]'), null)

  for (const key of ['createdTime', 'updatedTime']) {
    const original = data.records.factory.map((row) => row[key])
    ;['2026-10-12 08:30:00', '2026-10-13 00:00:00', '2026-09-30 23:59:59'].forEach(
      (value, i) => (data.records.factory[i][key] = value),
    )
    sortBy(key)
    assert.deepEqual(
      mainCodes(),
      [originalCodes[2], originalCodes[0], originalCodes[1]],
      `${key} ascending`,
    )
    sortBy(key)
    assert.deepEqual(
      mainCodes(),
      [originalCodes[1], originalCodes[0], originalCodes[2]],
      `${key} descending`,
    )
    sortBy(key)
    assert.deepEqual(mainCodes(), originalCodes)
    original.forEach((value, i) => (data.records.factory[i][key] = value))
  }

  app.navigate('floor')
  const originalNumber = data.records.floor[0].floorNumber
  data.records.floor[0].floorNumber = 10
  sortBy('floorNumber')
  assert.deepEqual(mainCodes(), ['CZ-B-1F', 'NJ-A-2F', 'NJ-A-1F'], 'Numbers compare numerically')
  data.records.floor[0].floorNumber = originalNumber
  app.navigate('line')
  change('pageSize', '5')
  click('[data-action="next"]')
  get('mainTable').querySelector('[data-select-row]').click()
  assert.equal(app.getState().selected.size, 1)
  sortBy('lineCode')
  assert.equal(get('pagination').querySelector('.page-current').textContent, '1')
  assert.equal(app.getState().selected.size, 0)
  assert.deepEqual(
    mainCodes(),
    ['DEBUG-01', 'MANUAL-01', 'SELECT-01', 'SMT-01', 'SMT-02'],
    'Sort full result before slicing page',
  )
  click('[data-action="next"]')
  assert.deepEqual(mainCodes(), ['WAVE-01'])
  sortBy('lineCode')
  assert.equal(mainCodes()[0], 'WAVE-01')
  click('[data-action="refresh"]')
  assert.equal(mainCodes()[0], 'WAVE-01', 'Refresh preserves sorting')
  get('filters').querySelector('[name="keyword"]').value = 'SMT'
  get('filters').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  assert.deepEqual(mainCodes(), ['SMT-02', 'SMT-01'], 'Query retains sorting')
  click('[data-action="reset"]')
  assert.equal(get('mainTable').querySelector('[aria-sort="descending"]'), null)
  change('pageSize', '20')

  app.openManager('slot', 1)
  sortBy('slotCode', 'manager')
  sortBy('slotCode', 'manager')
  assert.equal(get('manager').querySelector('tbody .code').textContent, 'CART-0001-04')
  assert.equal(
    get('manager').querySelectorAll('tbody tr').length,
    4,
    'Manager sort retains owner scope',
  )
  app.closeDialog('manager')
  app.openManager('slot', 1)
  assert.equal(
    get('manager').querySelector('[aria-sort="descending"]'),
    null,
    'Reopen resets manager sorting',
  )
  app.closeDialog('manager')
  app.navigate('factory')

  for (const [type, name] of Object.entries(names)) {
    assert.deepEqual(
      Array.from(data.schema[type].fields, (f) => f.key).sort(),
      Object.keys(api.components.schemas[`Nari${name}Request`].properties)
        .filter((k) => k !== 'version')
        .sort(),
    )
    if (data.schema[type].owner) app.openManager(type, 1)
    else app.navigate(type)
    app.openEditor(type, 1)
    assert.equal(get('f-createdTime'), null, 'Creation timestamp is read-only metadata')
    assert.equal(get('f-updatedTime'), null, 'Update timestamp is read-only metadata')
    for (const field of data.schema[type].fields)
      assert.ok(get(`f-${field.key}`), `${type}.${field.key}`)
    assert.equal(
      get('f-enabled').getAttribute('role'),
      'switch',
      `${type} edits booleans with a switch`,
    )
    assert.equal(get('f-enabled').type, 'checkbox')
    assert.equal(get('f-enabled').checked, data.records[type][0].enabled)
    if (data.schema[type].owner) assert.ok(get(`f-${data.schema[type].owner}`).disabled)
    app.closeDialog('editor')
    app.openEditor(type, 1, true)
    assert.equal(get('saveButton'), null, 'Read-only detail cannot submit')
    app.closeDialog('editor')
    if (get('manager').open) app.closeDialog('manager')
  }

  // Production-line association tabs use only local fixtures and keep the owner fixed.
  app.navigate('line')
  click('[data-action="relations"][data-type="line"][data-id="1"]')
  assert.equal(get('managerTitle').textContent, '产线关联配置')
  assert.deepEqual(
    Array.from(get('manager').querySelectorAll('[role="tab"]'), (el) => el.textContent),
    ['资源产线映射', '产线主工序配送区'],
  )
  const managerCount = () => get('manager').querySelectorAll('tbody tr').length
  const managerQuery = () =>
    get('managerFilters').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true }),
    )
  assert.equal(managerCount(), 3)
  app.openEditor('resourceLine', 4)
  assert.equal(get('editor').open, false, 'Cannot edit another production line record')
  get('managerFilters').querySelector('[name="resourceCode"]').value = '0001002'
  assert.equal(managerCount(), 3, 'Draft is not applied until querying')
  managerQuery()
  assert.equal(managerCount(), 1)
  get('managerFilters').querySelector('[name="resourceCode"]').value = 'not applied'
  click('[data-action="manager-refresh"]')
  assert.equal(managerCount(), 1, 'Refresh uses applied query')
  click('[data-action="manager-reset"]')
  get('managerFilters').querySelector('[name="enabled"]').value = 'false'
  managerQuery()
  assert.equal(managerCount(), 1)
  assert.match(get('manager').querySelector('tbody').textContent, /0001003/)
  click('[data-action="manager-reset"]')
  sortBy('updatedTime', 'manager')
  sortBy('updatedTime', 'manager')
  assert.equal(get('manager').querySelector('tbody .name').textContent, '0001002')
  click('[data-action="manager-create"]')
  assert.ok(get('f-productionLineId').disabled)
  assert.equal(app.getState().editorState.draft.productionLineId, 1)
  assert.ok(get('manager').querySelector('[data-action="manager-tab"]').disabled)
  app.closeDialog('manager')
  assert.ok(get('manager').open, 'Child protects parent')
  get('f-resourceCode').value = '0001099'
  get('f-enabled').click()
  const resourceSave = app.save()
  assert.ok(get('saveButton').disabled)
  await app.save()
  await resourceSave
  assert.equal(data.records.resourceLine.filter((r) => r.resourceCode === '0001099').length, 1)
  const newResource = data.records.resourceLine.at(-1)
  assert.equal(newResource.enabled, false)
  assert.equal(newResource.productionLineId, 1)
  assert.ok(!('remark' in newResource), 'Blank optional field omitted on create')
  app.openEditor('resourceLine', newResource.id)
  await app.save()
  assert.equal(data.records.resourceLine.at(-1).remark, null)
  click('[data-action="manager-tab"][data-key="lineProcessStorage"]')
  assert.equal(managerCount(), 3)
  assert.equal(get('manager').querySelector('[aria-sort="descending"]'), null)
  click('[data-action="manager-pick"]')
  assert.equal(
    get('pickerTable').querySelectorAll('tbody tr').length,
    4,
    'No additional area/type restriction',
  )
  app.choose(3)
  assert.equal(managerCount(), 3)
  managerQuery()
  assert.equal(managerCount(), 1)
  assert.match(get('manager').querySelector('tbody').textContent, /主物料库/)
  click('[data-action="clear-reference"][data-source="manager"]')
  managerQuery()
  assert.equal(managerCount(), 3)
  click('[data-action="manager-create"]')
  get('f-mainProcessCode').value = '00040'
  await app.save()
  assert.match(get('formError').textContent, /配送存储区/)
  app.openPicker('storage', 'storageZoneId', 'editor')
  assert.equal(get('pickerTable').querySelectorAll('tbody tr').length, 4)
  app.choose(4)
  await app.save()
  const newProcess = data.records.lineProcessStorage.at(-1)
  assert.equal(newProcess.mainProcessCode, '00040')
  assert.equal(newProcess.storageZoneId, 4)
  app.openEditor('lineProcessStorage', newProcess.id, true)
  assert.equal(get('saveButton'), null)
  app.closeDialog('editor')
  app.requestDelete('lineProcessStorage', [newProcess.id])
  await app.confirmDelete()
  assert.ok(!data.records.lineProcessStorage.some((r) => r.id === newProcess.id))
  app.closeDialog('manager')
  app.openManager('resourceLine', 2)
  assert.equal(managerCount(), 1)
  assert.match(get('manager').querySelector('tbody').textContent, /0002001/)
  app.closeDialog('manager')
  // Enough local records to exercise paging and current-page selection.
  const originalResources = data.records.resourceLine.slice()
  for (let i = 0; i < 7; i++)
    data.records.resourceLine.push({ ...newResource, id: 100 + i, resourceCode: `0003${i}` })
  app.openManager('resourceLine', 1)
  change('managerPageSize', '5')
  assert.equal(managerCount(), 5)
  click('#manager [data-select-all]')
  assert.equal(app.getState().managerState.selected.size, 5)
  click('[data-action="manager-next"]')
  assert.equal(app.getState().managerState.selected.size, 0)
  sortBy('createdTime', 'manager')
  assert.equal(get('manager').querySelector('.page-current').textContent, '1')
  click('#manager [data-select-all]')
  click('[data-action="manager-batch"]')
  assert.match(get('confirmation').textContent, /5 条资源产线映射/)
  await app.confirmDelete()
  assert.equal(data.records.resourceLine.filter((r) => r.productionLineId === 1).length, 6)
  data.records.resourceLine = originalResources
  app.closeDialog('manager')
  app.setScene('conflict')
  app.closeDialog('editor')
  app.openManager('resourceLine', 1)
  app.openEditor('resourceLine', 1)
  get('f-resourceCode').value = '000-conflict'
  await app.save()
  assert.match(get('formError').textContent, /数据已被其他操作修改/)
  assert.equal(get('f-resourceCode').value, '000-conflict')
  assert.ok(get('saveButton').disabled)
  assert.equal(data.records.resourceLine[0].resourceCode, '0001001')
  app.closeDialog('editor')
  app.requestDelete('resourceLine', [1, 2])
  await app.confirmDelete()
  assert.match(get('deleteError').textContent, /数据已被其他操作修改/)
  assert.ok(data.records.resourceLine.some((r) => r.id === 1))
  assert.ok(data.records.resourceLine.some((r) => r.id === 2))
  app.closeDialog('confirmation')
  app.closeDialog('manager')
  app.setScene('normal')

  app.navigate('factory')
  app.openEditor('factory')
  await app.save()
  assert.match(get('formError').textContent, /工厂编码/)
  get('f-factoryCode').value = 'NR-NEW'
  get('f-factoryName').value = '新工厂'
  assert.ok(get('f-enabled').checked, 'New record defaults to enabled')
  get('f-enabled').click()
  assert.equal(get('f-enabled').checked, false)
  assert.equal(document.querySelector('.switch-value').textContent, '停用')
  const pending = app.save()
  assert.ok(app.getState().busy)
  assert.ok(get('saveButton').disabled)
  assert.ok(get('saveButton').classList.contains('busy'))
  assert.ok(get('f-enabled').disabled, 'Switch is locked during submit')
  get('f-enabled').click()
  assert.equal(get('f-enabled').checked, false, 'Disabled switch cannot change')
  app.closeDialog('editor')
  assert.ok(get('editor').open, 'Cannot close during submit')
  await app.save()
  await pending
  assert.equal(data.records.factory.length, 4, 'Duplicate submit ignored')
  assert.equal(data.records.factory.at(-1).enabled, false)
  assert.equal(get('editor').open, false)
  const newFactory = data.records.factory.at(-1)
  app.openEditor('factory', newFactory.id)
  assert.equal(get('f-enabled').checked, false, 'Disabled value is restored on edit')
  get('f-enabled').click()
  assert.equal(document.querySelector('.switch-value').textContent, '启用')
  assert.equal(newFactory.enabled, false, 'Toggling does not save immediately')
  app.closeDialog('editor')
  assert.equal(newFactory.enabled, false, 'Cancel discards switch changes')
  app.openEditor('factory', newFactory.id)
  get('f-enabled').click()
  await app.save()
  assert.equal(data.records.factory.at(-1).enabled, true, 'Save retains a boolean true')
  assert.equal(
    get('filters').querySelector('[name="enabled"]').tagName,
    'SELECT',
    'Tri-state filter remains a select',
  )

  app.openEditor('factory', 1)
  get('f-factoryCode').value = 'NR-EDIT'
  await app.save()
  assert.equal(data.records.factory[0].factoryCode, 'NR-EDIT')
  assert.equal(data.records.factory[0].version, 2)

  app.navigate('model')
  assert.ok(!get('mainTable').textContent.includes('装载方式'))
  for (const [category, count] of [
    ['BOX', 3],
    ['VEHICLE_DIRECT', 1],
    ['VEHICLE_SLOT', 2],
  ]) {
    get('filters').querySelector('[name="containerCategory"]').value = category
    get('filters').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    assert.equal(app.filteredRows().length, count, `${category} filter`)
  }
  click('[data-action="reset"]')
  app.openEditor('model')
  assert.deepEqual(
    Array.from(get('f-containerCategory').options, (o) => o.value),
    ['', 'BOX', 'VEHICLE_DIRECT', 'VEHICLE_SLOT'],
  )
  assert.equal(get('f-loadingMode'), null)
  get('f-modelCode').value = 'CART-NEW'
  get('f-modelName').value = '新有位载具'
  change('f-containerCategory', 'VEHICLE_SLOT')
  change('f-usageType', 'TRANSFER_CART')
  get('f-boxCapacity').value = '8'
  await app.save()
  assert.equal(data.records.model.at(-1).containerCategory, 'VEHICLE_SLOT')
  assert.equal(data.records.model.at(-1).boxCapacity, 8)
  assert.equal('loadingMode' in data.records.model.at(-1), false)
  app.openEditor('model', data.records.model.at(-1).id, true)
  assert.match(get('editor').textContent, /有装载位载具/)
  assert.ok(!get('editor').textContent.includes('装载方式'))
  app.closeDialog('editor')
  app.openEditor('model', 1)
  assert.equal(document.querySelector('[data-field="loadingMode"]'), null)
  assert.ok(document.querySelector('[data-field="boxCapacity"]').hidden)
  change('f-containerCategory', 'VEHICLE_DIRECT')
  change('f-usageType', 'TRANSFER_CART')
  assert.ok(
    document.querySelector('[data-field="boxCapacity"]').hidden,
    'Direct vehicle has no capacity field',
  )
  change('f-containerCategory', 'VEHICLE_SLOT')
  assert.ok(!document.querySelector('[data-field="boxCapacity"]').hidden)
  change('f-usageType', 'MAGAZINE')
  assert.ok(
    !document.querySelector('[data-field="boxCapacity"]').hidden,
    'Usage does not affect capacity visibility',
  )
  get('f-boxCapacity').value = '1.5'
  await app.save()
  assert.match(get('formError').textContent, /正整数/)
  get('f-boxCapacity').value = ''
  await app.save()
  assert.equal(get('editor').open, false, 'Capacity is optional')
  app.openEditor('model', 4)
  change('f-containerCategory', 'BOX')
  await app.save()
  assert.equal(data.records.model[3].boxCapacity, undefined)
  app.openEditor('model', 6)
  change('f-containerCategory', 'VEHICLE_DIRECT')
  await app.save()
  assert.equal(
    data.records.model[5].boxCapacity,
    undefined,
    'Changing to direct vehicle clears capacity on save',
  )
  assert.equal(
    app.canManageSlots(data.records.container[0]),
    false,
    'Updated model category closes slot entry',
  )
  // Restore fixture to test SLOT vs DIRECT availability independently.
  Object.assign(data.records.model[3], { containerCategory: 'VEHICLE_SLOT', boxCapacity: 4 })
  assert.ok(data.records.model.every((row) => !('loadingMode' in row)))
  assert.ok(app.canManageSlots(data.records.container[0]))
  assert.equal(app.canManageSlots(data.records.container[1]), false)
  assert.equal(app.canManageSlots(data.records.container[3]), false)
  app.navigate('container')
  assert.deepEqual(
    Array.from(get('mainTable').querySelectorAll('[data-action="slots"]'), (el) =>
      Number(el.dataset.id),
    ),
    Array.from(
      data.records.container.filter((row) => app.canManageSlots(row)),
      (row) => row.id,
    ),
    'Only SLOT containers display the slot action',
  )
  assert.equal(
    get('mainTable').querySelector('[data-action="slots"][disabled]'),
    null,
    'No disabled slot placeholder remains',
  )
  const originalModel = data.records.container[0].containerModelId
  data.records.container[0].containerModelId = 999
  app.navigate('container')
  assert.equal(
    get('mainTable').querySelector('[data-action="slots"][data-id="1"]'),
    null,
    'Unknown model hides the action',
  )
  data.records.container[0].containerModelId = originalModel
  app.openManager('slot', 2)
  assert.equal(get('manager').open, false)
  app.openManager('slot', 1)
  assert.equal(get('manager').querySelectorAll('tbody tr').length, 4)
  app.closeDialog('manager')

  app.navigate('location')
  app.openManager('locationLine', 1)
  assert.equal(get('manager').querySelectorAll('[role="tab"]').length, 4)
  assert.equal(
    get('manager').querySelectorAll('tbody tr').length,
    2,
    'Only current location relations',
  )
  click('[data-action="manager-create"]')
  assert.ok(get('f-locationId').disabled)
  assert.equal(
    get('f-locationId').parentElement.querySelector('.reference-action').disabled,
    true,
    'Locked owner has no clear action',
  )
  app.openPicker('line', 'productionLineId', 'editor')
  assert.equal(get('pickerTable').querySelectorAll('tbody tr').length, 5)
  click('[data-action="picker-next"]')
  assert.equal(get('pickerTable').querySelectorAll('tbody tr').length, 1)
  assert.match(
    get('pickerTable').textContent,
    /调试一线/,
    'Other regions are not silently excluded',
  )
  click('#pickerTable tr[data-id="6"] td')
  assert.equal(get('picker').open, false, 'Clicking any row cell selects and closes')
  app.openPicker('line', 'productionLineId', 'editor')
  assert.equal(
    get('pickerPages').querySelector('.page-current').textContent,
    '2',
    'Reopen locates selected page',
  )
  assert.equal(get('pickerTable').querySelector('[aria-selected="true"]').dataset.id, '6')
  assert.match(get('pickerTable').querySelector('.selected').textContent, /已选/)
  assert.equal(get('pickerTable').querySelectorAll('th').length, 3, 'No action column')
  assert.equal(
    get('picker').querySelector('[data-action="clear-pick"]'),
    null,
    'No clear button in picker',
  )
  app.closeDialog('picker')
  assert.equal(
    get('f-productionLineId').parentElement.querySelector('.reference-action').dataset.action,
    'clear-reference',
    'Selected value replaces search with clear',
  )
  click('#editor [data-action="clear-reference"][data-key="productionLineId"]')
  assert.equal(get('picker').open, false, 'Inline clear does not open picker')
  assert.equal(
    get('f-productionLineId').parentElement.querySelector('.reference-action').dataset.action,
    'field-pick',
    'Cleared value restores search',
  )
  assert.equal(app.getState().editorState.draft.productionLineId, '')
  await app.save()
  assert.match(
    get('formError').textContent,
    /服务产线/,
    'Required association remains validated after clearing',
  )
  app.openPicker('line', 'productionLineId', 'editor')
  assert.equal(
    get('pickerTable').querySelector('.selected'),
    null,
    'Cleared value has no selected highlight',
  )
  click('[data-action="picker-next"]')
  get('pickerTable')
    .querySelector('tr[data-id="6"]')
    .dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
  assert.equal(get('picker').open, false, 'Keyboard selects row')
  get('f-remark').value = '<img src=x onerror=alert(1)>'
  await app.save()
  assert.equal(data.records.locationLine.at(-1).locationId, 1)
  assert.equal(data.records.locationLine.at(-1).productionLineId, 6)
  assert.equal(get('manager').querySelector('img'), null, 'User strings are escaped')
  click('[data-action="manager-tab"][data-key="locationStorage"]')
  assert.match(get('manager').textContent, /不改变位置的静态归属/)
  app.closeDialog('manager')

  app.navigate('line')
  app.openEditor('line', 1)
  assert.ok(!get('f-areaId'))
  assert.match(get('f-floorId').textContent, /A 栋一层/)
  get('f-lineName').value = '保留的草稿'
  app.openPicker('floor', 'floorId', 'editor')
  get('pickerKeyword').value = '二层'
  get('pickerFilters').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  )
  assert.equal(get('pickerTable').querySelectorAll('tbody tr').length, 1)
  app.choose(2)
  assert.equal(get('f-lineName').value, '保留的草稿')
  assert.match(get('f-floorId').textContent, /A 栋二层/)
  app.openPicker('floor', 'floorId', 'editor')
  app.choose(1)
  await app.save()
  assert.equal(data.records.line[0].floorId, 1)
  assert.ok(!Object.hasOwn(data.records.line[0], 'areaId'))
  app.closeDialog('editor')
  app.setScene('conflict')
  get('f-lineName').value = '冲突保留值'
  await app.save()
  assert.ok(get('editor').open)
  assert.match(get('formError').textContent, /数据已被其他操作修改或删除/)
  assert.equal(get('f-lineName').value, '冲突保留值')
  assert.ok(get('saveButton').disabled)
  app.closeDialog('editor')
  app.setScene('normal')

  app.openPicker('floor', 'floorId', 'filter')
  click('#pickerTable tr[data-id="2"] td')
  assert.equal(
    get('filters').querySelector('[data-key="floorId"].reference-action').dataset.action,
    'clear-reference',
    'Selected filter shows clear',
  )
  get('filters').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  assert.equal(app.filteredRows().length, 3)
  app.openPicker('floor', 'floorId', 'filter')
  assert.equal(
    get('pickerTable').querySelector('.selected').dataset.id,
    '2',
    'Filter selection is highlighted on reopen',
  )
  app.closeDialog('picker')
  click('#filters [data-action="clear-reference"][data-key="floorId"]')
  assert.equal(
    get('filters').querySelector('[data-key="floorId"].reference-action').dataset.action,
    'filter-pick',
    'Cleared filter shows search',
  )
  assert.equal(app.filteredRows().length, 3, 'Clearing filter does not query immediately')
  assert.equal(get('picker').open, false)
  get('filters').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  assert.equal(app.filteredRows().length, 6)

  app.navigate('location')
  app.openEditor('location')
  assert.ok(get('f-storageZoneId').disabled, 'Select area before storage')
  app.openPicker('storage', 'storageZoneId', 'editor')
  assert.equal(get('picker').open, false)
  app.openPicker('area', 'areaId', 'editor')
  app.choose(1)
  assert.ok(!get('f-storageZoneId').disabled)
  app.openPicker('storage', 'storageZoneId', 'editor')
  assert.deepEqual(
    Array.from(get('pickerTable').querySelectorAll('tbody tr'), (row) => row.dataset.id),
    ['1'],
  )
  app.choose(2)
  assert.equal(get('picker').open, true, 'Reject candidate outside current area')
  app.choose(1)
  assert.equal(app.getState().editorState.draft.storageZoneId, 1)
  get('f-locationName').value = '保留位置草稿'
  app.openPicker('area', 'areaId', 'editor')
  app.choose(1)
  assert.equal(
    app.getState().editorState.draft.storageZoneId,
    1,
    'Choosing same area retains storage',
  )
  app.openPicker('area', 'areaId', 'editor')
  app.choose(2)
  assert.equal(app.getState().editorState.draft.storageZoneId, '')
  assert.match(get('f-storageZoneId').textContent, /请选择静态归属存储区/)
  assert.equal(get('f-locationName').value, '保留位置草稿')
  app.openPicker('storage', 'storageZoneId', 'editor')
  assert.deepEqual(
    Array.from(get('pickerTable').querySelectorAll('tbody tr'), (row) => row.dataset.id),
    ['2'],
  )
  get('pickerKeyword').value = 'SMT'
  get('pickerFilters').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  )
  assert.equal(
    get('pickerTable').querySelectorAll('tbody tr').length,
    0,
    'Search remains scoped to area',
  )
  app.closeDialog('picker')
  app.openPicker('storage', 'storageZoneId', 'editor')
  app.choose(2)
  app.openPicker('storage', 'storageZoneId', 'editor')
  assert.equal(get('pickerTable').querySelector('.selected').dataset.id, '2')
  app.closeDialog('picker')
  click('#editor [data-action="clear-reference"][data-key="areaId"]')
  assert.equal(app.getState().editorState.draft.storageZoneId, '')
  assert.ok(get('f-storageZoneId').disabled)
  app.closeDialog('editor')
  app.openEditor('location', 1)
  assert.equal(app.getState().editorState.draft.storageZoneId, 1, 'Editing preserves initial value')
  app.openPicker('area', 'areaId', 'editor')
  app.choose(2)
  assert.equal(
    app.getState().editorState.draft.storageZoneId,
    '',
    'Edit also clears dependent value',
  )
  app.closeDialog('editor')
  assert.equal(data.records.location[0].storageZoneId, 1, 'Cancel preserves saved storage')
  app.openManager('locationStorage', 1)
  app.openEditor('locationStorage', 1)
  app.openPicker('storage', 'storageZoneId', 'editor')
  assert.equal(
    get('pickerTable').querySelectorAll('tbody tr').length,
    4,
    'Business storage association stays cross-area',
  )
  app.closeDialog('picker')
  app.closeDialog('editor')
  app.closeDialog('manager')
  app.openEditor('location', 1)
  click('#editor [data-action="clear-reference"][data-key="storageZoneId"]')
  await app.save()
  assert.equal(
    data.records.location[0].storageZoneId,
    '',
    'Optional association can be cleared and saved in demo',
  )

  app.navigate('factory')
  app.setScene('reference')
  await app.confirmDelete()
  assert.match(get('deleteError').textContent, /被业务记录引用/)
  assert.equal(data.records.factory.length, 4)
  app.closeDialog('confirmation')
  app.setScene('normal')
  const box = get('mainTable').querySelector('[data-select-all]')
  box.click()
  assert.ok(!get('batchDelete').disabled)
  click('#batchDelete')
  assert.match(get('confirmation').textContent, /4 条工厂/)
  await app.confirmDelete()
  assert.equal(data.records.factory.length, 0)

  app.navigate('location')
  change('pageSize', '5')
  assert.equal(get('mainTable').querySelectorAll('tbody tr').length, 5)
  click('[data-action="next"]')
  assert.equal(get('mainTable').querySelectorAll('tbody tr').length, 3)
  const keyword = get('filters').querySelector('[name="keyword"]')
  keyword.value = '001'
  get('filters').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  assert.equal(get('mainTable').querySelectorAll('tbody tr').length, 1)
  get('filters').querySelector('[name="keyword"]').value = '不存在的名称'
  click('[data-action="refresh"]')
  assert.equal(
    get('mainTable').querySelectorAll('tbody tr').length,
    1,
    'Refresh preserves applied query, not unsubmitted inputs',
  )
  click('[data-action="reset"]')
  assert.equal(get('mainTable').querySelectorAll('tbody tr').length, 5)
  const stateIcons = new Set(),
    stateColors = new Set()
  for (const state of ['loading', 'empty', 'failure']) {
    app.setScene(state)
    const panel = get('mainTable').querySelector(`.state-${state}`)
    assert.ok(panel)
    assert.equal(panel.getAttribute('role'), state === 'failure' ? 'alert' : 'status')
    stateIcons.add(panel.querySelector('svg path').getAttribute('d'))
    stateColors.add(window.getComputedStyle(panel.querySelector('.state-symbol')).color)
    assert.equal(!!panel.querySelector('[data-action="retry"]'), state === 'failure')
  }
  assert.equal(stateIcons.size, 3, 'Loading, empty and failure use distinct icons')
  assert.equal(stateColors.size, 3, 'Loading, empty and failure use distinct colors')
  click('[data-action="retry"]')
  assert.ok(get('mainTable').querySelector('table'))
  await settle()
  console.log(
    'PASS: 15 schema-aligned forms; 8 menus; production-line association tabs, query, paging, sorting, owner isolation, CRUD and parent locks; scoped relations; paginated search picker; conditional model fields; SLOT-only manager; submit locking; conflicts; batch delete; empty/loading/error states.',
  )
} finally {
  await window.happyDOM.close()
}
