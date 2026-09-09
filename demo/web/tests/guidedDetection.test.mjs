import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = await readFile(new URL('../src/components/GuidedPanels.tsx', import.meta.url), 'utf8')
const module = { exports: {} }
Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText)(require, module, module.exports)
const { GuidedDetect, GuidedBanner } = module.exports

function detection({ n1 = 7, n2 = 30, z1 = .5, z2 = 1.5, wrong1 = 0, wrong2 = 0 } = {}) {
  return { layer1: { n: n1, z: z1, z_wrong: wrong1 }, layer2: { n: n2, z: z2, z_wrong: wrong2 },
    consistency: { total: 999, mismatch: 0, rate: 0 }, tau: 2 }
}
function render(d, running = true, tau = 2) {
  return renderToStaticMarkup(React.createElement(GuidedDetect, { d, running, tau }))
}

test('guided detection shows each detector’s effective sample count independently', () => {
  const markup = render(detection())
  assert.match(markup, /Effective L1 n = 7/)
  assert.match(markup, /Effective L2 n = 30/)
  assert.doesNotMatch(markup, /999/)
  assert.match(markup, /n counts detector-usable samples, not displayed steps/)
})

test('no recorded detection leaves the existing empty state without invented zero samples', () => {
  for (const d of [null, {}, { layer1: { n: 7, z: 1 } }]) {
    const markup = render(d)
    assert.match(markup, /Awaiting record/)
    assert.doesNotMatch(markup, /Effective L[12] n|n = 0|PRESENT/)
  }
})

test('zero usable samples are valid while missing or invalid counts stay unknown', () => {
  assert.match(render(detection({ n1: 0, n2: 0 })), /Effective L1 n = 0.*Effective L2 n = 0/)
  for (const invalid of [undefined, null, -1, NaN, Infinity, 1.5]) {
    const d = detection()
    d.layer1.n = invalid
    d.layer2.n = invalid
    const markup = render(d)
    assert.match(markup, /Effective L1 n = —.*Effective L2 n = —/)
    assert.doesNotMatch(markup, /NaN|Infinity|null|undefined/)
  }
})

test('changed or attacked records display smaller detector counts without a monotonic floor', () => {
  assert.match(render(detection({ n1: 17, n2: 30 }), false), /Effective L1 n = 17.*Effective L2 n = 30/)
  assert.match(render(detection({ n1: 4, n2: 9 }), false), /Effective L1 n = 4.*Effective L2 n = 9/)
})

test('running meters describe checking and non-monotonic evidence, not inevitable growth', () => {
  const markup = render(detection())
  assert.match(markup, /CHECKING…/)
  assert.match(markup, /Scores can rise or fall; crossing the threshold is not guaranteed/)
  assert.doesNotMatch(markup, /BUILDING|Builds up|Accumulating evidence/)
})

test('effective counts do not change strict threshold or wrong-key display behavior', () => {
  const atThreshold = render(detection({ z1: 2, z2: 2 }), false)
  assert.doesNotMatch(atThreshold, /PRESENT/)
  assert.equal((atThreshold.match(/NOT FOUND/g) ?? []).length, 2)
  const aboveThreshold = render(detection({ z1: 2.1, z2: 4, wrong1: 2, wrong2: 2.1 }), false)
  assert.equal((aboveThreshold.match(/PRESENT/g) ?? []).length, 2)
  assert.match(aboveThreshold, /wrong-key check: below threshold/)
  assert.match(aboveThreshold, /wrong-key check: above threshold/)
  assert.match(aboveThreshold, /Scores can rise or fall/)
})

test('running status banner no longer promises that every step strengthens evidence or guarantees detection', () => {
  const props = { idle: false, running: true, finished: false, detected: false, z1: .5, z2: 1, tau: 2, attacked: false }
  let markup = renderToStaticMarkup(React.createElement(GuidedBanner, props))
  assert.match(markup, /Scores can rise or fall; detection is not guaranteed/)
  assert.match(markup, /Checking evidence…/)
  assert.doesNotMatch(markup, /Every finished step adds evidence|banner turns green|Accumulating/)
  markup = renderToStaticMarkup(React.createElement(GuidedBanner, { ...props, z1: 2.5 }))
  assert.match(markup, /Currently past the line/)
})
