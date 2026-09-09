import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
async function load(relative, dependencies = {}) {
  const source = await readFile(new URL(relative, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const module = { exports: {} }
  Function('require', 'module', 'exports', output)((name) => dependencies[name] ?? require(name), module, module.exports)
  return module.exports
}
const guided = await load('../src/lib/guidedSteps.ts')
const workflow = await load('../src/components/PairedWorkflowStrip.tsx', { '../lib/guidedSteps': guided })

function elements(element, predicate) {
  if (!React.isValidElement(element)) return []
  return [
    ...(predicate(element) ? [element] : []),
    ...React.Children.toArray(element.props.children).flatMap((child) => elements(child, predicate)),
  ]
}
function textOf(element) {
  if (!React.isValidElement(element)) return typeof element === 'string' || typeof element === 'number' ? String(element) : ''
  return React.Children.toArray(element.props.children).map(textOf).join(' ')
}
function cards(element) {
  return elements(element, (item) => /^(With|Without) watermark step \d+:/.test(item.props['aria-label'] ?? ''))
}

function assertRecordedLabels(view, steps) {
  const markup = renderToStaticMarkup(view)
  assert.doesNotMatch(markup, /Not yet replayed|Stage not reached/)
  for (const card of cards(view)) {
    const index = Number(card.props['aria-label'].match(/step (\d+):/)[1]) - 1
    const step = steps.find((item) => item.i === index)
    assert.ok(step, 'the rendered row belongs to this arm’s recorded display indices')
    assert.ok(card.props['aria-label'].endsWith(`: ${step.label}`), 'recorded labels are independent of playback/detail access')
    assert.doesNotMatch(card.props.className, /(?:^|\s)(?:disabled:)?opacity-(?!100(?:\s|$))\S+/, 'locked cards remain fully legible')
  }
}

const stageIds = ['briefing', 'identity', 'ppe', 'admission', 'patrol', 'response']
function makePair({ traceCounts = [3, 3, 4, 4, 5, 2], standardCounts = [2, 4, 4, 4, 4, 3] } = {}) {
  function arm(counts, name) {
    const steps = []
    for (let stage = 0; stage < stageIds.length; stage++) {
      for (let position = 0; position < counts[stage]; position++) {
        const i = steps.length
        steps.push({ i, wm_index: i, action: `${name}_${i}`, label: `${name} action ${i + 1}`, stage_id: stageIds[stage],
          policy_source: 'scenario_policy', event_kind: 'agent_action', detector_eligible: true,
          result: `${name}_RESULT_${i}`, distribution: [{ cmd: `${name}_${i}`, label: `${name} action ${i + 1}`, p: .6 }, { cmd: `other_${i}`, label: 'Other action', p: .4 }], race: [],
        })
      }
    }
    return { steps, success: false, required_done: steps.length, required_total: steps.length }
  }
  return {
    game_id: 'playback-test-only', task_type: 'construction_ppe_shift', synthetic: true,
    provenance: { policy_source: 'scenario_policy' }, stages: guided.SHIFT_PHASES,
    trace: arm(traceCounts, 'TRACE'), standard: arm(standardCounts, 'BASELINE'),
    agreement: { same: 0, of: 21 },
  }
}

/** Exercise the real component callbacks and effects without introducing a
 * browser dependency. A new harness models React's key-triggered remount. */
async function interactiveWorkflow(initial = {}) {
  let cursor = 0
  const slots = new Map()
  let pendingEffects = []
  let dirty = false
  const events = { toggles: [], follows: 0 }
  const sameDeps = (left, right) => !!left && !!right && left.length === right.length && left.every((value, i) => Object.is(value, right[i]))
  const hooks = {
    ...React,
    useState(initialValue) {
      const index = cursor++
      if (!slots.has(index)) slots.set(index, { value: typeof initialValue === 'function' ? initialValue() : initialValue })
      return [slots.get(index).value, (next) => {
        const slot = slots.get(index)
        const value = typeof next === 'function' ? next(slot.value) : next
        if (!Object.is(value, slot.value)) { slot.value = value; dirty = true }
      }]
    },
    useEffect(effect, deps) {
      const index = cursor++
      const previous = slots.get(index)
      if (!previous || !sameDeps(previous.deps, deps)) {
        const slot = { deps, cleanup: previous?.cleanup }
        slots.set(index, slot)
        pendingEffects.push(() => { slot.cleanup?.(); slot.cleanup = effect() })
      }
    },
    useMemo(compute, deps) {
      const index = cursor++
      const previous = slots.get(index)
      if (!previous || !sameDeps(previous.deps, deps)) slots.set(index, { deps, value: compute() })
      return slots.get(index).value
    },
    useCallback(callback, deps) { return hooks.useMemo(callback, deps) },
    useRef(value) {
      const index = cursor++
      if (!slots.has(index)) slots.set(index, { current: value })
      return slots.get(index)
    },
  }
  const subject = await load('../src/components/PairedWorkflowStrip.tsx', { react: hooks, '../lib/guidedSteps': guided })
  const data = initial.pair ?? makePair()
  let props = {
    pair: data, phases: guided.buildWorkflow(data.trace.steps, 'hse', data.task_type, data.stages),
    current: -1, running: false, expanded: null, followReplay: false,
    onToggle: (id) => { events.toggles.push(id); props = { ...props, expanded: id, followReplay: false } },
    onFollow: () => { events.follows++; props = { ...props, expanded: null, followReplay: true } },
    ...initial,
  }
  function render(patch = {}) {
    props = { ...props, ...patch }
    for (let pass = 0; pass < 8; pass++) {
      cursor = 0; pendingEffects = []; dirty = false
      const tree = subject.default(props)
      for (const effect of pendingEffects) effect()
      if (!dirty) return tree
    }
    assert.fail('Workflow effects failed to settle')
  }
  const window = (tree, source = 'trace') => elements(tree, (element) => element.type === subject.ActionWindow && element.props.source === source)[0]
  const inspectors = (tree) => elements(tree, (element) => element.type === subject.DecisionInspector)
  return { render, window, inspectors, subject, events, get props() { return props } }
}

test('active TRACE marker follows the running action even while its inspector is locked', () => {
  const data = makePair()
  const view = workflow.ActionWindow({ indices: [0, 1, 2, 3, 4], steps: data.trace.steps, focus: 2,
    source: 'trace', selectedSource: null, current: 2, running: true,
    canInspect: (i) => workflow.canInspectAction(data.task_type, 'trace', i, 2, true, 21), onSelect() {},
  })
  const active = cards(view).filter((card) => card.props['data-active'] === true || card.props['data-active'] === 'true')
  assert.equal(active.length, 1)
  assert.equal(active[0].props['aria-current'], 'step')
  assert.match(active[0].props['aria-label'], /^With watermark step 3:/)
  assert.equal(active[0].props.disabled, true, 'active is not permission to open decision details')
  assert.match(textOf(active[0]), /TRACE action 3/, 'the active marker is separate from recorded-name visibility')
  assertRecordedLabels(view, data.trace.steps)
  assert.match(renderToStaticMarkup(view), /TRACE action 4/)
  assert.doesNotMatch(renderToStaticMarkup(view), /TRACE_RESULT|BASELINE_RESULT/)
})

test('baseline and a stopped TRACE never claim the robot’s active-step marker', () => {
  const data = makePair()
  for (const option of [{ source: 'standard', running: true }, { source: 'trace', running: false }, { source: 'trace' }]) {
    const view = workflow.ActionWindow({ indices: [0, 1, 2], steps: data[option.source].steps, focus: 1,
      selectedSource: option.source, current: 1, onSelect() {}, ...option })
    assert.equal(cards(view).some((card) => card.props['aria-current'] === 'step' || card.props['data-active'] === true || card.props['data-active'] === 'true'), false)
  }
})

test('TRACE and baseline use equal bounded slots without stretching a short stage across the row', () => {
  const data = makePair()
  data.trace.steps[0].label = 'A very long action label should never grow this card or squeeze its neighbours'
  for (const source of ['trace', 'standard']) {
    for (const length of [1, 2, 3]) {
      const view = workflow.ActionWindow({ indices: Array.from({ length }, (_, i) => i), steps: data[source].steps,
        focus: 0, source, selectedSource: source, current: -1, running: false, onSelect() {} })
      const slots = elements(view, (element) => element.props['data-workflow-slot'] !== undefined)
      assert.equal(slots.length, length)
      const grid = elements(view, (element) => element.props['data-workflow-slots'] === source)[0]
      assert.equal(grid.props.style.gridTemplateColumns, `repeat(${length}, minmax(0, 1fr))`)
      assert.equal(grid.props.style.maxWidth, length * 240 + (length - 1) * 12, 'width depends on visible slots, never label length')
      for (const card of cards(view)) {
        assert.match(card.props.className, /\bh-12\b/)
        assert.ok(/\bw-full\b/.test(card.props.className), 'card uses its equal-width slot')
        assert.ok(/max-w/.test(card.props.className) || slots.some((slot) => /max-w/.test(slot.props.className ?? '')), 'card or slot has a width bound')
      }
      assert.equal(cards(view).length, length)
    }
  }
})

test('following replay overrides stale manual phase/focus and tracks each new robot action', async () => {
  const harness = await interactiveWorkflow({ followReplay: true, expanded: 'briefing', current: 11, running: true })
  let tree = harness.render()
  let trace = harness.window(tree)
  assert.deepEqual(trace.props.indices, [10, 11, 12, 13], 'follows actual admission phase, not stale expanded briefing')
  assert.equal(trace.props.focus, 11)
  assert.equal(trace.props.running, true)
  tree = harness.render({ current: 12 })
  assert.equal(harness.window(tree).props.focus, 12)
  tree = harness.render({ current: 14 })
  trace = harness.window(tree)
  assert.deepEqual(trace.props.indices, [14, 15, 16, 17, 18])
  assert.equal(trace.props.focus, 14)
  assert.equal(harness.inspectors(tree).length, 0, 'following never auto-opens a future inspector')
})

test('main workflow uses six compact equal stage cards', async () => {
  const harness = await interactiveWorkflow({ followReplay: true, current: 11, running: true })
  const tree = harness.render()
  const grids = elements(tree, (element) => element.props['data-workflow-phases'] !== undefined)
  assert.equal(grids.length, 1)
  assert.match(grids[0].props.className, /max-w-\[960px\]/)
  const stages = elements(tree, (element) => element.props['data-workflow-phase'] !== undefined)
  assert.deepEqual(stages.map((stage) => stage.props['data-workflow-phase']), stageIds)
  const wrappers = elements(tree, (element) => /min-w-\[112px\]/.test(element.props.className ?? '') && /max-w-\[144px\]/.test(element.props.className ?? ''))
  assert.equal(wrappers.length, 6, 'stage widths share the same lower and upper bound')
  for (const stage of stages) {
    assert.match(stage.props.className, /\bh-11\b/)
    assert.match(stage.props.className, /\bw-full\b/)
  }
})

test('manual inspection pauses follow once, preserves browsing as the robot advances, and resumes on close', async () => {
  const harness = await interactiveWorkflow({ followReplay: true, current: 12, running: true })
  let tree = harness.render()
  harness.window(tree).props.onSelect('trace', 10)
  tree = harness.render()
  assert.deepEqual(harness.events.toggles, ['admission'])
  assert.equal(harness.props.followReplay, false)
  assert.equal(harness.window(tree).props.focus, 10)
  assert.equal(harness.inspectors(tree)[0]?.props.step.i, 10)
  harness.window(tree).props.onSelect('trace', 11)
  tree = harness.render({ current: 14 })
  assert.deepEqual(harness.events.toggles, ['admission'], 'already browsing does not repin the phase on every click')
  assert.equal(harness.window(tree).props.focus, 11)
  assert.deepEqual(harness.window(tree).props.indices, [10, 11, 12, 13])
  harness.inspectors(tree)[0].props.onClose()
  tree = harness.render()
  assert.equal(harness.events.follows, 1)
  assert.equal(harness.props.followReplay, true)
  assert.equal(harness.window(tree).props.focus, 14)
  assert.equal(harness.inspectors(tree).length, 0)
})

test('Follow replay clears manual inspection and returns to the current phase and action', async () => {
  const harness = await interactiveWorkflow({ followReplay: true, current: 12, running: true })
  let tree = harness.render()
  harness.window(tree).props.onSelect('trace', 10)
  tree = harness.render({ current: 15 })
  const follow = elements(tree, (element) => element.type === 'button' && /Follow replay/.test(textOf(element)))[0]
  assert.ok(follow, 'manual browsing exposes an explicit follow control')
  follow.props.onClick()
  tree = harness.render()
  assert.equal(harness.events.follows, 1)
  assert.equal(harness.window(tree).props.focus, 15)
  assert.deepEqual(harness.window(tree).props.indices, [14, 15, 16, 17, 18])
  assert.equal(harness.inspectors(tree).length, 0)
})

test('clicking a main phase explicitly browses that phase until Follow replay is resumed', async () => {
  const harness = await interactiveWorkflow({ followReplay: true, current: 12, running: true })
  let tree = harness.render()
  const briefing = elements(tree, (element) => element.props['data-workflow-phase'] === 'briefing')[0]
  briefing.props.onClick()
  tree = harness.render({ current: 14 })
  assert.equal(harness.props.followReplay, false)
  assert.deepEqual(harness.window(tree).props.indices, [0, 1, 2])
  const follow = elements(tree, (element) => element.type === 'button' && /Follow replay/.test(textOf(element)))[0]
  follow.props.onClick()
  tree = harness.render()
  assert.deepEqual(harness.window(tree).props.indices, [14, 15, 16, 17, 18])
  assert.equal(harness.window(tree).props.focus, 14)
})

test('following and active markers never unlock current/future results or the unplayed baseline', async () => {
  const harness = await interactiveWorkflow({ followReplay: true, current: 12, running: true })
  let tree = harness.render()
  harness.window(tree).props.onSelect('trace', 12)
  tree = harness.render()
  assert.equal(harness.inspectors(tree).length, 0)
  assert.doesNotMatch(renderToStaticMarkup(tree), /TRACE_RESULT_12|BASELINE_RESULT|Result at that time/)
  harness.window(tree, 'standard').props.onSelect('standard', 10)
  tree = harness.render()
  assert.equal(harness.inspectors(tree).length, 0)
  tree = harness.render({ current: 20, running: false })
  harness.window(tree, 'standard').props.onSelect('standard', 10)
  tree = harness.render()
  assert.equal(harness.inspectors(tree)[0]?.props.source, 'standard', 'baseline can be inspected after TRACE completes')
})

test('a keyed replay restart gets a fresh unselected workflow and App keys it by sample plus run epoch', async () => {
  const previous = await interactiveWorkflow({ followReplay: true, current: 12, running: true })
  let tree = previous.render()
  previous.window(tree).props.onSelect('trace', 10)
  assert.equal(previous.inspectors(previous.render()).length, 1)
  const restarted = await interactiveWorkflow({ pair: previous.props.pair, followReplay: true, current: -1, running: false })
  tree = restarted.render()
  assert.equal(restarted.inspectors(tree).length, 0)
  assert.equal(restarted.window(tree).props.focus, 0)
  assert.doesNotMatch(renderToStaticMarkup(tree), /TRACE_RESULT|BASELINE_RESULT/)
  const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const keys = []
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === 'PairedWorkflowStrip') {
      const key = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'key')
      if (key) keys.push(key.getText(ast))
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(keys.length > 0)
  for (const key of keys) { assert.match(key, /gameId/); assert.match(key, /reviewEpoch/) }
})

test('recorded baseline preview reveals only labels, never active status or locked decision details', () => {
  const data = makePair()
  data.standard.steps[1] = { ...data.standard.steps[1], label: 'Recorded controller override',
    event_kind: 'injected_action', policy_source: 'fault_injection', detector_eligible: false, distribution: [], race: [],
    fault: { description: 'SECRET_FAULT_DETAIL' }, result: 'SECRET_CONTROLLER_RESULT',
  }
  const calls = []
  const view = workflow.ActionWindow({ indices: [0, 1], steps: data.standard.steps, focus: 1,
    source: 'standard', selectedSource: 'standard', current: 1, running: true,
    canInspect: () => false, onSelect: (...args) => calls.push(args),
  })
  const previewCards = cards(view)
  assertRecordedLabels(view, data.standard.steps)
  assert.equal(previewCards.length, 2)
  assert.match(textOf(previewCards[0]), /BASELINE action 1/)
  assert.match(textOf(previewCards[1]), /Recorded controller override/)
  assert.match(textOf(previewCards[1]), /Controller · excluded/)
  for (const card of previewCards) {
    assert.equal(card.props.disabled, true)
    assert.equal(card.props['aria-current'], undefined)
    assert.ok(!card.props['data-active'])
    card.props.onClick()
  }
  assert.deepEqual(calls, [], 'disabled recorded labels cannot open any inspector, including injected transactions')
  const markup = renderToStaticMarkup(view)
  assert.match(markup, /Recorded comparison · details after replay/)
  assert.doesNotMatch(markup, /SECRET_FAULT_DETAIL|SECRET_CONTROLLER_RESULT|BASELINE_RESULT|60\.0%|Keyed score|Result at that time/)
})

test('both recorded arms show names before playback without requiring a visibility prop', () => {
  const data = makePair()
  const common = { indices: [1], focus: 1, selectedSource: null, current: -1, running: false, canInspect: () => false, onSelect() {} }
  const baseline = workflow.ActionWindow({ ...common, source: 'standard', steps: data.standard.steps })
  assertRecordedLabels(baseline, data.standard.steps)
  assert.match(renderToStaticMarkup(baseline), /BASELINE action 2/)
  const trace = workflow.ActionWindow({ ...common, source: 'trace', steps: data.trace.steps })
  assertRecordedLabels(trace, data.trace.steps)
  assert.match(renderToStaticMarkup(trace), /TRACE action 2/)
  assert.match(renderToStaticMarkup(trace), /Recorded actions · replay highlighted/)
  for (const view of [trace, baseline]) {
    assert.ok(cards(view).every((card) => card.props.disabled))
    assert.doesNotMatch(renderToStaticMarkup(view), /TRACE_RESULT|BASELINE_RESULT|Keyed score|Result at that time/)
  }
})

test('current and past phases expose stage-aligned baseline labels even with unequal arm lengths', async () => {
  const data = makePair({ standardCounts: [6, 4, 1, 1, 1, 1] })
  const harness = await interactiveWorkflow({ pair: data, followReplay: true, current: 3, running: true })
  let tree = harness.render()
  let baseline = harness.window(tree, 'standard')
  assert.deepEqual(harness.window(tree).props.indices, [3, 4, 5], 'TRACE has entered identity')
  assert.deepEqual(baseline.props.indices, [6, 7, 8, 9], 'baseline retains its own identity-stage positions')
  let view = harness.subject.ActionWindow(baseline.props)
  assertRecordedLabels(view, data.standard.steps)
  assert.match(renderToStaticMarkup(view), /BASELINE action 7/)
  assert.ok(cards(view).every((card) => card.props.disabled), 'baseline indices beyond TRACE current are labels only')
  baseline.props.onSelect('standard', 9)
  tree = harness.render()
  baseline = harness.window(tree, 'standard')
  assert.equal(baseline.props.focus, 9, 'pagination/browsing can reach all recorded labels within this stage')
  assert.equal(harness.inspectors(tree).length, 0)
  assert.match(renderToStaticMarkup(harness.subject.ActionWindow(baseline.props)), /BASELINE action 10/)
  tree = harness.render({ current: 14, expanded: 'briefing', followReplay: false })
  baseline = harness.window(tree, 'standard')
  assert.deepEqual(baseline.props.indices, [0, 1, 2, 3, 4, 5])
  view = harness.subject.ActionWindow(baseline.props)
  assert.match(renderToStaticMarkup(view), /BASELINE action 1/)
  assert.ok(cards(view).every((card) => card.props.disabled))
})

test('future shared phases show both recorded trajectories without borrowing the other arm’s cursor', async () => {
  const data = makePair({ standardCounts: [6, 4, 1, 1, 1, 1] })
  const harness = await interactiveWorkflow({ pair: data, followReplay: false, expanded: 'response', current: 18, running: true })
  const tree = harness.render()
  const baseline = harness.window(tree, 'standard')
  assert.deepEqual(baseline.props.indices, [13], 'baseline response index is lower than current TRACE patrol index 18')
  const baselineView = harness.subject.ActionWindow(baseline.props)
  const traceView = harness.subject.ActionWindow(harness.window(tree).props)
  assertRecordedLabels(baselineView, data.standard.steps)
  assertRecordedLabels(traceView, data.trace.steps)
  assert.match(renderToStaticMarkup(baselineView), /BASELINE action 14/)
  assert.match(renderToStaticMarkup(traceView), /TRACE action 20/)
  assert.ok([...cards(baselineView), ...cards(traceView)].every((card) => card.props.disabled))
  assert.doesNotMatch(renderToStaticMarkup(tree), /BASELINE_RESULT|TRACE_RESULT|Keyed score|Result at that time/)
  assert.equal(harness.inspectors(tree).length, 0)
})

test('baseline names survive prestart and reset while completion alone unlocks recorded comparison details', async () => {
  const harness = await interactiveWorkflow({ followReplay: true, current: -1, running: false })
  let tree = harness.render()
  let baseline = harness.window(tree, 'standard')
  assertRecordedLabels(harness.subject.ActionWindow(baseline.props), harness.props.pair.standard.steps)
  assert.match(renderToStaticMarkup(harness.subject.ActionWindow(baseline.props)), /BASELINE action/)
  tree = harness.render({ current: 0, running: true })
  baseline = harness.window(tree, 'standard')
  assertRecordedLabels(harness.subject.ActionWindow(baseline.props), harness.props.pair.standard.steps)
  assert.ok(cards(harness.subject.ActionWindow(baseline.props)).every((card) => card.props.disabled))
  tree = harness.render({ current: 20, running: false })
  baseline = harness.window(tree, 'standard')
  const completeView = harness.subject.ActionWindow(baseline.props)
  assertRecordedLabels(completeView, harness.props.pair.standard.steps)
  assert.match(renderToStaticMarkup(completeView), /Recorded comparison · click for details/)
  assert.ok(cards(completeView).every((card) => !card.props.disabled))
  baseline.props.onSelect('standard', baseline.props.indices[0])
  assert.equal(harness.inspectors(harness.render()).length, 1)
  tree = harness.render({ current: -1, running: false, followReplay: true, expanded: null })
  baseline = harness.window(tree, 'standard')
  assertRecordedLabels(harness.subject.ActionWindow(baseline.props), harness.props.pair.standard.steps)
  assert.equal(harness.inspectors(tree).length, 0)
  assert.match(renderToStaticMarkup(tree), /BASELINE action/)
  assert.doesNotMatch(renderToStaticMarkup(tree), /BASELINE_RESULT|TRACE_RESULT|Keyed score|Result at that time/)
})

test('recorded baseline previews never unlock final site outcomes or decision inspectors', async () => {
  const data = makePair()
  for (const arm of [data.trace, data.standard]) arm.report = {
    status: 'completed', facts: {}, decision: { action: 'SECRET_FINAL_ADMISSION', verdict: 'SECRET_FINAL_VERDICT' },
    world_events: [{ id: 'event', kind: 'foot_injury', title: 'SECRET_FINAL_SITE_OUTCOME' }],
  }
  const harness = await interactiveWorkflow({ pair: data, followReplay: true, current: 12, running: true })
  let tree = harness.render()
  const baseline = harness.window(tree, 'standard')
  assertRecordedLabels(harness.subject.ActionWindow(baseline.props), data.standard.steps)
  baseline.props.onSelect('standard', 10)
  tree = harness.render()
  assert.equal(harness.inspectors(tree).length, 0)
  const markup = renderToStaticMarkup(tree)
  assert.match(markup, /BASELINE action 11/)
  assert.doesNotMatch(markup, /BASELINE_RESULT|SECRET_FINAL_ADMISSION|SECRET_FINAL_VERDICT|SECRET_FINAL_SITE_OUTCOME|Keyed score|Result at that time/)
})

test('recorded labels remain consistent across every phase, future browsing, completion and replay restart', async () => {
  const data = makePair({ standardCounts: [6, 4, 1, 1, 1, 1] })
  const harness = await interactiveWorkflow({ pair: data, followReplay: false })
  for (const playback of [{ current: -1, running: false }, { current: 10, running: true }, { current: 20, running: false }, { current: -1, running: false }]) {
    for (const stage of stageIds) {
      const tree = harness.render({ ...playback, expanded: stage, followReplay: false })
      for (const source of ['trace', 'standard']) {
        const window = harness.window(tree, source)
        assert.deepEqual(window.props.indices, data[source].steps.filter((step) => step.stage_id === stage).map((step) => step.i))
        const view = harness.subject.ActionWindow(window.props)
        assertRecordedLabels(view, data[source].steps)
        if (source === 'standard') assert.ok(cards(view).every((card) => !card.props['data-active'] && card.props['aria-current'] === undefined))
      }
      assert.equal(harness.inspectors(tree).length, 0, 'viewing a recorded phase never auto-opens detail')
      assert.doesNotMatch(renderToStaticMarkup(tree), /TRACE_RESULT|BASELINE_RESULT|Keyed score|Result at that time/)
    }
  }
})

test('TRACE captions reflect detail availability rather than suppressing recorded labels', () => {
  const data = makePair()
  for (const available of [false, true]) {
    const view = workflow.ActionWindow({ indices: [0, 1], steps: data.trace.steps, source: 'trace', focus: 0,
      selectedSource: null, current: available ? 20 : -1, running: false, canInspect: () => available, onSelect() {} })
    assertRecordedLabels(view, data.trace.steps)
    assert.ok(renderToStaticMarkup(view).includes(available ? 'Recorded actions · click for details' : 'Recorded actions · replay highlighted'))
  }
})
