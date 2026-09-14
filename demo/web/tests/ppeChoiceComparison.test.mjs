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
  Function('require', 'module', 'exports', 'fetch', code)(name => dependencies[name] ?? require(name), module, module.exports,
    () => assert.fail('the illustration must not run a model or detector'))
  return module.exports
}

const ppe = await load('../src/lib/ppeInspection.ts')
const playback = await load('../src/lib/ppePlayback.ts', { './ppeInspection': ppe })
const choices = await load('../src/lib/ppeChoiceComparison.ts', { './ppePlayback': playback, './ppeInspection': ppe })
const component = await load('../src/components/PPEChoiceComparison.tsx', {
  '../lib/ppeChoiceComparison': choices,
  '../lib/ppeChoiceArt': { choiceArt: art => ({ src: `/test-choice-art/${art}.png`, position: '0% 0%' }) },
  './PPEChoiceComparison.css': {},
})
const pairs = await Promise.all(['CS01', 'CS02'].map(async id => JSON.parse(await readFile(new URL(`../public/static/compare/hse_ppe-${id}.json`, import.meta.url), 'utf8'))))
const hidden = () => false

function freezeRecord(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) freezeRecord(child)
  }
  return value
}

for (const [caseIndex, expected] of [[0, 8], [1, 15]]) {
  const pair = pairs[caseIndex]
  test(`${pair.game_id}: every real method difference uses its own recorded choices and the actual selected command`, () => {
    const original = JSON.stringify(pair)
    freezeRecord(pair)
    let differences = 0, moved = 0
    for (const step of pair.standard.steps) {
      const selected = playback.matchedRequirement(pair, step.requirement_id)
      if (selected.standard.action === selected.trace.action) continue
      const comparison = choices.buildPPEChoiceComparison(selected, hidden)
      assert.ok(comparison?.changed)
      assert.notEqual(comparison.arms.standard.options.find(option => option.selected).art,
        comparison.arms.trace.options.find(option => option.selected).art,
        'different methods must have visually different illustrations, not just different captions')
      differences++
      if (selected.standard.i !== selected.trace.i) moved++
      for (const source of ['standard', 'trace']) {
        const actual = selected[source], options = comparison.arms[source].options
        const expectedActions = new Set(actual.distribution.filter(candidate => candidate.p > 0 && candidate.cmd.startsWith(`${actual.requirement_id} method=`)).map(candidate => candidate.cmd))
        expectedActions.add(actual.action)
        assert.deepEqual(new Set(options.map(option => option.action)), expectedActions)
        assert.equal(comparison.arms[source].stepNumber, actual.i + 1)
        assert.deepEqual(options.filter(option => option.selected).map(option => option.action), [actual.action])
        for (const option of options) {
          assert.ok(option.label, 'every choice has a plain-language method label')
          assert.ok(option.art, 'every choice requests an illustration')
        }
      }
    }
    assert.equal(differences, expected)
    assert.ok(moved > 0, 'actual method comparisons include requirements at different step positions')
    assert.equal(JSON.stringify(pair), original)
  })
}

test('candidate illustrations do not borrow options from the other arm or another requirement', () => {
  const selected = structuredClone(playback.matchedRequirement(pairs[0], 'worker_identity'))
  const standard = selected.standard, trace = selected.trace
  standard.distribution = [
    { cmd: standard.action, label: 'Own chosen identity record', p: 1 },
    { cmd: trace.action, label: 'Unavailable here', p: 0 },
    { cmd: 'work_assignment method=record', label: 'Different requirement', p: 1 },
  ]
  trace.distribution = [{ cmd: trace.action, label: 'Own office query', p: 1 }]
  const comparison = choices.buildPPEChoiceComparison(freezeRecord(selected), hidden)
  assert.deepEqual(comparison.arms.standard.options.map(option => option.action), [standard.action])
  assert.deepEqual(comparison.arms.trace.options.map(option => option.action), [trace.action])
})

test('an executed choice remains visible when its candidate distribution was not saved', () => {
  const selected = structuredClone(playback.matchedRequirement(pairs[0], 'worker_identity'))
  selected.standard.distribution = []
  const comparison = choices.buildPPEChoiceComparison(freezeRecord(selected), hidden)
  assert.deepEqual(comparison.arms.standard.options.map(option => [option.action, option.selected]), [[selected.standard.action, true]])
})

test('a matching array index cannot substitute for a matching inspection requirement', () => {
  const pair = pairs[0]
  assert.equal(pair.standard.steps[2].i, pair.trace.steps[2].i)
  assert.notEqual(pair.standard.steps[2].requirement_id, pair.trace.steps[2].requirement_id)
  assert.equal(choices.buildPPEChoiceComparison({ standard: pair.standard.steps[2], trace: pair.trace.steps[2] }, hidden), null)
  assert.equal(choices.buildPPEChoiceComparison({ standard: pair.standard.steps[2] }, hidden), null)
})

test('conclusion alternatives are unavailable until both corresponding actions have been revealed', () => {
  const selected = structuredClone(playback.matchedRequirement(pairs[0], 'ppe_conclusion'))
  selected.trace.action = 'record_ppe_fail'
  freezeRecord(selected)
  for (const permitted of [[], ['standard'], ['trace']]) {
    assert.equal(choices.buildPPEChoiceComparison(selected, source => permitted.includes(source)), null)
  }
  const comparison = choices.buildPPEChoiceComparison(selected, () => true)
  assert.ok(comparison.changed)
  assert.equal(comparison.arms.standard.options.find(option => option.selected).action, 'record_ppe_pass')
  assert.equal(comparison.arms.trace.options.find(option => option.selected).action, 'record_ppe_fail')
})

function render(selected, revealed = hidden) {
  return renderToStaticMarkup(React.createElement(component.default, { selected, revealed }))
}
function decode(value) {
  return value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, entity => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'",
  })[entity])
}
function attribute(markup, name) {
  return decode(markup.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '')
}
function armOptions(html, source) {
  const arm = html.match(new RegExp(`<section\\b[^>]*data-choice-arm="${source}"[^>]*>([\\s\\S]*?)<\\/section>`))?.[1]
  assert.ok(arm, `the ${source} alternatives are present`)
  return [...arm.matchAll(/<li\b[^>]*data-choice-action="[^"]*"[^>]*>[\s\S]*?<\/li>/g)].map(([markup]) => ({
    action: attribute(markup, 'data-choice-action'), selected: attribute(markup, 'data-choice-selected') === 'true',
    art: attribute(markup, 'data-choice-art'), markup,
  }))
}

for (const [caseIndex, expected] of [[0, 8], [1, 15]]) {
  const pair = pairs[caseIndex]
  test(`${pair.game_id}: every method difference renders illustrated alternatives with the correct selected borders`, () => {
    const original = JSON.stringify(pair)
    let shown = 0
    for (const step of pair.standard.steps) {
      const selected = playback.matchedRequirement(pair, step.requirement_id)
      if (selected.standard.action === selected.trace.action) continue
      const html = render(selected)
      assert.match(html, /data-choice-comparison/)
      const comparison = choices.buildPPEChoiceComparison(selected, hidden)
      for (const source of ['standard', 'trace']) {
        const rendered = armOptions(html, source)
        assert.deepEqual(rendered.map(option => option.action), comparison.arms[source].options.map(option => option.action))
        assert.deepEqual(rendered.filter(option => option.selected).map(option => option.action), [selected[source].action])
        for (const option of rendered) {
          assert.ok(option.art)
          assert.ok(decode(option.markup).includes(`/test-choice-art/${option.art}.png`), 'the requested method illustration is actually rendered')
        }
      }
      assert.doesNotMatch(html, /<button\b|<form\b|<input\b|Watermark detected|Matched agent|Source verified|z-score/i)
      shown++
    }
    assert.equal(shown, expected)
    assert.equal(JSON.stringify(pair), original, 'rendering cannot modify a run or its stored detection data')
  })
}

test('the large image comparison is absent for same-method actions, including reordered checks', () => {
  let reordered = 0
  for (const pair of pairs) for (const step of pair.standard.steps) {
    const selected = playback.matchedRequirement(pair, step.requirement_id)
    if (selected.standard.action !== selected.trace.action) continue
    assert.equal(render(selected), '')
    if (selected.standard.i !== selected.trace.i) reordered++
  }
  assert.ok(reordered > 0)
  assert.equal(render({ standard: pairs[0].standard.steps[2], trace: pairs[0].trace.steps[2] }), '')
})

test('the image comparison preserves asymmetric candidate lists instead of inventing shared alternatives', () => {
  const selected = structuredClone(playback.matchedRequirement(pairs[0], 'worker_identity'))
  selected.standard.distribution = [{ cmd: selected.standard.action, label: 'Only available choice', p: 1 }]
  const html = render(freezeRecord(selected))
  assert.deepEqual(armOptions(html, 'standard').map(option => option.action), [selected.standard.action])
  assert.equal(armOptions(html, 'trace').length, selected.trace.distribution.length)
  assert.deepEqual(armOptions(html, 'trace').filter(option => option.selected).map(option => option.action), [selected.trace.action])
})

test('pass/fail illustrations and labels remain hidden until both conclusions are revealed', () => {
  const selected = structuredClone(playback.matchedRequirement(pairs[0], 'ppe_conclusion'))
  selected.trace.action = 'record_ppe_fail'
  freezeRecord(selected)
  for (const permitted of [[], ['standard'], ['trace']]) assert.equal(render(selected, source => permitted.includes(source)), '')
  const html = render(selected, () => true)
  assert.deepEqual(armOptions(html, 'standard').filter(option => option.selected).map(option => option.action), ['record_ppe_pass'])
  assert.deepEqual(armOptions(html, 'trace').filter(option => option.selected).map(option => option.action), ['record_ppe_fail'])
  assert.match(html, /Result: passed/)
  assert.match(html, /Result: not passed/)
})
