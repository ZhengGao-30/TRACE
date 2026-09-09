import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/constructionScene.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const scene = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const time = seconds => new Date(Date.UTC(2026, 8, 8, 8, 0, seconds)).toISOString()
const state = (seconds, worker_state = 'waiting', timber_state = 'overhead') => ({
  timestamp: time(seconds), worker_state, timber_state, contact: worker_state === 'injured',
})
const event = (id, kind, world) => ({ id, kind, title: id, description: `Recorded ${id}`, ...world })
const step = (i, before, after, events = [], extra = {}) => ({
  i, action: `check_${i} worker=W-CS03`, event_kind: 'agent_action', station_id: 'entry',
  world_state_before: before, world_state_after: after, world_events: events, ...extra,
})
const admission = event('entry', 'worker_entry', state(48, 'working'))
const falling = event('fall', 'falling_timber', state(140, 'injured', 'fallen'))
const recorded = event('record', 'event_recorded', state(145, 'injured', 'fallen'))
const steps = [
  step(0, state(0), state(30)),
  step(1, state(30), state(60, 'working'), [admission], { event_kind: 'injected_action' }),
  step(2, state(60, 'working'), state(90, 'working')),
  step(3, state(90, 'working'), state(120, 'working')),
  step(4, state(120, 'working'), state(150, 'injured', 'fallen'), [falling, recorded]),
  step(5, state(150, 'injured', 'fallen'), state(180, 'injured', 'fallen'), [], {
    state_after: { facts: { 'site.worker_state': { value: 'injured', observed_at: time(180) } } },
  }),
]
const group = (step, complete = true) => ({
  i: step.i, chosen: step.action,
  observations: complete ? [{ confirm: false, command: step.action, text: 'Recorded result' }] : [],
})
const groups = steps.map(step => group(step))

test('shift preview cannot render future report states or events', () => {
  const frame = scene.shiftWorldFrame(steps, [])
  assert.equal(frame.state, undefined)
  assert.deepEqual(frame.events, [])
  assert.equal(frame.incidentObserved, false)
  assert.deepEqual(scene.shiftScenePose(frame.state).workerPosition, [-2.9, .7, 2.45])
})

test('pending main action exposes before only, even when future world events exist', () => {
  const frame = scene.shiftWorldFrame(steps, [...groups.slice(0, 4), group(steps[4], false)])
  assert.equal(frame.state.worker_state, 'working')
  assert.equal(frame.state.timber_state, 'overhead')
  assert.deepEqual(frame.events.map(event => event.id), ['entry'])
  assert.equal(frame.incidentObserved, false)
})

test('buffered group results stay unavailable until the scene arrival callback', () => {
  const buffered = groups.slice(0, 5).map(g => ({ ...g, result: 'Preloaded source result' }))
  const gated = scene.gateShiftSceneResults(buffered, false)
  assert.equal(scene.shiftWorldFrame(steps, gated).state.worker_state, 'working')
  assert.equal(scene.shiftWorldFrame(steps, gated).events.length, 1)
  assert.equal(gated.at(-1).result, '')
  assert.equal(buffered.at(-1).result, 'Preloaded source result', 'source data is not mutated')
  assert.equal(scene.shiftWorldFrame(steps, scene.gateShiftSceneResults(buffered, true)).state.worker_state, 'injured')
})

test('controller admission advances world without fabricating an agent approval', () => {
  const frame = scene.shiftWorldFrame(steps, groups.slice(0, 2))
  assert.equal(frame.state.worker_state, 'working')
  assert.deepEqual(frame.events, [admission])
  assert.equal(frame.previousState.worker_state, 'waiting')
  assert.equal(scene.shiftScenePose(frame.state, frame.previousState, 0).workerPosition[0], -2.9)
  assert.ok(Math.abs(scene.shiftScenePose(frame.state, frame.previousState, 1).workerPosition[0] - 1.2) < 1e-9)
  assert.equal(scene.shiftScenePose(frame.state, frame.previousState, 1).phase, 'work')
})

test('physical accident and robot discovery have separate clocks', () => {
  const accident = scene.shiftWorldFrame(steps, groups.slice(0, 5))
  assert.equal(accident.state.worker_state, 'injured')
  assert.deepEqual(accident.events.map(event => event.timestamp), [time(48), time(140), time(145)])
  assert.equal(accident.incidentObserved, false)
  assert.equal(accident.observedAt, undefined)
  const pendingObservation = scene.shiftWorldFrame(steps, [...groups.slice(0, 5), group(steps[5], false)])
  assert.equal(pendingObservation.incidentObserved, false)
  const discovered = scene.shiftWorldFrame(steps, groups)
  assert.equal(discovered.incidentObserved, true)
  assert.equal(discovered.observedAt, time(180))
  assert.equal(scene.shiftScenePose(discovered.state).phase, 'aftermath')
})

test('L2 reads cannot advance clock, uncover injury, or restart world animation', () => {
  const prefix = groups.slice(0, 5)
  const l2 = prefix.map(g => ({ ...g, observations: [...g.observations, {
    command: 'review last_record', confirm: true, text: 'injured at future scene',
  }] }))
  assert.deepEqual(scene.shiftWorldFrame(steps, l2), scene.shiftWorldFrame(steps, prefix))
  const onlyL2 = [...groups.slice(0, 4), { ...group(steps[4], false), observations: [{
    command: 'review last_record', confirm: true, text: 'result has not arrived',
  }] }]
  assert.equal(scene.shiftWorldFrame(steps, onlyL2).state.worker_state, 'working')
  assert.equal(scene.shiftWorldFrame(steps, groups).transitionToken, scene.shiftWorldFrame(steps, prefix).transitionToken)
})

test('all clock, contact, timber and interval event fields fail closed', () => {
  for (const invalid of [
    { ...state(30), contact: undefined }, { ...state(30), contact: true },
    { ...state(30), timestamp: '2026-02-30T08:00:00Z' },
    { ...state(30), worker_state: 'unknown' }, { ...state(30), timber_state: 'flying' },
    { ...state(30, 'injured'), timber_state: 'overhead' },
  ]) assert.equal(scene.recordedWorldState(invalid), undefined)
  for (const badEvents of [undefined, [falling, falling], [{ ...falling, kind: 'unknown' }],
    [{ ...falling, timestamp: time(119) }], [{ ...falling, timestamp: time(151) }],
    [{ ...falling, contact: false }], [{ ...falling, title: undefined }], []]) {
    assert.equal(scene.shiftIntervalEvents(state(120, 'working'), state(150, 'injured', 'fallen'), badEvents), undefined)
  }
  assert.equal(scene.shiftIntervalEvents(state(150, 'injured', 'fallen'), state(180, 'working'), []), undefined)
})

test('different case commands and discontinuous prefix cannot import stale injury', () => {
  const otherGroups = groups.map(g => ({ ...g, chosen: g.chosen.replace('CS03', 'CS04') }))
  assert.equal(scene.shiftWorldFrame(steps, otherGroups).state, undefined)
  const discontinuous = [...steps.slice(0, 4), { ...steps[4], world_state_before: state(120, 'injured', 'fallen') }]
  assert.equal(scene.shiftWorldFrame(discontinuous, groups).state.worker_state, 'working')
  assert.equal(scene.shiftWorldFrame(steps, [groups[4]]).state, undefined)
})

test('explicit stations take precedence over bare command mapping and versioned commands work', () => {
  assert.equal(scene.stationForReview('inspect_footwear worker=W1 version=2', 'timber').id, 'timber')
  assert.equal(scene.stationForReview('inspect_footwear worker=W1 version=2').id, 'ppe')
  assert.equal(scene.stationForReview('send_incident_report report=R1', 'report').id, 'report')
  assert.equal(scene.stationForReview('controller_override gate=G1', 'entry').id, 'entry')
  assert.equal(scene.stationForReview('review last_record'), undefined)
})

test('shift history unlocks only once every main interval including the fault completed', () => {
  assert.equal(scene.isShiftReplayComplete(false, steps, groups), true)
  assert.equal(scene.isShiftReplayComplete(true, steps, groups), false)
  assert.equal(scene.isShiftReplayComplete(false, steps, groups.slice(0, -1)), false)
  assert.equal(scene.isShiftReplayComplete(false, steps, [...groups.slice(0, -1), group(steps.at(-1), false)]), false)
  assert.equal(scene.isShiftReplayComplete(false, steps, groups.filter((_, index) => index !== 1)), false)
})

test('both delivered shift bundles render every completed and pending interval without future data', async () => {
  for (const name of ['hse_construction-CS01-scaffold__shift_fault_demo', 'hse_construction-CS02-timber_yard__shift_fault_demo']) {
    const pair = JSON.parse(await readFile(new URL(`../public/static/compare/${name}.json`, import.meta.url), 'utf8'))
    for (const arm of [pair.trace, pair.standard]) {
      const actualGroups = arm.steps.map(step => ({ ...group(step), result: step.result }))
      const completedEvents = []
      for (const [index, step] of arm.steps.entries()) {
        assert.ok(scene.stationForReview(step.action, step.station_id), step.action)
        const prefix = actualGroups.slice(0, index + 1)
        const pending = scene.shiftWorldFrame(arm.steps, scene.gateShiftSceneResults(prefix, false))
        assert.deepEqual(pending.state, step.world_state_before, `pending ${name} ${step.i}`)
        assert.deepEqual(pending.events, completedEvents, `pending events ${name} ${step.i}`)
        completedEvents.push(...step.world_events)
        const finished = scene.shiftWorldFrame(arm.steps, prefix)
        assert.deepEqual(finished.state, step.world_state_after, `completed ${name} ${step.i}`)
        assert.deepEqual(finished.events, completedEvents, `completed events ${name} ${step.i}`)
        assert.equal(finished.incidentObserved, step.state_after.facts['site.worker_state']?.value === 'injured')
      }
      assert.equal(completedEvents.length, 3)
      assert.equal(scene.isShiftReplayComplete(false, arm.steps, actualGroups), true)
    }
  }
})
