import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const DEMO_BITS = '1011010010110101'
const steps = [
  { i: 9, requirement_id: 'initial_workwear', action: 'initial_workwear method=camera', label: 'Inspect clothing' },
  { i: 21, requirement_id: 'preserve_evidence', action: 'preserve_evidence method=bundle', label: 'Save evidence' },
]
const props = { steps, openRequest: 0, onShowStep() {} }

async function load(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  Function('require', 'module', 'exports', 'window', 'setTimeout', 'clearTimeout', 'fetch', code)(
    name => dependencies[name] ?? require(name),
    module,
    module.exports,
    dependencies.window,
    dependencies.clock?.setTimeout ?? globalThis.setTimeout,
    dependencies.clock?.clearTimeout ?? globalThis.clearTimeout,
    () => assert.fail('the photo illustration must not run a detector'),
  )
  return module.exports
}

function descendants(element, predicate) {
  if (!React.isValidElement(element)) return []
  return [
    ...(predicate(element) ? [element] : []),
    ...React.Children.toArray(element.props.children).flatMap(child => descendants(child, predicate)),
  ]
}

function action(tree, name) {
  const matches = descendants(tree, element => element.props['data-photo-action'] === name)
  assert.equal(matches.length, 1, `one ${name} action exists`)
  return matches[0]
}

function part(tree, name) {
  const matches = descendants(tree, element => element.props['data-photo-part'] === name)
  assert.equal(matches.length, 1, `one ${name} part exists`)
  return matches[0]
}

function photo(tree) {
  const matches = descendants(tree, element => element.type === 'img')
  assert.equal(matches.length, 1, 'one photo exists')
  return matches[0]
}

function phase(tree) {
  return tree.props['data-photo-phase']
}

function detectedPayload(tree) {
  return [...renderToStaticMarkup(part(tree, 'detect')).matchAll(/<span\b[^>]*data-match="true"[^>]*>([01])<\/span>/g)]
    .map(match => match[1])
    .join('')
}

async function photoHarness() {
  let cursor = 0
  let dirty = false
  let effects = []
  let timerId = 0
  let reducedMotion = false
  const slots = []
  const timers = new Map()
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const hooks = {
    useId() {
      const index = cursor++
      slots[index] ??= { value: `photo-test-${index}` }
      return slots[index].value
    },
    useState(initial) {
      const index = cursor++
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, value => {
        const next = typeof value === 'function' ? value(slots[index].value) : value
        if (!Object.is(next, slots[index].value)) {
          slots[index].value = next
          dirty = true
        }
      }]
    },
    useRef(value) {
      const index = cursor++
      slots[index] ??= { current: value }
      return slots[index]
    },
    useEffect(effect, deps) {
      const index = cursor++
      const previous = slots[index]
      if (!same(previous?.deps, deps)) {
        const slot = { deps, cleanup: previous?.cleanup }
        slots[index] = slot
        effects.push(() => {
          slot.cleanup?.()
          slot.cleanup = effect()
        })
      }
    },
  }
  const clock = {
    setTimeout(fn, ms) {
      const id = ++timerId
      timers.set(id, { fn, ms })
      return id
    },
    clearTimeout(id) {
      timers.delete(id)
    },
  }
  const subject = await load('../src/components/PPEPhotoWatermark.tsx', {
    react: hooks,
    clock,
    'framer-motion': { useReducedMotion: () => reducedMotion },
    'lucide-react': new Proxy({}, { get: (_, name) => function TestIcon(iconProps) { return React.createElement('svg', { ...iconProps, 'data-icon': String(name) }) } }),
    '../assets/ppe-inspection-photo.png': { default: '/test-photo.png' },
    '../lib/ppeInspection': { ppeActionLabel: () => 'Inspect clothing' },
    './PPEPhotoWatermark.css': {},
  })
  return {
    timers,
    setReducedMotion(value) { reducedMotion = value },
    render(nextProps = props) {
      for (let pass = 0; pass < 8; pass++) {
        cursor = 0
        dirty = false
        effects = []
        const tree = subject.default(nextProps)
        for (const effect of effects) effect()
        if (!dirty) return tree
      }
      assert.fail('photo state did not settle')
    },
    fireNext() {
      const [id, timer] = [...timers.entries()].sort((a, b) => a[1].ms - b[1].ms)[0] ?? []
      assert.ok(timer, 'an animation timer is pending')
      timers.delete(id)
      timer.fn()
    },
    unmount() {
      for (const slot of slots) slot?.cleanup?.()
    },
  }
}

function finishTimers(harness, currentProps = props) {
  let tree
  for (let tick = 0; tick < 100 && harness.timers.size; tick++) {
    harness.fireNext()
    tree = harness.render(currentProps)
  }
  assert.equal(harness.timers.size, 0, 'the finite photo animation finishes')
  return tree ?? harness.render(currentProps)
}

function loadPhoto(harness, tree) {
  photo(tree).props.onLoad()
  return harness.render(props)
}

test('photo watermark requires add, save, open picker, choose photo and detect in order, then scans and matches all recovered bits', async () => {
  const harness = await photoHarness()
  let tree = loadPhoto(harness, harness.render(props))
  assert.equal(phase(tree), 'idle')
  assert.equal(action(tree, 'add-watermark').props.disabled, false)
  assert.equal(action(tree, 'save-photo').props.disabled, true)
  assert.equal(action(tree, 'select-photo').props.disabled, true)
  assert.equal(action(tree, 'detect-watermark').props.disabled, true)
  assert.equal(part(tree, 'watermark').props['data-part-state'], 'active')
  assert.equal(part(tree, 'detect').props['data-part-state'], 'locked')
  assert.equal(part(tree, 'detect').props['data-photo-selected'], false)

  action(tree, 'save-photo').props.onClick()
  action(tree, 'select-photo').props.onClick()
  action(tree, 'detect-watermark').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'idle', 'save, select and detect cannot skip watermarking')

  action(tree, 'add-watermark').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'adding')
  assert.ok(harness.timers.size > 0)
  action(tree, 'save-photo').props.onClick()
  action(tree, 'select-photo').props.onClick()
  action(tree, 'detect-watermark').props.onClick()
  assert.equal(phase(harness.render(props)), 'adding', 'later actions remain gated while bits are added')
  tree = finishTimers(harness)
  assert.equal(phase(tree), 'watermarked')
  assert.equal(action(tree, 'save-photo').props.disabled, false)
  assert.equal(action(tree, 'select-photo').props.disabled, true)
  assert.equal(action(tree, 'detect-watermark').props.disabled, true)

  action(tree, 'detect-watermark').props.onClick()
  assert.equal(phase(harness.render(props)), 'watermarked', 'detection remains gated until the photo is saved')
  action(tree, 'save-photo').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'saving')
  tree = finishTimers(harness)
  assert.equal(phase(tree), 'saved')
  assert.equal(part(tree, 'watermark').props['data-part-state'], 'complete')
  assert.equal(part(tree, 'detect').props['data-part-state'], 'active')
  assert.equal(part(tree, 'detect').props['data-photo-selected'], false)
  assert.equal(action(tree, 'select-photo').props.disabled, false)
  assert.equal(action(tree, 'detect-watermark').props.disabled, true)

  action(tree, 'detect-watermark').props.onClick()
  assert.equal(phase(harness.render(props)), 'saved', 'detection remains gated until the saved photo is selected')
  action(tree, 'select-photo').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'saved', 'opening the photo picker does not select its photo')
  assert.equal(part(tree, 'detect').props['data-photo-selected'], false)
  assert.equal(action(tree, 'detect-watermark').props.disabled, true, 'detection stays locked while the picker is open')
  assert.equal(descendants(tree, element => element.props['data-photo-action'] === 'choose-photo-option').length, 1, 'the picker offers one saved photo')

  action(tree, 'choose-photo-option').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'selected')
  assert.equal(part(tree, 'detect').props['data-photo-selected'], true)
  assert.equal(action(tree, 'detect-watermark').props.disabled, false)

  action(tree, 'detect-watermark').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'detecting')
  assert.equal(part(tree, 'detect').props['data-detection-result'], 'pending')
  assert.equal(part(tree, 'detect').props['data-recovered-bits'], 0)
  assert.equal(descendants(tree, element => element.props['data-detection-effect'] === 'scan').length, 1)

  harness.fireNext()
  tree = harness.render(props)
  assert.equal(phase(tree), 'matching')
  assert.equal(descendants(tree, element => element.props['data-detection-effect'] === 'scan').length, 0, 'the scan runs once before bit matching')
  harness.fireNext()
  tree = harness.render(props)
  assert.equal(phase(tree), 'matching')
  assert.equal(part(tree, 'detect').props['data-recovered-bits'], 1, 'matching reveals bits progressively')

  tree = finishTimers(harness)
  assert.equal(phase(tree), 'matched')
  assert.equal(part(tree, 'detect').props['data-detection-result'], 'match')
  assert.equal(part(tree, 'detect').props['data-recovered-bits'], DEMO_BITS.length)
  assert.equal(detectedPayload(tree), DEMO_BITS)
  harness.unmount()
})

test('reduced motion keeps add, save, picker, choice and detection separate while completing without animation timers', async () => {
  const harness = await photoHarness()
  harness.setReducedMotion(true)
  let tree = loadPhoto(harness, harness.render(props))

  action(tree, 'save-photo').props.onClick()
  action(tree, 'select-photo').props.onClick()
  action(tree, 'detect-watermark').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'idle')

  action(tree, 'add-watermark').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'watermarked')
  assert.equal(harness.timers.size, 0)
  assert.equal(action(tree, 'select-photo').props.disabled, true)
  assert.equal(action(tree, 'detect-watermark').props.disabled, true)

  action(tree, 'select-photo').props.onClick()
  action(tree, 'detect-watermark').props.onClick()
  assert.equal(phase(harness.render(props)), 'watermarked')
  action(tree, 'save-photo').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'saved')
  assert.equal(harness.timers.size, 0)
  assert.equal(part(tree, 'detect').props['data-photo-selected'], false)
  assert.equal(action(tree, 'detect-watermark').props.disabled, true)

  action(tree, 'detect-watermark').props.onClick()
  assert.equal(phase(harness.render(props)), 'saved')
  action(tree, 'select-photo').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'saved', 'opening the picker is still a separate action with reduced motion')
  assert.equal(harness.timers.size, 0)
  assert.equal(part(tree, 'detect').props['data-photo-selected'], false)
  assert.equal(action(tree, 'detect-watermark').props.disabled, true)
  assert.equal(descendants(tree, element => element.props['data-photo-action'] === 'choose-photo-option').length, 1, 'the reduced-motion picker offers one saved photo')

  action(tree, 'choose-photo-option').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'selected')
  assert.equal(harness.timers.size, 0)
  assert.equal(part(tree, 'detect').props['data-photo-selected'], true)
  assert.equal(action(tree, 'detect-watermark').props.disabled, false)

  action(tree, 'detect-watermark').props.onClick()
  tree = harness.render(props)
  assert.equal(phase(tree), 'matched')
  assert.equal(harness.timers.size, 0)
  assert.equal(descendants(tree, element => element.props['data-detection-effect'] === 'scan').length, 0)
  assert.equal(part(tree, 'detect').props['data-detection-result'], 'match')
  assert.equal(detectedPayload(tree), DEMO_BITS)
  harness.unmount()
})

test('photo reset paths and unmount cancel pending animation timers', async () => {
  const resetHarness = await photoHarness()
  let tree = loadPhoto(resetHarness, resetHarness.render(props))
  action(tree, 'add-watermark').props.onClick()
  tree = resetHarness.render(props)
  assert.equal(phase(tree), 'adding')
  assert.ok(resetHarness.timers.size > 0)
  photo(tree).props.onError()
  tree = resetHarness.render(props)
  assert.equal(phase(tree), 'idle')
  assert.equal(resetHarness.timers.size, 0, 'an image reset clears every pending bit update')
  assert.equal(action(tree, 'add-watermark').props.disabled, true)
  resetHarness.unmount()

  const unmountHarness = await photoHarness()
  tree = loadPhoto(unmountHarness, unmountHarness.render(props))
  action(tree, 'add-watermark').props.onClick()
  unmountHarness.render(props)
  assert.ok(unmountHarness.timers.size > 0)
  unmountHarness.unmount()
  assert.equal(unmountHarness.timers.size, 0, 'unmount clears every pending animation update')
})
