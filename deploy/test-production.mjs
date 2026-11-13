import assert from 'node:assert/strict'
import process from 'node:process'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  realpathSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { test } from 'node:test'

const source = resolve('deploy/production')
const image = 'foundation-business-frontend'
const project = 'foundation-nari-frontend'

// The fake CLI records commands and container state; no Docker daemon is contacted.
const fakeDocker = `#!/usr/bin/env node
const fs = require('node:fs')
const a = process.argv.slice(2)
const path = process.env.MOCK_STATE
const s = JSON.parse(fs.readFileSync(path, 'utf8'))
s.commands.push(a)
function done(output = '', code = 0) {
  fs.writeFileSync(path, JSON.stringify(s))
  if (output) console.log(output)
  process.exit(code)
}
const format = a.includes('--format') ? a[a.indexOf('--format') + 1] : ''
if (a[0] === 'info') done()
if (a[0] === 'network') done(format ? 'backend-id' : '{}')
if (a[0] === 'load') {
  fs.readFileSync(0)
  if (s.failLoad) done('', 1)
  s.images[process.env.MOCK_TARGET] = s.architecture || 'linux/amd64'
  done('Loaded image')
}
if (a[0] === 'image') {
  const version = a.at(-1).split(':').at(-1)
  if (!s.images[version]) done('', 1)
  done(format === '{{.Id}}' ? 'sha256:' + version : s.images[version])
}
if (a[0] === 'container') {
  if (a.at(-1) === 'backend-id') {
    done(format.includes('Aliases') ? (s.noBackend ? 'other' : 'backend') : 'true')
  }
  if (!s.container) done('', 1)
  if (format.includes('Labels')) done(s.owner || '${project}|frontend')
  if (format === '{{.Config.Image}}') done('${image}:' + s.container)
  if (format === '{{.Image}}') done('sha256:' + s.container)
  done(s.badHealth === s.container ? 'running|unhealthy' : s.missingHealth === s.container ? 'running|missing' : 'running|healthy')
}
if (a[0] === 'compose') {
  if (a.includes('version')) done('Docker Compose version v2.27.3')
  if (a.includes('config') || a.includes('run')) done('', s.failCheck ? 1 : 0)
  if (a.includes('up')) {
    const version = process.env.FRONTEND_VERSION
    s.container = version
    done('', s.failUp === version ? 1 : 0)
  }
  if (a.includes('rm')) s.container = null
  done()
}
done('Unexpected Docker command: ' + a.join(' '), 1)
`

function fixture(t, existing = false, extra = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'frontend-production-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const dir = join(root, 'frontend')
  const bin = join(root, 'bin')
  mkdirSync(dir)
  mkdirSync(bin)
  writeFileSync(join(bin, 'docker'), fakeDocker, { mode: 0o755 })
  const stateFile = join(root, 'state.json')
  writeFileSync(
    stateFile,
    JSON.stringify({
      images: existing ? { v1: 'linux/amd64' } : {},
      container: existing ? 'v1' : null,
      commands: [],
      ...extra,
    }),
  )
  // A backend file next to the frontend directory must never be touched.
  writeFileSync(join(root, '.env'), 'BACKEND_SECRET=unchanged\n')
  if (existing) {
    writeFileSync(join(dir, 'compose.yml'), readFileSync(join(source, 'compose.yml')))
    writeFileSync(join(dir, 'nginx.conf'), 'existing nginx config\n')
    writeFileSync(join(dir, '.env'), 'FRONTEND_VERSION=v1\nKEEP_THIS=yes\n')
    writeFileSync(join(dir, '.production-deployment'), project + '\n')
  }
  function run(script, version = 'v2') {
    const archive = join(root, image + '-' + version + '.tar.gz')
    writeFileSync(archive, gzipSync('mock image'))
    const args =
      script === 'rollback'
        ? [version]
        : script === 'deploy'
          ? [archive, resolve('deploy/nginx.conf')]
          : [archive]
    const result = spawnSync('bash', [join(source, script + '.sh'), ...args], {
      env: {
        ...process.env,
        PATH: bin + ':' + process.env.PATH,
        DEPLOY_DIR: dir,
        MOCK_STATE: stateFile,
        MOCK_TARGET: version,
      },
      encoding: 'utf8',
      timeout: 10000,
    })
    assert.equal(result.error, undefined)
    assert.equal(readFileSync(join(root, '.env'), 'utf8'), 'BACKEND_SECRET=unchanged\n')
    const state = JSON.parse(readFileSync(stateFile, 'utf8'))
    for (const command of state.commands.filter(
      (c) => c[0] === 'compose' && !c.includes('version'),
    )) {
      assert.equal(command[command.indexOf('-p') + 1], project)
      assert.equal(command[command.indexOf('-f') + 1], join(dir, 'compose.yml'))
      assert.ok(!command.includes('down'))
      if (command.includes('up')) assert.ok(command.includes('--no-deps'))
    }
    return { ...result, state }
  }
  return { dir, run }
}

test('first deployment initializes only frontend files and installs entrypoints', (t) => {
  const f = fixture(t)
  const r = f.run('deploy')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.state.container, 'v2')
  assert.match(readFileSync(join(f.dir, 'nginx.conf'), 'utf8'), /http:\/\/backend:8080/)
  assert.equal(readFileSync(join(f.dir, '.env'), 'utf8'), 'FRONTEND_VERSION=v2\n')
  assert.ok(existsSync(join(f.dir, 'upgrade.sh')))
  assert.ok(!existsSync(join(f.dir, '.deployment-lock')))
})

test('upgrade preserves other env values and backs up configs', (t) => {
  const f = fixture(t, true)
  const r = f.run('upgrade')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.state.container, 'v2')
  assert.equal(readFileSync(join(f.dir, '.env'), 'utf8'), 'FRONTEND_VERSION=v2\nKEEP_THIS=yes\n')
  assert.ok(existsSync(join(f.dir, 'backups')))
})

test('rollback switches to a retained image without loading an archive', (t) => {
  const f = fixture(t, true, { images: { v1: 'linux/amd64', v0: 'linux/amd64' } })
  const r = f.run('rollback', 'v0')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.state.container, 'v0')
  assert.ok(!r.state.commands.some((c) => c[0] === 'load'))
})

for (const [label, extra] of [
  ['health failure', { badHealth: 'v2' }],
  ['missing healthcheck', { missingHealth: 'v2' }],
  ['compose startup failure', { failUp: 'v2' }],
]) {
  test(`upgrade restores previous version after ${label}`, (t) => {
    const f = fixture(t, true, extra)
    const r = f.run('upgrade')
    assert.equal(r.status, 1)
    assert.equal(r.state.container, 'v1')
    assert.match(r.stderr, /原版本已恢复且健康/)
    assert.equal(readFileSync(join(f.dir, '.env'), 'utf8'), 'FRONTEND_VERSION=v1\nKEEP_THIS=yes\n')
  })
}

for (const [label, extra] of [
  ['wrong architecture', { architecture: 'linux/arm64' }],
  ['preflight failure', { failCheck: true }],
  ['foreign container', { owner: 'backend-project|frontend' }],
  ['missing backend alias', { noBackend: true }],
  ['load failure', { failLoad: true }],
]) {
  test(`upgrade does not change running version on ${label}`, (t) => {
    const f = fixture(t, true, extra)
    const r = f.run('upgrade')
    assert.notEqual(r.status, 0)
    assert.equal(r.state.container, 'v1')
    assert.equal(readFileSync(join(f.dir, '.env'), 'utf8'), 'FRONTEND_VERSION=v1\nKEEP_THIS=yes\n')
    assert.ok(!r.state.commands.some((c) => c.includes('up')))
  })
}

test('failed initial deployment removes only its own container and new configuration', (t) => {
  const f = fixture(t, false, { badHealth: 'v2' })
  const r = f.run('deploy')
  assert.equal(r.status, 1)
  assert.equal(r.state.container, null)
  assert.ok(!existsSync(join(f.dir, '.env')))
  assert.ok(!existsSync(join(f.dir, '.production-deployment')))
})

test('failure to restore is reported explicitly and still exits nonzero', (t) => {
  const f = fixture(t, true, { badHealth: 'v2', failUp: 'v1' })
  const r = f.run('upgrade')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /原版本恢复失败/)
})

test('rollback rejects missing image without changing the running version', (t) => {
  const f = fixture(t, true)
  const r = f.run('rollback', 'v0')
  assert.notEqual(r.status, 0)
  assert.equal(r.state.container, 'v1')
})

test('repeated initial deployment does not overwrite configuration', (t) => {
  const f = fixture(t, true)
  const r = f.run('deploy')
  assert.equal(r.status, 1)
  assert.equal(readFileSync(join(f.dir, 'nginx.conf'), 'utf8'), 'existing nginx config\n')
})

test('existing deployment lock blocks concurrent version changes', (t) => {
  const f = fixture(t, true)
  mkdirSync(join(f.dir, '.deployment-lock'))
  const r = f.run('upgrade')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /部署锁已存在/)
  assert.ok(existsSync(join(f.dir, '.deployment-lock')))
})

test('same version upgrade never imports an archive over the running tag', (t) => {
  const f = fixture(t, true)
  const r = f.run('upgrade', 'v1')
  assert.equal(r.status, 1)
  assert.ok(!r.state.commands.some((c) => c[0] === 'load'))
})

test('failed rollback restores the version that was running before rollback', (t) => {
  const f = fixture(t, true, {
    images: { v1: 'linux/amd64', v0: 'linux/amd64' },
    badHealth: 'v0',
  })
  const r = f.run('rollback', 'v0')
  assert.equal(r.status, 1)
  assert.equal(r.state.container, 'v1')
  assert.match(r.stderr, /原版本已恢复且健康/)
})

test('first deployment preserves pre-existing unmanaged configuration', (t) => {
  const f = fixture(t)
  writeFileSync(join(f.dir, '.env'), 'UNMANAGED=keep\n')
  const r = f.run('deploy')
  assert.equal(r.status, 1)
  assert.equal(readFileSync(join(f.dir, '.env'), 'utf8'), 'UNMANAGED=keep\n')
  assert.ok(!r.state.commands.some((c) => c[0] === 'load'))
})

test('first deployment preflight failure cleans initialization and permits retry', (t) => {
  const f = fixture(t, false, { failCheck: true })
  const r = f.run('deploy')
  assert.equal(r.status, 1)
  assert.equal(r.state.container, null)
  assert.ok(!existsSync(join(f.dir, 'compose.yml')))
  assert.ok(!existsSync(join(f.dir, '.deployment-lock')))
})

test('upgrade rejects an existing target image tag before loading', (t) => {
  const f = fixture(t, true, { images: { v1: 'linux/amd64', v2: 'linux/amd64' } })
  const r = f.run('upgrade')
  assert.equal(r.status, 1)
  assert.equal(r.state.container, 'v1')
  assert.ok(!r.state.commands.some((c) => c[0] === 'load'))
})
