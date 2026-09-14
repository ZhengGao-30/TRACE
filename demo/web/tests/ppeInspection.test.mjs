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
  Function('require', 'module', 'exports', code)((name) => dependencies[name] ?? require(name), module, module.exports)
  return module.exports
}
const ppe = await load('../src/lib/ppeInspection.ts')
const scene = await load('../src/lib/constructionScene.ts')
const guided = await load('../src/lib/guidedSteps.ts', { './ppeInspection': ppe })
const workflow = await load('../src/components/PairedWorkflowStrip.tsx', { '../lib/ppeInspection': ppe, '../lib/guidedSteps': guided })
const attribution = await load('../src/components/EntryAttributionPanel.tsx', { '../lib/ppeInspection': ppe, './PairedWorkflowStrip': workflow })

for (const site of ['CS01', 'CS02']) {
  const pair = JSON.parse(await readFile(new URL(`../public/static/compare/hse_ppe-${site}.json`, import.meta.url), 'utf8'))
  test(`${site}: every partial replay shows only completed observations and equipment revisions`, () => {
    const steps = pair.trace.steps
    assert.equal(steps.length, 24)
    assert.deepEqual(ppe.ppeReplayFrame(steps, [], false).state, steps[0].scene_state_before)
    for (let index = 0; index < steps.length; index++) {
      const groups = steps.slice(0, index + 1).map(s => ({ i: s.i, chosen: s.action }))
      const pending = ppe.ppeReplayFrame(steps, groups, false)
      const complete = ppe.ppeReplayFrame(steps, groups, true)
      assert.equal(pending.completed, index)
      assert.deepEqual(pending.state, steps[index].scene_state_before)
      assert.deepEqual(pending.checklist, steps[index].checklist_before)
      assert.equal(complete.completed, index + 1)
      assert.deepEqual(complete.state, steps[index].scene_state_after)
      assert.deepEqual(complete.checklist, steps[index].checklist_after)
      assert.equal(complete.state.worker_state, 'waiting')
      assert.equal(complete.state.location, 'checkpoint')
    }
    assert.equal(ppe.ppeReplayFrame(steps, [{ i: 0, chosen: 'another-case' }], true).completed, 0)
    const correction = steps.find(s => s.action.startsWith('change_confirmation '))
    assert.ok(correction.checklist_after.every(r => r.status === 'unknown'))
  })
  test(`${site}: real procedures retain tablet vs physical semantics without extra visits`, () => {
    for (const arm of ['standard', 'trace']) {
      let position = [-3.8, 0, 2.6]
      const steps = pair[arm].steps
      for (const step of steps) {
        const spec = ppe.ppeMotionSpec(step)
        const plan = scene.reviewActionPlan(position, step.action, scene.stationForReview(step.action, step.station_id), false, spec)
        assert.equal(plan.mode, spec.mode === 'inspect' ? 'inspect' : 'tablet')
        if (plan.mode === 'tablet') assert.deepEqual(plan.route, [])
        if (plan.route.length) position = [...plan.route.at(-1)]
        if (step.action.endsWith(' method=camera')) assert.equal(plan.mode, 'tablet')
      }
      const groups = steps.map(s => ({ i: s.i, chosen: s.action, result: s.result, observations: [] }))
      const resume = scene.reviewResumePose(steps.map(s => ({ ...s, scene_action: ppe.ppeMotionSpec(s) })), groups)
      assert.deepEqual(resume.position, position)
    }
  })
  test(`${site}: six workflow stages preserve all 24 unique substantive requirements`, () => {
    for (const arm of ['standard', 'trace']) {
      const steps = pair[arm].steps
      const phases = guided.buildWorkflow(steps, 'hse', ppe.PPE_TASK, pair.stages)
      assert.deepEqual(phases.map(p => p.id), ppe.PPE_PHASES.map(p => p.id))
      assert.equal(phases.flatMap(p => p.steps).length, 24)
      assert.equal(new Set(steps.map(s => s.requirement_id)).size, 24)
      assert.ok(steps.every(s => s.policy_source === 'codex_llm' && s.detector_eligible && s.event_kind === 'agent_action'))
      assert.ok(steps.every(s => !s.world_events && !s.fault))
    }
  })
  test(`${site}: final conclusion is hidden in locked labels, aria labels and details`, () => {
    for (const source of ['trace', 'standard']) {
      const step = pair[source].steps.find(s => s.action.startsWith('record_ppe_'))
      const markup = renderToStaticMarkup(workflow.ActionWindow({ indices: [step.i], steps: pair[source].steps,
        focus: step.i, source, selectedSource: null, current: -1, canInspect: () => false, onSelect: () => {} }))
      assert.match(markup, /Record the result/)
      assert.ok(!markup.includes(step.label))
      assert.ok(!markup.includes(step.result))
    }
  })
  test(`${site}: true callback completion controls inspector availability, not current cursor alone`, () => {
    assert.equal(workflow.canInspectAction(ppe.PPE_TASK, 'trace', 23, 23, false, 24, 22), false)
    assert.equal(workflow.canInspectAction(ppe.PPE_TASK, 'standard', 0, 23, false, 24, 22), false)
    assert.equal(workflow.canInspectAction(ppe.PPE_TASK, 'trace', 8, 8, true, 24, 8), true)
    assert.equal(workflow.canInspectAction(ppe.PPE_TASK, 'standard', 0, 23, false, 24, 23), true)
  })
  test(`${site}: PPE condition and agent correctness remain separate in final results and attribution`, () => {
    const before = renderToStaticMarkup(workflow.PPEOutcomeComparison({ pair, available: false }))
    assert.doesNotMatch(before, /PPE check (?:passed|not passed)/)
    const after = renderToStaticMarkup(workflow.PPEOutcomeComparison({ pair, available: true }))
    assert.match(after, /Agent conclusion/)
    assert.match(after, /Current PPE/)
    assert.doesNotMatch(after, /Entry approved|injury|site outcome/)
    const panel = renderToStaticMarkup(React.createElement(attribution.default, { pair, available: true }))
    assert.match(panel, /matches the observed checklist/)
    assert.doesNotMatch(panel, /did not include a detailed finding/)
    if (site === 'CS02') {
      assert.equal(pair.attribution.status, 'ambiguous')
      assert.deepEqual(pair.attribution.matched_agent_ids, ['gate-agent-01', 'gate-agent-03'])
      assert.match(panel, /Multiple candidate keys have support/)
    }
  })
}

test('both layouts gate raw results and wait for a matching paired record before start', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.equal((source.match(/g\.i > reviewCompleted/g) ?? []).length, 2)
  assert.equal((source.match(/completedIndex=\{reviewCompleted\}/g) ?? []).length, 6)
  assert.equal((source.match(/disabled=\{running \|\| constructionPreview \|\| !ppeReady/g) ?? []).length, 2)
  assert.match(source, /this step has not been marked complete/)
  const view = await readFile(new URL('../src/components/PPEInspectionScene.tsx', import.meta.url), 'utf8')
  assert.match(view, /resultReady = manual \? manual\.complete : !!step && step\.i <= completedIndex/)
  assert.doesNotMatch(view, /setArrived/)
  const three = await readFile(new URL('../src/three/ConstructionScene.tsx', import.meta.url), 'utf8')
  assert.match(three, /if \(actionFinished\) completed\.current = actionToken/)
  assert.match(three, /if \(!group\.current \|\| paused\) return/)
})
