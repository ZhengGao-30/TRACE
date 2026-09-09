import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/constructionScene.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const scene = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('every tool in the two construction cases has a meaningful entry-check station', async () => {
  for (const file of ['construction_ppe_main.json', 'construction_ppe_timber_yard.json']) {
    const content = await readFile(new URL(`../../hse/cases/${file}`, import.meta.url), 'utf8')
    const commands = [...content.matchAll(/"command"\s*:\s*"([^"]+)"/g)].map((match) => match[1])
    assert.ok(commands.length > 0)
    for (const command of commands) assert.ok(scene.stationForReview(command), command)
  }
  assert.equal(scene.stationForReview('review last_record'), undefined, 'L2 is not a new site visit')
  assert.equal(scene.stationForReview('inspect_post_incident_record'), undefined, 'legacy investigation is not relabelled as an entry check')
  assert.equal(scene.stationForReview('unknown_tool'), undefined)
})

test('station-to-station paths avoid the building and worker', () => {
  for (const from of scene.EVIDENCE_STATIONS) {
    for (const to of scene.EVIDENCE_STATIONS) {
      if (from.id === to.id) continue
      const route = scene.reviewRoute(from.position, to)
      assert.deepEqual(route.at(-1), to.position)
      let previous = from.position
      for (const point of route) {
        for (let step = 0; step <= 100; step++) {
          const t = step / 100
          const x = previous[0] * (1 - t) + point[0] * t
          const z = previous[2] * (1 - t) + point[2] * t
          assert.ok(!(x >= .1 && x <= 3 && z >= -2.8 && z <= -.6), `${from.id}→${to.id}: building collision`)
          assert.ok(Math.hypot(x + 2.9, z - 2.45) > .6, `${from.id}→${to.id}: waiting worker collision`)
          assert.ok(Math.abs(x) <= 6 && Math.abs(z) <= 4.5, 'path stays on the site')
        }
        previous = point
      }
    }
  }
})

const event = (worker_state, timber_state, id = 'entry') => {
  const index = ['entry', 'fall', 'record'].indexOf(id)
  return {
    id, timestamp: `2026-09-08T08:00:${['15', '30', '45'][index]}`,
    kind: ['worker_entry', 'falling_timber', 'event_recorded'][index], title: id, description: `Recorded ${worker_state}`,
    worker_state, timber_state, contact: worker_state === 'injured',
  }
}
const decision = action => ({ action, timestamp: '2026-09-08T08:00:00' })
const exposedEvents = [event('working', 'overhead', 'entry'), event('injured', 'fallen', 'fall'), event('injured', 'fallen', 'record')]
const heldEvents = [event('held', 'overhead', 'entry'), event('held', 'fallen', 'fall'), event('clear', 'fallen', 'record')]

test('world events are actual records, never an unconditional incident script', () => {
  assert.deepEqual(scene.recordedWorldEvents(undefined), [])
  assert.deepEqual(scene.recordedWorldEvents({ facts: { injury: true } }), [])
  assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events: exposedEvents }), exposedEvents)
  assert.deepEqual(scene.recordedWorldEvents({ decision: decision('deny_entry'), world_events: heldEvents }), heldEvents)
  assert.deepEqual(scene.recordedWorldEvents({ decision: decision('hold_for_review'), world_events: heldEvents }), heldEvents)
})

test('inconsistent or unapproved exposure cannot produce a rendered injury', () => {
  for (const action of ['deny_entry', 'hold_for_review', undefined]) {
    assert.deepEqual(scene.recordedWorldEvents({ decision: decision(action), world_events: exposedEvents }), [])
  }
  assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events: [exposedEvents[1]] }), [])
  assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events: [{ ...exposedEvents[0], worker_state: 'unknown' }, ...exposedEvents.slice(1)] }), [])
  assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events: [exposedEvents[0], exposedEvents[0], exposedEvents[2]] }), [])
  assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events: [exposedEvents[0], exposedEvents[1], { ...exposedEvents[2], timber_state: 'overhead' }] }), [])
})

test('only the recorded three-event kind sequence is accepted', () => {
  for (const world_events of [
    [...exposedEvents.slice(0, 2)], [...exposedEvents, exposedEvents[2]],
    [exposedEvents[1], exposedEvents[0], exposedEvents[2]],
    exposedEvents.map((e, i) => i === 1 ? { ...e, kind: 'unknown_event' } : e),
    exposedEvents.map((e, i) => i === 1 ? { ...e, kind: 'worker_entry' } : e),
  ]) assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events }), [])
})

test('world timestamps must be valid ISO dates strictly after the decision and each other', () => {
  for (const invalid of ['08:00:30', 'yesterday', '', '2026-02-30T08:00:30', '2026-09-08T24:00:00', '2026-09-08T08:00:30+99:00']) {
    const world_events = exposedEvents.map((e, i) => i === 1 ? { ...e, timestamp: invalid } : e)
    assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events }), [], invalid)
    assert.deepEqual(scene.recordedWorldEvents({ decision: { ...decision('approve_entry'), timestamp: invalid }, world_events: exposedEvents }), [], `decision ${invalid}`)
  }
  for (const timestamp of [exposedEvents[0].timestamp, '2026-09-08T08:00:01']) {
    const world_events = exposedEvents.map((e, i) => i === 1 ? { ...e, timestamp } : e)
    assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events }), [])
  }
  for (const timestamp of [exposedEvents[0].timestamp, '2026-09-08T08:00:16', undefined]) {
    assert.deepEqual(scene.recordedWorldEvents({ decision: { ...decision('approve_entry'), timestamp }, world_events: exposedEvents }), [])
  }
  const zoned = exposedEvents.map(e => ({ ...e, timestamp: `${e.timestamp}+08:00` }))
  assert.deepEqual(scene.recordedWorldEvents({ decision: { ...decision('approve_entry'), timestamp: '2026-09-08T00:00:00Z' }, world_events: zoned }), zoned)
})

test('contact metadata must agree with the recorded worker state and denial/hold cannot contact', () => {
  for (const action of ['deny_entry', 'hold_for_review']) {
    const world_events = heldEvents.map((e, i) => i === 1 ? { ...e, contact: true } : e)
    assert.deepEqual(scene.recordedWorldEvents({ decision: decision(action), world_events }), [])
  }
  for (const contact of [false, 'true', null]) {
    const world_events = exposedEvents.map((e, i) => i === 1 ? { ...e, contact } : e)
    assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events }), [])
  }
  const premature = exposedEvents.map((e, i) => i === 0 ? { ...e, contact: true } : e)
  assert.deepEqual(scene.recordedWorldEvents({ decision: decision('approve_entry'), world_events: premature }), [])
})

test('preview and checks keep the worker at entry and timber overhead', () => {
  const pose = scene.recordedScenePose()
  assert.equal(pose.phase, 'entry')
  assert.equal(pose.progress, 1, 'standing, not walking in place')
  assert.deepEqual(pose.offset, [-4.1, 0, 2.05])
  assert.deepEqual(pose.workerPosition, [-2.9, .7, 2.45])
  assert.equal(pose.timberProgress, 0)
})

test('denial and hold never place the worker under falling timber or in an injury pose', () => {
  for (let index = 0; index < heldEvents.length; index++) {
    for (const progress of [0, .5, 1]) {
      const pose = scene.recordedScenePose(heldEvents[index], heldEvents[index - 1], progress)
      assert.equal(pose.phase, 'entry')
      assert.deepEqual(pose.workerPosition, [-2.9, .7, 2.45])
      assert.equal(pose.progress, 1)
    }
  }
  assert.equal(scene.recordedScenePose(heldEvents[1], heldEvents[0], 1).timberProgress, 1, 'world event can fall without contact')
})

test('recorded admission moves from entry; injury requires a prior recorded work-area state', () => {
  const entering = scene.recordedScenePose(exposedEvents[0], undefined, 0)
  assert.equal(entering.phase, 'entry')
  assert.deepEqual(entering.workerPosition, [-2.9, .7, 2.45])
  const arrived = scene.recordedScenePose(exposedEvents[0], undefined, 1).workerPosition
  assert.ok(Math.abs(arrived[0] - 1.2) < 1e-9 && Math.abs(arrived[2] - .4) < 1e-9)
  assert.equal(scene.recordedScenePose(exposedEvents[1], exposedEvents[0], .5).phase, 'incident')
  assert.equal(scene.recordedScenePose(exposedEvents[2], exposedEvents[1], 1).phase, 'aftermath')
  assert.equal(scene.recordedScenePose(exposedEvents[1], heldEvents[0], 1).phase, 'entry', 'defensive pose guard rejects injury with no exposure')
})

test('event seek is bounded and uses recorded event count, not four fixed chapters', () => {
  assert.equal(scene.siteEventAt([], 0), undefined)
  assert.equal(scene.siteEventAt(heldEvents, -1).index, 0)
  assert.equal(scene.siteEventAt(heldEvents, NaN).index, 0)
  assert.equal(scene.siteEventAt(heldEvents, .5).event.id, 'fall')
  assert.equal(scene.siteEventAt(heldEvents, 1).event.worker_state, 'clear')
  assert.equal(scene.siteEventAt(heldEvents, 10).progress, 1)
})

test('site events stay locked during every incomplete or running decision prefix', () => {
  const steps = [{ i: 0, action: 'identify_worker' }, { i: 1, action: 'approve_entry' }]
  const groups = steps.map(step => ({ i: step.i, chosen: step.action, observations: [{ command: step.action, confirm: false, text: 'recorded result' }] }))
  assert.equal(scene.isEntryReplayComplete('construction_ppe_entry_check', false, steps, groups), true)
  assert.equal(scene.isEntryReplayComplete('construction_ppe_entry_check', true, steps, groups), false, 'even when final group appears, a running source has not finished')
  assert.equal(scene.isEntryReplayComplete('construction_ppe_entry_check', false, steps, groups.slice(0, 1)), false)
  assert.equal(scene.isEntryReplayComplete('construction_ppe_entry_check', false, [], []), false)
  assert.equal(scene.isEntryReplayComplete('construction_ppe_review', false, steps, groups), false)
  assert.equal(scene.isEntryReplayComplete('construction_ppe_entry_check', false, steps, [groups[0], { ...groups[1], observations: [] }]), false)
  assert.equal(scene.isEntryReplayComplete('construction_ppe_entry_check', false, steps, [groups[0], { ...groups[1], chosen: 'deny_entry' }]), false)
  const appended = groups.map(g => ({ ...g, observations: [...g.observations, { command: 'review last_record', confirm: true, text: 'read-only duplicate' }] }))
  assert.equal(scene.isEntryReplayComplete('construction_ppe_entry_check', false, steps, appended), true)
})
