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
  Function('require', 'module', 'exports', code)(name => dependencies[name] ?? require(name), module, module.exports)
  return module.exports
}

const paths = await load('../src/lib/ppePaths.ts')
const ppe = await load('../src/lib/ppeInspection.ts')
const playback = await load('../src/lib/ppePlayback.ts', { './ppeInspection': ppe })
const componentDependencies = {
  '../lib/ppePaths': paths, '../lib/ppeInspection': ppe, '../lib/ppePlayback': playback,
  './PPEChoiceComparison': { __esModule: true, default: () => null },
  'framer-motion': { useReducedMotion: () => false }, './PPEActionPaths.css': {},
}
const component = await load('../src/components/PPEActionPaths.tsx', componentDependencies)
const pairs = await Promise.all(['CS01', 'CS02'].map(async id => JSON.parse(await readFile(new URL(`../public/static/compare/hse_ppe-${id}.json`, import.meta.url), 'utf8'))))

function freezeRecord(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) freezeRecord(child)
  }
  return value
}

test('path colors describe the work, rather than the office or camera used to perform it', () => {
  const category = (action, mode = 'tablet') => paths.ppeActionCategory({ action, scene_action: { mode, target: 'tablet', duration_ms: 1 } })
  assert.equal(category('worker_identity method=desk'), 'read')
  assert.equal(category('request_correction method=desk'), 'follow')
  assert.equal(category('request_correction method=tablet'), 'follow')
  assert.equal(category('submit_report method=desk'), 'save')
  assert.equal(category('submit_report method=form'), 'save')
  assert.equal(category('initial_workwear method=camera'), 'check', 'viewing an existing close-up still checks equipment')
  assert.equal(category('current_shoe_condition method=camera'), 'check')
  assert.equal(category('change_confirmation method=record', 'rectify'), 'follow', 'reading a reply does not assert that equipment was changed')
  assert.equal(category('change_confirmation method=desk', 'rectify'), 'follow')
})

test('pass, fail and pending conclusions share a neutral save category and color', () => {
  const categories = ['pass', 'fail', 'hold'].map(result => paths.ppeActionCategory({ action: `record_ppe_${result}` }))
  assert.deepEqual(categories, ['save', 'save', 'save'])
  assert.equal(new Set(categories.map(category => paths.PPE_ACTION_CATEGORIES[category].color)).size, 1)
})

test('both real cases retain every recorded step, order and command while methods share task colors', () => {
  const byRequirement = new Map()
  for (const pair of pairs) {
    const original = JSON.stringify(pair)
    freezeRecord(pair)
    for (const source of ['standard', 'trace']) {
      assert.equal(pair[source].steps.length, 24)
      for (const step of pair[source].steps) {
        const category = paths.ppeActionCategory(step)
        assert.ok(paths.PPE_ACTION_CATEGORIES[category], `known category for ${source} ${step.action}`)
        if (byRequirement.has(step.requirement_id)) assert.equal(category, byRequirement.get(step.requirement_id), `${step.requirement_id} retains its meaning across case, order and method changes`)
        else byRequirement.set(step.requirement_id, category)
      }
    }
    assert.equal(JSON.stringify(pair), original)
  }
  assert.equal(byRequirement.size, 24)
  assert.notEqual(pairs[0].standard.steps[2].requirement_id, pairs[0].trace.steps[2].requirement_id, 'fixture contains real reordering, not two copies of one sequence')
})

for (const [caseIndex, expected] of [[0, { method: 8, order: 11, either: 15 }], [1, { method: 15, order: 8, either: 17 }]]) {
  const pair = pairs[caseIndex]
  test(`${pair.game_id}: difference counts come from matched actions and their real positions`, () => {
    const original = JSON.stringify(pair)
    const differences = paths.ppePathDifferences(pair)
    for (const source of ['standard', 'trace']) {
      const other = source === 'standard' ? 'trace' : 'standard'
      assert.deepEqual([...differences[source].keys()], pair[source].steps.map(step => step.i))
      const values = [...differences[source].values()]
      assert.equal(values.filter(value => value.methodChanged).length, expected.method)
      assert.equal(values.filter(value => value.orderChanged).length, expected.order)
      assert.equal(values.filter(value => value.methodChanged || value.orderChanged).length, expected.either)
      assert.equal(values.filter(value => value.missing).length, 0)
      for (const [index, step] of pair[source].steps.entries()) {
        const difference = differences[source].get(step.i)
        const counterpartIndex = pair[other].steps.findIndex(item => item.requirement_id === step.requirement_id)
        assert.equal(difference.counterpart, pair[other].steps[counterpartIndex])
        assert.equal(difference.stepNumber, index + 1)
        assert.equal(difference.counterpartStepNumber, counterpartIndex + 1)
      }
    }
    assert.equal(JSON.stringify(pair), original)
  })
}

function shortPair() {
  const pair = structuredClone(pairs[0])
  pair.standard.steps = pair.standard.steps.slice(0, 3)
  pair.trace.steps = structuredClone(pair.standard.steps)
  return pair
}

test('reordered actions align by requirement and retain non-contiguous record indices', () => {
  const pair = shortPair()
  pair.standard.steps.forEach((step, index) => { step.i = [100, 300, 900][index] })
  pair.trace.steps.reverse()
  pair.trace.steps.forEach((step, index) => { step.i = [7, 18, 42][index] })
  const original = JSON.stringify(pair)
  freezeRecord(pair)
  const differences = paths.ppePathDifferences(pair)
  assert.deepEqual([...differences.standard.keys()], [100, 300, 900])
  assert.deepEqual([...differences.trace.keys()], [7, 18, 42])
  for (const [standardIndex, traceIndex] of [[0, 2], [1, 1], [2, 0]]) {
    const standard = pair.standard.steps[standardIndex], trace = pair.trace.steps[traceIndex]
    const a = differences.standard.get(standard.i), b = differences.trace.get(trace.i)
    assert.equal(a.counterpart, trace)
    assert.equal(b.counterpart, standard)
    assert.equal(a.methodChanged, false)
    assert.equal(b.methodChanged, false)
    assert.equal(a.orderChanged, standardIndex !== traceIndex)
    assert.equal(b.orderChanged, standardIndex !== traceIndex)
    assert.equal(a.stepNumber, standardIndex + 1)
    assert.equal(a.counterpartStepNumber, traceIndex + 1)
    assert.equal(b.stepNumber, traceIndex + 1)
    assert.equal(b.counterpartStepNumber, standardIndex + 1)
  }
  assert.equal(JSON.stringify(pair), original)
})

test('a missing counterpart is explicit, including when the entire other path is absent', () => {
  const pair = shortPair()
  const absent = pair.standard.steps[1]
  pair.trace.steps = pair.trace.steps.filter(step => step.requirement_id !== absent.requirement_id)
  let differences = paths.ppePathDifferences(pair)
  const missing = differences.standard.get(absent.i)
  assert.equal(missing.missing, true)
  assert.equal(missing.counterpart, undefined)
  assert.equal(missing.counterpartStepNumber, undefined)
  assert.equal(missing.stepNumber, 2)
  for (const step of pair.trace.steps) {
    const difference = differences.trace.get(step.i)
    assert.equal(difference.missing, false)
    assert.equal(difference.counterpart.requirement_id, step.requirement_id)
  }
  pair.trace.steps = []
  differences = paths.ppePathDifferences(freezeRecord(pair))
  assert.equal(differences.trace.size, 0)
  assert.equal(differences.standard.size, pair.standard.steps.length)
  for (const difference of differences.standard.values()) {
    assert.equal(difference.missing, true)
    assert.equal(difference.counterpart, undefined)
  }
})

test('confirmation counts and findings do not create a method or order change', () => {
  const pair = shortPair()
  for (const [index, step] of pair.standard.steps.entries()) {
    step.k = 1
    pair.trace.steps[index].k = 2
    pair.trace.steps[index].result = 'A different recorded finding does not change the selected action.'
  }
  const differences = paths.ppePathDifferences(freezeRecord(pair))
  for (const source of ['standard', 'trace']) for (const difference of differences[source].values()) {
    assert.equal(difference.methodChanged, false)
    assert.equal(difference.orderChanged, false)
    assert.equal(difference.missing, false)
  }
})

const armName = source => source === 'trace' ? 'With watermark' : 'Without watermark'
function propsFor(pair, patch = {}) {
  return {
    pair, selected: playback.matchedRequirement(pair, pair.standard.steps[0].requirement_id),
    playback: null, current: -1, completedIndex: -1, running: false, revealed: () => false, onSelect() {}, ...patch,
  }
}
function renderPaths(pair, patch) {
  return renderToStaticMarkup(React.createElement(component.default, propsFor(pair, patch)))
}
function decode(value) {
  return value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, entity => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'",
  })[entity])
}
function attribute(markup, name) {
  return decode(markup.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '')
}
function nodes(markup) {
  return [...markup.matchAll(/<g\b[^>]*\bdata-path-arm="[^"]*"[^>]*>[\s\S]*?<\/g>/g)].map(match => ({
    source: attribute(match[0], 'data-path-arm'), index: Number(attribute(match[0], 'data-action-index')),
    label: attribute(match[0], 'aria-label'), current: attribute(match[0], 'aria-current'), markup: match[0],
  }))
}
function nodeCircle(node) {
  const circle = node.markup.match(/<circle\b[^>]*\bclass="pap-node"[^>]*>/)?.[0]
  assert.ok(circle, `${node.source} action ${node.index} has an action dot`)
  return { radius: Number(attribute(circle, 'r')), fill: attribute(circle, 'fill') }
}
function changeRings(node) {
  return [...node.markup.matchAll(/<circle\b[^>]*\bclass="pap-change-ring"[^>]*>/g)].map(match => match[0])
}
function assertPositionMarkers(html) {
  const markers = [...html.matchAll(/<g\b[^>]*\bclass="pap-marker"[^>]*>([\s\S]*?)<\/g>/g)]
  assert.equal(markers.length, 2)
  for (const [, markup] of markers) {
    assert.doesNotMatch(markup, /<circle\b/, 'selection must not add a circle that could be mistaken for a method difference')
    const positions = [...markup.matchAll(/<path\b[^>]*\bclass="pap-position-marker"[^>]*>/g)]
    assert.equal(positions.length, 1, 'each path retains a distinct position pointer')
    assert.equal(attribute(positions[0][0], 'fill'), '#687684')
    assert.ok(attribute(positions[0][0], 'd'))
  }
}

for (const [caseIndex, expected] of [[0, 8], [1, 15]]) {
  const pair = pairs[caseIndex]
  test(`${pair.game_id}: all action dots retain their size and category color, with rings only for method differences`, () => {
    const html = renderPaths(pair)
    const rendered = nodes(html), differences = paths.ppePathDifferences(pair)
    for (const source of ['standard', 'trace']) {
      const armNodes = rendered.filter(node => node.source === source)
      assert.equal(armNodes.reduce((count, node) => count + changeRings(node).length, 0), expected)
      let orderOnly = 0
      for (const node of armNodes) {
        const difference = differences[source].get(node.index)
        const step = pair[source].steps.find(step => step.i === node.index)
        const color = paths.PPE_ACTION_CATEGORIES[paths.ppeActionCategory(step)].color
        assert.deepEqual(nodeCircle(node), { radius: 5, fill: color }, 'action meaning determines the dot, independently of method and order differences')
        const rings = changeRings(node)
        assert.equal(rings.length, difference.methodChanged || difference.missing ? 1 : 0)
        for (const ring of rings) assert.equal(attribute(ring, 'fill'), 'none', 'a difference ring does not cover the action color')
        if (!difference.methodChanged) {
          if (difference.orderChanged) {
            orderOnly++
            assert.equal(attribute(node.markup, 'data-path-change'), 'order')
          }
        }
      }
      assert.ok(orderOnly > 0, 'the fixture exercises a moved action whose method did not change')
    }
    assertPositionMarkers(html)
  })

  test(`${pair.game_id}: selecting an unchanged action preserves its category dot without adding a difference ring`, () => {
    const differences = paths.ppePathDifferences(pair)
    const unchanged = pair.standard.steps.filter(step => !differences.standard.get(step.i).methodChanged)
    assert.ok(unchanged.some(step => differences.standard.get(step.i).orderChanged))
    assert.ok(unchanged.some(step => !differences.standard.get(step.i).orderChanged))
    for (const step of unchanged) {
      const selected = playback.matchedRequirement(pair, step.requirement_id)
      const html = renderPaths(pair, { selected })
      const active = nodes(html).filter(node => node.current === 'step')
      assert.equal(active.length, 2)
      for (const node of active) {
        assert.equal(node.index, selected[node.source].i)
        const color = paths.PPE_ACTION_CATEGORIES[paths.ppeActionCategory(selected[node.source])].color
        assert.deepEqual(nodeCircle(node), { radius: 5, fill: color })
        assert.equal(changeRings(node).length, 0)
      }
      assertPositionMarkers(html)
    }
  })
}

for (const pair of pairs) {
  test(`${pair.game_id}: both paths expose all original actions in each arm's real order`, () => {
    const original = JSON.stringify(pair)
    const selected = playback.matchedRequirement(pair, 'initial_workwear')
    assert.notEqual(selected.standard.i, selected.trace.i, 'matched checks occupy different recorded positions')
    const html = renderPaths(pair, { selected })
    const rendered = nodes(html)
    assert.equal(rendered.length, pair.standard.steps.length + pair.trace.steps.length)
    for (const source of ['standard', 'trace']) {
      const armNodes = rendered.filter(node => node.source === source)
      assert.deepEqual(armNodes.map(node => node.index), pair[source].steps.map(step => step.i))
      pair[source].steps.forEach((step, position) => {
        const method = ppe.ppeActionMethodLabel(step.action, false)
        assert.equal(armNodes[position].label, `${armName(source)} step ${position + 1}: ${playback.inspectionLabel(step)}${method ? ` · ${method}` : ''}`)
      })
      assert.deepEqual(armNodes.filter(node => node.current === 'step').map(node => node.index), [selected[source].i])
    }
    assert.equal(JSON.stringify(pair), original)
    assert.doesNotMatch(html, /Watermark detected|Matched agent|Source verified|Match found|No watermark found|z-score/i)
    assert.doesNotMatch(html, /Record: passed|Record: not passed|Record: needs review/)
  })

  test(`${pair.game_id}: selected conclusions stay hidden until that specific arm is revealed`, () => {
    const selected = playback.matchedRequirement(pair, 'ppe_conclusion')
    const hidden = renderPaths(pair, { selected, current: 23, completedIndex: 23 })
    assert.doesNotMatch(hidden, /Record: passed|Record: not passed|Record: needs review|Result: passed|Result: not passed|Result: needs review/)
    for (const permitted of ['standard', 'trace']) {
      const html = renderPaths(pair, { selected, revealed: (source, step) => source === permitted && step?.i === selected[permitted].i })
      const rendered = nodes(html)
      for (const source of ['standard', 'trace']) {
        const node = rendered.find(node => node.source === source && node.index === selected[source].i)
        const label = playback.inspectionLabel(selected[source], source === permitted)
        assert.ok(node.label.includes(label))
        if (source === permitted) assert.match(node.label, /Record: passed|Record: not passed|Record: needs review/)
        else assert.doesNotMatch(node.markup, /Record: passed|Record: not passed|Record: needs review|Result: passed|Result: not passed|Result: needs review/)
        const caption = html.match(new RegExp(`<div class="pap-caption" data-arm="${source}"[\\s\\S]*?<div class="pap-action">([\\s\\S]*?)<\\/div>`))?.[1]
        assert.ok(caption, `${source} caption is present`)
        assert.ok(decode(caption).includes(label))
      }
      assert.doesNotMatch(html, /Watermark detected|Matched agent|Source verified|Match found|No watermark found|z-score/i)
    }
  })

  test(`${pair.game_id}: a completed playback cannot replace a newly selected check on the paths`, () => {
    const selected = playback.matchedRequirement(pair, 'initial_workwear')
    const html = renderPaths(pair, {
      selected,
      playback: { caseId: pair.game_id, source: 'standard', index: 0, token: 'earlier-action', status: 'complete' },
    })
    for (const source of ['standard', 'trace']) {
      const active = nodes(html).filter(node => node.source === source && node.current === 'step')
      assert.deepEqual(active.map(node => node.index), [selected[source].i])
    }
  })
}

test('different conclusion outcomes do not leak through method highlighting before both arms are revealed', () => {
  for (const reordered of [false, true]) {
    const pair = structuredClone(pairs[0])
    const conclusionIndex = pair.trace.steps.findIndex(step => step.requirement_id === 'ppe_conclusion')
    pair.trace.steps[conclusionIndex].action = 'record_ppe_fail'
    if (reordered) [pair.trace.steps[conclusionIndex - 1], pair.trace.steps[conclusionIndex]] = [pair.trace.steps[conclusionIndex], pair.trace.steps[conclusionIndex - 1]]
    const selected = playback.matchedRequirement(pair, 'ppe_conclusion')
    assert.equal(selected.standard.action, 'record_ppe_pass')
    assert.equal(selected.trace.action, 'record_ppe_fail')
    freezeRecord(pair)
    for (const permitted of [[], ['standard'], ['trace'], ['standard', 'trace']]) {
      const both = permitted.length === 2
      const html = renderPaths(pair, { selected, revealed: (source, step) => permitted.includes(source) && step?.i === selected[source].i })
      const rendered = nodes(html)
      const status = decode(html.match(/<span class="pap-difference" role="status">([^<]*)<\/span>/)?.[1] ?? '')
      for (const source of ['standard', 'trace']) {
        const node = rendered.find(node => node.source === source && node.index === selected[source].i)
        const change = attribute(node.markup, 'data-path-change')
        if (both) assert.equal(change, reordered ? 'method-order' : 'method')
        else assert.ok(!['method', 'method-order'].includes(change), `${source} outcome must not leak through difference styling`)
        assert.equal(changeRings(node).length, both ? 1 : 0, 'conclusion differences cannot leak through rings before both arms are revealed')
        for (const ring of changeRings(node)) assert.equal(attribute(ring, 'fill'), 'none')
        assert.ok(node.label.includes(playback.inspectionLabel(selected[source], permitted.includes(source))))
        if (!permitted.includes(source)) assert.doesNotMatch(node.markup, /Record: passed|Record: not passed|Result: passed|Result: not passed/)
      }
      if (both) assert.equal(status, reordered ? 'Method & order changed' : 'Different method')
      else assert.doesNotMatch(status, /Different method|Method & order changed/)
    }
  }
})

function descendants(element, predicate) {
  if (!React.isValidElement(element)) return []
  return [...(predicate(element) ? [element] : []), ...React.Children.toArray(element.props.children).flatMap(child => descendants(child, predicate))]
}

test('node click and keyboard selection return the actual arm and step; preview controls do not select or play it', async () => {
  // A single render is enough to inspect these handlers; no animation clock or React state harness is needed.
  const stateWrites = []
  const subject = await load('../src/components/PPEActionPaths.tsx', {
    ...componentDependencies,
    react: {
      ...React, useEffect() {}, useId: () => 'paths-test', useMemo: value => value(), useRef: value => ({ current: value }),
      useState: initial => [typeof initial === 'function' ? initial() : initial, value => stateWrites.push(value)],
    },
  })
  const pair = pairs[1], calls = []
  const tree = subject.default(propsFor(pair, { onSelect: (...args) => calls.push(args) }))
  const controls = descendants(tree, element => element.props['data-path-arm'])
  for (const source of ['standard', 'trace']) {
    const step = pair[source].steps.find(step => step.requirement_id === 'initial_workwear')
    const node = controls.find(element => element.props['data-path-arm'] === source && element.props['data-action-index'] === step.i)
    node.props.onClick()
    assert.equal(calls.at(-1)[0], source)
    assert.equal(calls.at(-1)[1], step)
    for (const key of ['Enter', ' ']) {
      let prevented = false
      node.props.onKeyDown({ key, preventDefault() { prevented = true } })
      assert.equal(prevented, true)
      assert.equal(calls.at(-1)[0], source)
      assert.equal(calls.at(-1)[1], step)
    }
    const count = calls.length
    node.props.onKeyDown({ key: 'Escape', preventDefault() { assert.fail('unrelated keys are untouched') } })
    assert.equal(calls.length, count)
  }
  const count = calls.length
  descendants(tree, element => element.type === 'button' && element.props['aria-label'] === 'Preview paths')[0].props.onClick()
  descendants(tree, element => element.type === 'input' && element.props.type === 'range')[0].props.onChange({ currentTarget: { value: '25' } })
  assert.equal(calls.length, count, 'visual preview never selects or executes an inspection action')
  assert.equal(stateWrites.at(-1).progress, 25)
})
