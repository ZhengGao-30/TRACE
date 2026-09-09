import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

// Exercise App's actual handlers with small state/API doubles. Extracting the
// AST keeps these tests independent of JSX layout and avoids copying the logic
// under test into a second implementation.
const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const tree = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const app = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'App')
assert.ok(app?.body, 'App function must be available for handler regression tests')
const handlerNames = ['switchKey', 'runAttack', 'runMatrix', 'reset']
const handlers = new Map(app.body.statements
  .filter((node) => ts.isFunctionDeclaration(node) && handlerNames.includes(node.name?.text))
  .map((node) => [node.name.text, ts.transpileModule(node.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText]))
for (const name of handlerNames) assert.ok(handlers.has(name), `Missing App handler: ${name}`)

function handler(name, scope) {
  // `with` supplies App's lexical dependencies; no production source is changed.
  return Function('scope', `with (scope) { ${handlers.get(name)}; return ${name}; }`)(scope)
}

const guidedAttackExpressions = new Map()
function collectGuidedAttack(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'GuidedAttack') {
    for (const attribute of node.attributes.properties) {
      if (ts.isJsxAttribute(attribute) && ['attacked', 'detected'].includes(attribute.name.getText(tree))) {
        assert.ok(attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression)
        guidedAttackExpressions.set(attribute.name.getText(tree), attribute.initializer.expression.getText(tree))
      }
    }
  }
  ts.forEachChild(node, collectGuidedAttack)
}
collectGuidedAttack(app)
assert.equal(guidedAttackExpressions.size, 2, 'Both GuidedAttack verdict props must be inspected')
function attackVerdict(scope) {
  return Object.fromEntries([...guidedAttackExpressions].map(([name, expression]) => [
    name, Function('scope', `with (scope) { return (${expression}); }`)(scope),
  ]))
}

function detection(z) {
  return {
    layer1: { z, z_wrong: -.5, n: 3 },
    layer2: { z, z_wrong: -.5, n: 3 },
    consistency: { rate: 0 }, tau: 2,
  }
}

function context(overrides = {}) {
  const right = detection(4), wrong = detection(-.5), after = detection(1)
  const calls = [], writes = []
  const ctx = {
    sid: 'static:CS01', running: false, busy: null, groups: [{}], constructionPreview: false,
    health: { keys: { key1: 1, key2: 2, wrong_key1: 3, wrong_key2: 4 }, tau: 2 },
    reviewGeneration: { current: 1 }, sessionStatic: { current: true },
    staticGame: { current: { detect: { right, wrong } } }, rate: .3,
    lastAttackResult: null, detectTarget: 'original', detect: right, keyMode: 'right',
    rows: [], curve: [], hse: { done: true, success: true },
    sessionUnsubscribe: { current: null }, moveQ: { current: [] }, walking: { current: false },
    queue: { current: [] }, timer: { current: null }, watchdog: { current: null },
    reviewWatchdog: { current: null }, reviewPending: { current: null },
    staticAttack: (...args) => { calls.push(['staticAttack', ...args]); return { before: right, after } },
    staticMatrix: (...args) => { calls.push(['staticMatrix', ...args]); return [{ attack: 'clean' }, { attack: 'deletion' }] },
    api: {
      detect: async (...args) => { calls.push(['detect', ...args]); return args[1] === 3 ? wrong : right },
      attack: async (...args) => { calls.push(['attack', ...args]); return { before: right, after } },
      matrix: async (...args) => { calls.push(['matrix', ...args]); return { rows: [{ attack: 'clean' }] } },
    },
    window: {
      clearInterval: (id) => calls.push(['clearInterval', id]),
      clearTimeout: (id) => calls.push(['clearTimeout', id]),
    },
    calls, writes, ...overrides,
  }
  for (const [setter, key] of Object.entries({
    setBusy: 'busy', setInstrumentError: 'instrumentError', setKeyMode: 'keyMode',
    setDetect: 'detect', setRows: 'rows', setLastAttackResult: 'lastAttackResult',
    setDetectTarget: 'detectTarget', setGroups: 'groups', setCurve: 'curve', setSid: 'sid',
    setRunning: 'running', setFollow: 'follow', setUnseen: 'unseen', setExpandedPhase: 'expanded',
    setReviewEpoch: 'epoch', setScene: 'scene', setHse: 'hse',
  })) {
    ctx[setter] = (value) => {
      ctx[key] = typeof value === 'function' ? value(ctx[key]) : value
      writes.push([key, ctx[key]])
    }
  }
  return ctx
}

const actions = [
  { name: 'switchKey', args: ['wrong'], api: 'detect', busy: '__key' },
  { name: 'runAttack', args: ['deletion'], api: 'attack', busy: 'deletion' },
  { name: 'runMatrix', args: [], api: 'matrix', busy: '__matrix' },
]

for (const action of actions) {
  for (const [label, patch] of [
    ['no session', { sid: null }],
    ['run in progress', { running: true }],
    ['another operation pending', { busy: 'other' }],
    ['no recorded groups', { groups: [] }],
    ['scene-only preview', { constructionPreview: true }],
    ['static session missing its bundle', { staticGame: { current: null } }],
  ]) {
    test(`${action.name} ignores ${label}`, async () => {
      const ctx = context(patch)
      await handler(action.name, ctx)(...action.args)
      assert.deepEqual(ctx.writes, [])
      assert.deepEqual(ctx.calls, [], 'Never fall back to an API request for missing static data')
    })
  }

  for (const staticSession of [true, false]) {
    test(`${action.name} completes with the ${staticSession ? 'static' : 'API'} source`, async () => {
      const ctx = context({ sessionStatic: { current: staticSession } })
      await handler(action.name, ctx)(...action.args)
      assert.equal(ctx.busy, null)
      assert.equal(ctx.instrumentError, null)
      if (action.name === 'switchKey') {
        assert.equal(ctx.keyMode, 'wrong')
        assert.equal(ctx.detectTarget, 'original')
        assert.equal(ctx.detect, ctx.staticGame.current.detect.wrong)
        assert.equal(ctx.lastAttackResult, null)
        if (!staticSession) assert.deepEqual(ctx.calls, [['detect', ctx.sid, 3, 4]])
      } else if (action.name === 'runAttack') {
        assert.equal(ctx.keyMode, 'right')
        assert.equal(ctx.detectTarget, 'attacked')
        assert.equal(ctx.detect, ctx.lastAttackResult)
        assert.deepEqual(ctx.rows.map((row) => row.attack), ['clean', 'deletion'])
        assert.equal(ctx.rows[1].z1, ctx.lastAttackResult.layer1.z)
      } else {
        assert.ok(ctx.rows.length > 0)
        assert.equal(ctx.lastAttackResult, null, 'Matrix evaluation is not a single attack verdict')
        assert.equal(ctx.detectTarget, 'original')
      }
      if (staticSession) assert.ok(ctx.calls.every(([name]) => name.startsWith('static')))
      else assert.equal(ctx.calls[0][0], action.api)
    })
  }

  test(`${action.name} preserves previous results when evaluation fails`, async () => {
    const previous = detection(3), rows = [{ attack: 'previous' }]
    const ctx = context({
      sessionStatic: { current: false }, lastAttackResult: previous, detect: previous,
      detectTarget: 'attacked', rows,
    })
    ctx.api[action.api] = async () => { throw new Error('deliberate request failure') }
    await handler(action.name, ctx)(...action.args)
    assert.equal(ctx.detect, previous)
    assert.equal(ctx.lastAttackResult, previous)
    assert.equal(ctx.detectTarget, 'attacked')
    assert.equal(ctx.rows, rows)
    assert.match(ctx.instrumentError, /could not/)
    assert.equal(ctx.busy, null)
  })

  for (const reject of [false, true]) {
    test(`${action.name} ignores an obsolete ${reject ? 'failure' : 'success'} after session reset`, async () => {
      let resolve, rejectRequest
      const delayed = new Promise((yes, no) => { resolve = yes; rejectRequest = no })
      const ctx = context({ sessionStatic: { current: false } })
      ctx.api[action.api] = () => delayed
      const pending = handler(action.name, ctx)(...action.args)
      assert.equal(ctx.busy, action.busy)
      handler('reset', ctx)()
      ctx.busy = 'new-session-operation'
      const afterReset = [...ctx.writes]
      if (reject) rejectRequest(new Error('obsolete failure'))
      else resolve(action.name === 'switchKey' ? detection(4)
        : action.name === 'runAttack' ? { before: detection(4), after: detection(1) } : { rows: [] })
      await pending
      assert.deepEqual(ctx.writes, afterReset, 'Neither result, error nor finally may update the new session')
      assert.equal(ctx.busy, 'new-session-operation')
      assert.equal(ctx.lastAttackResult, null)
      assert.equal(ctx.detect, null)
    })
  }
}

test('switchKey ignores missing health metadata', async () => {
  const ctx = context({ health: null })
  await handler('switchKey', ctx)('wrong')
  assert.deepEqual(ctx.writes, [])
  assert.deepEqual(ctx.calls, [])
})

test('actual GuidedAttack props retain the attack verdict through key calibration and matrix evaluation', async () => {
  const ctx = context()
  await handler('runMatrix', ctx)()
  assert.deepEqual(attackVerdict(ctx), { attacked: false, detected: false })
  await handler('runAttack', ctx)('deletion')
  const attack = ctx.lastAttackResult
  assert.deepEqual(attackVerdict(ctx), { attacked: true, detected: false })
  await handler('switchKey', ctx)('right')
  assert.equal(ctx.detect.layer1.z, 4, 'Clean right-key detection differs from the attacked result')
  assert.deepEqual(attackVerdict(ctx), { attacked: true, detected: false })
  await handler('switchKey', ctx)('wrong')
  await handler('runMatrix', ctx)()
  assert.equal(ctx.lastAttackResult, attack)
  assert.deepEqual(attackVerdict(ctx), { attacked: true, detected: false })
})

test('actual GuidedAttack props do not call a surviving attack broken when the wrong clean key fails', async () => {
  const ctx = context()
  const survivingAttack = detection(3)
  ctx.staticAttack = () => ({ before: detection(4), after: survivingAttack })
  await handler('runAttack', ctx)('deletion')
  await handler('switchKey', ctx)('wrong')
  assert.equal(ctx.detect.layer1.z, -.5)
  assert.deepEqual(attackVerdict(ctx), { attacked: true, detected: true })
})

test('reset clears instrument verdicts, keys, timers and prior session state together', () => {
  const ctx = context({
    lastAttackResult: detection(1), detectTarget: 'attacked', keyMode: 'wrong',
    rows: [{ attack: 'deletion' }], running: true, busy: 'deletion', instrumentError: 'old error',
    timer: { current: 10 }, watchdog: { current: 11 }, reviewWatchdog: { current: 12 },
    reviewPending: { current: { step: 1, generation: 1 } },
  })
  ctx.sessionUnsubscribe.current = () => ctx.calls.push(['unsubscribe'])
  handler('reset', ctx)()
  assert.equal(ctx.reviewGeneration.current, 2)
  assert.equal(ctx.lastAttackResult, null)
  assert.equal(ctx.detect, null)
  assert.equal(ctx.detectTarget, 'original')
  assert.equal(ctx.keyMode, 'right')
  assert.deepEqual(ctx.rows, [])
  assert.deepEqual(ctx.groups, [])
  assert.equal(ctx.sid, null)
  assert.equal(ctx.busy, null)
  assert.equal(ctx.instrumentError, null)
  assert.equal(ctx.running, false)
  assert.equal(ctx.reviewPending.current, null)
  assert.equal(ctx.sessionUnsubscribe.current, null)
  assert.deepEqual(ctx.calls, [['unsubscribe'], ['clearInterval', 10], ['clearTimeout', 11], ['clearTimeout', 12]])
})
