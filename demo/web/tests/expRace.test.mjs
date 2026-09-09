import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = await readFile(new URL('../src/components/ExpRace.tsx', import.meta.url), 'utf8')
const output = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText
const module = { exports: {} }
Function('require', 'module', 'exports', output)((name) => name === '../i18n'
  ? { useI18n: () => ({ t: (key) => key }) } : require(name), module, module.exports)

test('expert race keeps finite large scores finite and positive small probabilities nonzero', () => {
  const markup = renderToStaticMarkup(React.createElement(module.exports.default, {
    rows: [{ cmd: 'unlikely_assessment', p: 0.00045, r: 0.749, score: 642.19, win: false },
      { cmd: 'very_unlikely_assessment', p: 0.000001, r: 0.563, score: 127594, win: false }],
    window: 'test', phi: null, nCandidates: 2,
  }))
  assert.match(markup, /642\.19/)
  assert.match(markup, /1\.28e\+5/)
  assert.match(markup, /&lt;0\.001/)
  assert.doesNotMatch(markup, /∞/)
})
