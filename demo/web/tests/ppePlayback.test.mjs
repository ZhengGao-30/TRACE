import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
async function load(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  Function('require', 'module', 'exports', 'window', code)(name => dependencies[name] ?? require(name), module, module.exports, dependencies.window)
  return module.exports
}
const ppe = await load('../src/lib/ppeInspection.ts')
const playback = await load('../src/lib/ppePlayback.ts', { './ppeInspection': ppe })
const storyComponent = { __esModule: true, default: () => React.createElement('div', { 'data-watermark-story': '' }) }
const scene = await load('../src/lib/constructionScene.ts')
const guided = await load('../src/lib/guidedSteps.ts', { './ppeInspection': ppe })
const workflow = await load('../src/components/PairedWorkflowStrip.tsx', { '../lib/ppeInspection': ppe, '../lib/guidedSteps': guided })
const dependencies = { '../lib/ppePlayback': playback, '../lib/ppeInspection': ppe, './PairedWorkflowStrip': workflow, './PPEWatermarkStory': storyComponent }
const comparison = await load('../src/components/PPEWorkflowComparison.tsx', dependencies)
const pairs = await Promise.all(['CS01', 'CS02'].map(async id => JSON.parse(await readFile(new URL(`../public/static/compare/hse_ppe-${id}.json`, import.meta.url), 'utf8'))))
const action = (pair, source, index, generation = 1) => ({ caseId: pair.game_id, source, index, token: `${pair.game_id}:${source}:${index}:${generation}`, status: 'restoring' })

for (const pair of pairs) {
  test(`${pair.game_id}: every action restores its own before/after state independently of other runs`, () => {
    const original = JSON.stringify(pair)
    for (const source of ['standard', 'trace']) for (const step of pair[source].steps) {
      const active = action(pair, source, step.i)
      for (const status of ['restoring', 'playing', 'error']) {
        const frame = playback.actionPlaybackFrame(pair, { ...active, status })
        assert.equal(frame.step, step)
        assert.deepEqual(frame.state, step.scene_state_before)
        assert.deepEqual(frame.checklist, step.checklist_before)
        assert.equal(frame.prefix.length, step.i)
      }
      const after = playback.actionPlaybackFrame(pair, { ...active, status: 'complete' })
      assert.deepEqual(after.state, step.scene_state_after)
      assert.deepEqual(after.checklist, step.checklist_after)
      assert.equal(after.prefix.length, step.i + 1)
      const prefix = after.prefix.map(s => ({ i: s.i, chosen: s.action, result: s.result, observations: [] }))
      const normalized = pair[source].steps.map(s => ({ ...s, scene_action: ppe.ppeMotionSpec(s) }))
      const pose = scene.reviewResumePose(normalized, prefix)
      let last = [-3.8, 0, 2.6]
      for (const prior of after.prefix) if (ppe.ppeMotionSpec(prior).mode === 'inspect') last = scene.stationForReview(prior.action, prior.station_id).position
      assert.deepEqual(pose.position, last)
    }
    const correction = pair.trace.steps.find(step => step.requirement_id === 'change_confirmation')
    const corrected = playback.actionPlaybackFrame(pair, { ...action(pair, 'trace', correction.i), status: 'complete' })
    const previous = playback.actionPlaybackFrame(pair, action(pair, 'standard', 0))
    assert.equal(corrected.state.ppe_revision, 2)
    assert.equal(previous.state.ppe_revision, 1)
    assert.deepEqual(previous.checklist, pair.standard.steps[0].checklist_before)
    assert.equal(playback.actionPlaybackFrame(pair, { ...action(pair, 'trace', 0), caseId: 'different-case' }), null)
    assert.equal(playback.actionPlaybackFrame(pair, action(pair, 'trace', 999)), null)
    assert.equal(JSON.stringify(pair), original)
  })

  test(`${pair.game_id}: requirement alignment survives reordered steps and missing counterparts`, () => {
    for (const step of pair.trace.steps) {
      const matched = playback.matchedRequirement(pair, playback.requirementKey(step))
      assert.equal(matched.standard.requirement_id, step.requirement_id)
      assert.equal(matched.trace, step)
    }
    const reordered = structuredClone(pair)
    reordered.standard.steps.reverse()
    const key = playback.requirementKey(pair.trace.steps[0])
    assert.equal(playback.matchedRequirement(reordered, key).standard.requirement_id, key)
    reordered.standard.steps = reordered.standard.steps.filter(step => step.requirement_id !== key)
    assert.equal(playback.matchedRequirement(reordered, key).standard, undefined)
    const matched = playback.matchedRequirement(pair, key)
    assert.deepEqual(playback.matchedDecisionContext(matched.standard, matched.trace), { sameState: true, sameDistribution: true })
    assert.equal(playback.matchedDecisionContext({ ...matched.standard, policy_state_id: 'another-state' }, matched.trace).sameDistribution, false)
    const modified = structuredClone(matched.trace)
    modified.distribution[0].p += .1
    assert.equal(playback.matchedDecisionContext(matched.standard, modified).sameDistribution, false)
  })

  test(`${pair.game_id}: four boxes stay ordered and baseline outcomes retain their replay gate independently of the key comparison`, () => {
    const props = { pair, current: -1, completedIndex: -1, running: false, playback: null, watched: { standard: [], trace: [] }, onPlay() {} }
    const html = renderToStaticMarkup(React.createElement(comparison.default, props))
    assert.deepEqual([...html.matchAll(/data-comparison-box="([^"]+)"/g)].map(match => match[1]), ['standard', 'trace', 'difference', 'photo'])
    assert.match(html, /not connected/)
    assert.match(html, /simulated observations, not captured image files/)
    assert.match(html, /data-watermark-story=""/)
    const one = renderToStaticMarkup(React.createElement(comparison.default, { ...props, watched: { standard: [0], trace: [] } }))
    const both = renderToStaticMarkup(React.createElement(comparison.default, { ...props, watched: { standard: [0], trace: [0] } }))
    const lastAction = renderToStaticMarkup(React.createElement(comparison.default, { ...props, current: 23, completedIndex: 23 }))
    const stillRunning = renderToStaticMarkup(React.createElement(comparison.default, { ...props, current: 23, completedIndex: 23, fullReplayComplete: true, running: true }))
    const incomplete = renderToStaticMarkup(React.createElement(comparison.default, { ...props, current: 23, completedIndex: 22, fullReplayComplete: true }))
    const finished = renderToStaticMarkup(React.createElement(comparison.default, { ...props, current: 23, completedIndex: 23, fullReplayComplete: true }))
    const armHtml = (markup, arm) => markup.match(new RegExp(`<section\\b[^>]*data-comparison-box="${arm}"[^>]*>([\\s\\S]*?)</section>`))?.[1] ?? ''
    const conclusion = pair.standard.steps.find(step => step.requirement_id === 'ppe_conclusion')
    const outcome = playback.inspectionLabel(conclusion, true)
    for (const pending of [html, one, both, lastAction, stillRunning, incomplete]) {
      assert.ok(armHtml(pending, 'standard').includes(playback.inspectionLabel(conclusion, false)))
      assert.ok(!armHtml(pending, 'standard').includes(outcome), 'unwatched baseline outcomes wait for completed full playback')
    }
    assert.ok(armHtml(finished, 'standard').includes(outcome))
    const watchedConclusion = renderToStaticMarkup(React.createElement(comparison.default, { ...props, watched: { standard: [conclusion.i], trace: [] } }))
    assert.ok(armHtml(watchedConclusion, 'standard').includes(outcome), 'watching the conclusion itself still reveals that recorded result')
    for (const rendered of [html, one, both, lastAction, stillRunning, incomplete, finished]) {
      assert.doesNotMatch(rendered, /Recorded details|Methods and watermark details|Full inspection results|Both decisions used the same probabilities|Same recorded finding/)
      assert.match(rendered, /data-watermark-story=""/)
      assert.deepEqual([...rendered.matchAll(/data-comparison-box="([^"]+)"/g)].map(match => match[1]), ['standard', 'trace', 'difference', 'photo'])
    }
  })
}

test('A to B to A, repeated steps and late callbacks commit only the latest playing action', () => {
  const pair = pairs[0]
  let state = playback.emptyPlayback()
  const first = action(pair, 'trace', 0, 1), second = action(pair, 'standard', 0, 2), third = action(pair, 'trace', 0, 3)
  state = playback.playbackTransition(state, { type: 'play', action: first })
  assert.equal(playback.playbackTransition(state, { type: 'complete', token: first.token }), state)
  state = playback.playbackTransition(state, { type: 'ready', token: first.token })
  state = playback.playbackTransition(state, { type: 'play', action: second })
  for (const type of ['ready', 'complete', 'fail']) assert.equal(playback.playbackTransition(state, { type, token: first.token }), state)
  state = playback.playbackTransition(state, { type: 'play', action: third })
  state = playback.playbackTransition(state, { type: 'ready', token: third.token })
  assert.equal(playback.playbackTransition(state, { type: 'complete', token: second.token }), state)
  state = playback.playbackTransition(state, { type: 'complete', token: third.token })
  assert.deepEqual(state.watched, { standard: [], trace: [0] })
  for (const type of ['ready', 'complete', 'fail']) assert.equal(playback.playbackTransition(state, { type, token: third.token }), state)
  const replay = action(pair, 'trace', 0, 4)
  state = playback.playbackTransition(state, { type: 'play', action: replay })
  state = playback.playbackTransition(state, { type: 'ready', token: replay.token })
  state = playback.playbackTransition(state, { type: 'complete', token: replay.token })
  assert.deepEqual(state.watched.trace, [0])
  state = playback.playbackTransition(state, { type: 'reset' })
  assert.equal(playback.playbackTransition(state, { type: 'complete', token: replay.token }), state)
  assert.deepEqual(state, playback.emptyPlayback())
})

test('timeout never reveals an unfinished result; playing only the final step does not complete the other steps', () => {
  const last = action(pairs[0], 'standard', 23)
  let state = playback.playbackTransition(playback.emptyPlayback(), { type: 'play', action: last })
  state = playback.playbackTransition(state, { type: 'ready', token: last.token })
  const failed = playback.playbackTransition(state, { type: 'fail', token: last.token })
  assert.deepEqual(failed.watched, { standard: [], trace: [] })
  assert.equal(playback.playbackTransition(failed, { type: 'complete', token: last.token }), failed)
  const done = playback.playbackTransition(state, { type: 'complete', token: last.token })
  assert.deepEqual(done.watched, { standard: [23], trace: [] })
})

test('single action ownership cancels only an active full replay, and does not mutate detection or full completion', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const tree = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const app = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App')
  const handler = app.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'playPPEAction')
  const code = ts.transpileModule(handler.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  for (const running of [false, true]) {
    const calls = []
    const scope = { ppeInspection: true, ppeReady: true, narrow: false, pairedWorkflow: pairs[0], running, document: { getElementById: () => null },
      reviewGeneration: { current: 8 }, setReviewError: value => calls.push(['error', value]),
      stopPPEReplay: (...args) => calls.push(['stop', ...args]), actionReplay: { play: (...args) => calls.push(['play', ...args]) } }
    const play = Function('scope', `with(scope) { ${code}; return playPPEAction; }`)(scope)
    play('standard', 2)
    assert.deepEqual(calls, running ? [['stop', null, 8], ['play', 'standard', 2]] : [['error', null], ['play', 'standard', 2]])
    calls.length = 0
    play('trace', 999)
    assert.deepEqual(calls, [])
    scope.narrow = true
    play('trace', 0)
    assert.deepEqual(calls, [])
  }
  assert.equal((source.match(/fullReplayComplete=\{runFinished\}/g) ?? []).length, 2)
  assert.equal((source.match(/onPlaybackComplete=\{actionReplay.complete\}/g) ?? []).length, 2)
})

test('scene resets only the robot by token and uses recorded procedure rather than inventing physical movement', async () => {
  const source = await readFile(new URL('../src/components/PPEInspectionScene.tsx', import.meta.url), 'utf8')
  assert.match(source, /robotResetKey=\{manual \? token : 'full-replay'\}/)
  assert.match(source, /<ConstructionScene key=\{`\$\{caseId\}:\$\{replayEpoch\}`\}/)
  assert.match(source, /if \(manual\) onPlaybackComplete\?\.\(value\)/)
  assert.match(source, /inspectionLabel\(step, resultReady\)/)
  assert.match(source, /Single-action replay\. Earlier steps are restored/)
  const three = await readFile(new URL('../src/three/ConstructionScene.tsx', import.meta.url), 'utf8')
  assert.match(three, /props.robotResetKey \?\? 'continuous'/)
})

async function hookHarness() {
  let cursor = 0, dirty = false, effects = [], timerId = 0
  const slots = [], timers = new Map()
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const hooks = {
    useState(initial) {
      const index = cursor++
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, value => { const next = typeof value === 'function' ? value(slots[index].value) : value; if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true } }]
    },
    useRef(value) { const index = cursor++; slots[index] ??= { current: value }; return slots[index] },
    useCallback(value, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { value, deps }; return slots[index].value },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!same(previous?.deps, deps)) {
        const slot = { deps, cleanup: previous?.cleanup }
        slots[index] = slot
        effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() })
      }
    },
  }
  const clock = { setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id }, clearTimeout(id) { timers.delete(id) } }
  const subject = await load('../src/lib/usePPEPlayback.ts', { react: hooks, './ppePlayback': playback, window: clock })
  return {
    timers, hooks,
    settle(callback) {
      for (let pass = 0; pass < 8; pass++) {
        cursor = 0; dirty = false; effects = []
        const state = callback()
        for (const effect of effects) effect()
        if (!dirty) return state
      }
      assert.fail('Playback hook did not settle')
    },
    render(caseId = 'CS01', suspended = false) { return this.settle(() => subject.usePPEPlayback(caseId, suspended)) },
    fire(ms) { const [id, timer] = [...timers.entries()].find(([, timer]) => timer.ms === ms) ?? []; assert.ok(timer); timers.delete(id); timer.fn(); return timer.fn },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}

test('actual playback hook cancels superseded timers, rejects late completion and clears on case change', async () => {
  const harness = await hookHarness()
  let state = harness.render()
  state.play('trace', 0)
  state = harness.render()
  const original = state.active.token
  assert.equal(state.active.status, 'restoring')
  harness.fire(220)
  state = harness.render()
  assert.equal(state.active.status, 'playing')
  const staleTimeout = [...harness.timers.values()][0].fn
  state.play('standard', 0)
  state = harness.render()
  assert.equal(harness.timers.size, 1)
  state.complete(original); staleTimeout()
  state = harness.render()
  assert.equal(state.active.source, 'standard')
  assert.deepEqual(state.watched, { standard: [], trace: [] })
  const current = state.active.token
  state.complete(current)
  assert.equal(harness.render().active.status, 'restoring')
  harness.fire(220)
  state = harness.render()
  state.complete(current)
  state = harness.render()
  assert.equal(state.active.status, 'complete')
  assert.equal(harness.timers.size, 0)
  assert.deepEqual(state.watched, { standard: [0], trace: [] })
  state.play('trace', 4)
  state = harness.render()
  const canceled = state.active.token
  state = harness.render('CS02')
  assert.equal(state.active, null)
  assert.equal(harness.timers.size, 0)
  state.complete(canceled)
  assert.deepEqual(harness.render('CS02').watched, { standard: [], trace: [] })
  harness.unmount()
})

test('actual playback hook suspends safely on narrow viewports and times out without marking completion', async () => {
  const harness = await hookHarness()
  let state = harness.render()
  state.play('trace', 4); state = harness.render()
  harness.fire(220); state = harness.render()
  const token = state.active.token
  state = harness.render('CS01', true)
  assert.equal(state.active.status, 'error')
  assert.equal(harness.timers.size, 0)
  state.complete(token)
  assert.deepEqual(harness.render('CS01', true).watched.trace, [])
  state = harness.render()
  state.play('standard', 3); state = harness.render()
  harness.fire(220); state = harness.render()
  harness.fire(75000); state = harness.render()
  assert.equal(state.active.status, 'error')
  assert.deepEqual(state.watched, { standard: [], trace: [] })
  state.play('trace', 0); state = harness.render()
  const lateTimer = [...harness.timers.values()][0].fn
  state.reset(); state = harness.render()
  lateTimer()
  assert.equal(harness.render().active, null)
  assert.equal(harness.timers.size, 0)
  harness.unmount()
})

test('fresh scene mounts restore active and completed actions without transferring the other arm state', async () => {
  const captured = []
  const subject = await load('../src/components/PPEInspectionScene.tsx', {
    '../lib/ppePlayback': playback, '../lib/ppeInspection': ppe, '../lib/constructionScene': scene,
    'framer-motion': { useReducedMotion: () => false },
    '../three/ConstructionScene': { __esModule: true, default: props => { captured.push(props); return React.createElement('div') } },
  })
  const pair = pairs[0]
  for (const source of ['standard', 'trace']) for (const status of ['playing', 'complete']) {
    const step = pair[source].steps.find(step => step.requirement_id === 'current_workwear')
    const active = { ...action(pair, source, step.i), status }
    const props = { pair, caseId: pair.game_id, groups: [], completedIndex: -1, running: false, playback: active }
    for (let mount = 0; mount < 2; mount++) {
      const html = renderToStaticMarkup(React.createElement(subject.default, props))
      const rendered = captured.at(-1)
      assert.equal(rendered.actionFinished, status === 'complete')
      assert.equal(rendered.paused, false)
      assert.equal(rendered.robotResetKey, active.token)
      assert.deepEqual(rendered.ppe, (status === 'complete' ? step.scene_state_after : step.scene_state_before).ppe)
      const frame = playback.actionPlaybackFrame(pair, active)
      const prefix = frame.prefix.map(s => ({ i: s.i, chosen: s.action, result: s.result, observations: [] }))
      assert.deepEqual(rendered.initialRobotPose, scene.reviewResumePose(pair[source].steps.map(s => ({ ...s, scene_action: ppe.ppeMotionSpec(s) })), prefix))
      assert.match(html, /Single-action replay/)
      assert.doesNotMatch(html, /Report and evidence references saved/)
    }
  }
})

function descendants(element, predicate) {
  if (!React.isValidElement(element)) return []
  return [...(predicate(element) ? [element] : []), ...React.Children.toArray(element.props.children).flatMap(child => descendants(child, predicate))]
}

test('scene mirror controls identify the selected requirement independently of the last played action', async () => {
  const subject = await load('../src/components/PPEInspectionScene.tsx', {
    '../lib/ppePlayback': playback, '../lib/ppeInspection': ppe, '../lib/constructionScene': scene,
    'framer-motion': { useReducedMotion: () => false },
    '../three/ConstructionScene': { __esModule: true, default: () => React.createElement('div') },
  })
  const pair = pairs[0]
  const selected = playback.matchedRequirement(pair, 'initial_footwear_view')
  assert.ok(selected.standard && selected.trace)
  const html = renderToStaticMarkup(React.createElement(subject.default, {
    pair, caseId: pair.game_id, groups: [],
    playback: { ...action(pair, 'standard', 0), status: 'complete' },
    selectedCheck: 'initial_footwear_view', onPlay() {},
  }))
  assert.ok(html.includes(`Selected check: ${playback.inspectionLabel(selected.standard).split(' · ')[0]}</span>`))
  assert.ok(html.includes(`Without watermark · step ${selected.standard.i + 1}`))
  assert.ok(html.includes(`With watermark · step ${selected.trace.i + 1}`))
  const source = await readFile(new URL('../src/components/PPEInspectionScene.tsx', import.meta.url), 'utf8')
  assert.match(source, /previousFocus\?\.focus\(\{ preventScroll: true \}\)/)
})

test('after single-step playback the first stage or next-action click is not reverted by the completed playback', async () => {
  for (const choice of ['stage', 'next', 'tile', 'story']) {
    const harness = await hookHarness()
    const subject = await load('../src/components/PPEWorkflowComparison.tsx', { ...dependencies, react: harness.hooks })
    const pair = pairs[0]
    let props = { pair, current: -1, completedIndex: -1, running: false, playback: null, watched: { standard: [], trace: [] }, onPlay() {} }
    const render = patch => { props = { ...props, ...patch }; return harness.settle(() => subject.default(props)) }
    render()
    const original = { ...action(pair, 'standard', 0), status: 'complete' }
    let tree = render({ playback: original, watched: { standard: [0], trace: [] } })
    const arm = source => descendants(tree, el => el.props.source === source && el.props.steps)[0]
    assert.equal(arm('standard').props.steps.length, 24)
    if (choice === 'stage') descendants(tree, el => el.type === 'button' && React.Children.toArray(el.props.children).includes('Check clothes and shoes'))[0].props.onClick()
    else if (choice === 'story') descendants(tree, el => el.type === storyComponent.default)[0].props.onSelect(pair.trace.steps[10])
    else arm('standard').props.onSelect(choice === 'next' ? arm('standard').props.next : pair.standard.steps[9])
    tree = render()
    const expected = choice === 'stage' ? 4 : choice === 'next' ? 1 : choice === 'story' ? 5 : 9
    assert.equal(arm('standard').props.selected.i, expected)
    tree = render({ playback: { ...original } })
    assert.equal(arm('standard').props.selected.i, expected, 'same token or status updates cannot steal a manual selection')
    tree = render({ playback: { ...action(pair, 'trace', 6, 2), status: 'playing' } })
    assert.equal(arm('trace').props.selected.i, 6, 'a new explicit play request does select its recorded check')
    harness.unmount()
  }
})

test('full replay follows steps until browsing, then Follow replay returns to the current action', async () => {
  const harness = await hookHarness()
  const subject = await load('../src/components/PPEWorkflowComparison.tsx', { ...dependencies, react: harness.hooks })
  const pair = pairs[0]
  let props = { pair, current: 0, completedIndex: -1, running: true, playback: null, watched: { standard: [], trace: [] }, onPlay() {} }
  const render = patch => { props = { ...props, ...patch }; return harness.settle(() => subject.default(props)) }
  let tree = render()
  const trace = () => descendants(tree, el => el.props.source === 'trace' && el.props.steps)[0]
  tree = render({ current: 1, completedIndex: 0 })
  assert.equal(trace().props.selected.i, 1)
  trace().props.onSelect(pair.trace.steps[6])
  tree = render({ current: 2, completedIndex: 1 })
  assert.equal(trace().props.selected.i, 6)
  descendants(tree, el => el.type === 'button' && el.props.children === 'Follow replay')[0].props.onClick()
  tree = render()
  assert.equal(trace().props.selected.i, 2)
  harness.unmount()
})
