import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/constructionScene.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const scene = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)



const digital = new Set([
  'read_shift_handover', 'read_work_plan', 'read_site_rules', 'check_ppe_requirements',
  'read_role_authorization', 'verify_authorization_addendum', 'verify_training_certificate',
  'read_previous_clearance', 'verify_footwear_model', 'request_ppe_replacement',
  'compile_admission_evidence', 'assess_compliant', 'assess_non_compliant', 'assess_uncertain',
  'recommend_approve', 'recommend_deny', 'recommend_hold', 'approve_entry', 'deny_entry', 'hold_for_review',
  'read_admission_receipt', 'read_patrol_assignment', 'read_site_alert',
  'report_observed_incident', 'preserve_observation_refs', 'read_supervisor_response', 'close_shift_handover',
])
const physical = new Set([
  'inspect_gate_status', 'scan_worker_badge', 'match_current_identity',
  'inspect_footwear_wide', 'inspect_footwear_detail', 'inspect_current_workwear',
  'verify_rectification', 'inspect_boundary_beacon', 'observe_site',
  'inspect_reported_location', 'confirm_response_boundary',
  'inspect_footwear', 'inspect_workwear', 'read_footwear_alternate',
])
const sampleFiles = [
  'hse_construction-CS01-scaffold__shift_fault_demo.json',
  'hse_construction-CS02-timber_yard__shift_fault_demo.json',
]

for (const file of sampleFiles) {
  const pair = JSON.parse(await readFile(new URL(`../public/static/compare/${file}`, import.meta.url), 'utf8'))
  for (const arm of ['standard', 'trace']) {
    test(`${file}: ${arm} follows digital/physical semantics without changing logged sources`, () => {
      const steps = pair[arm].steps
      assert.ok(steps.length > 0, 'the test must cover a real exported run')
      const counts = { tablet: 0, inspect: 0, wait: 0 }
      let position = [-3.8, 0, 2.6]
      for (const step of steps) {
        const command = step.action.split(/\s+/)[0]
        const injected = step.event_kind === 'injected_action'
        assert.ok(injected || digital.has(command) || physical.has(command), `Unreviewed command classification: ${command}`)
        const expected = injected ? 'wait' : digital.has(command) ? 'tablet' : 'inspect'
        const station = scene.stationForReview(step.action, step.station_id)
        assert.ok(station, `${command}: logged source station exists`)
        assert.equal(station.id, step.station_id, `${command}: preserve the log's source, even for digital tools`)
        const unchanged = structuredClone({ step, station, position })
        const plan = scene.reviewActionPlan(position, step.action, station, injected)
        assert.equal(scene.reviewActionMode(step.action, injected), expected, command)
        assert.equal(plan.mode, expected, command)
        assert.deepEqual({ step, station, position }, unchanged, `${command}: planning must not mutate source metadata or the current position`)
        if (expected !== 'inspect') {
          assert.deepEqual(plan.route, [], `${command}: no trip to a digital source or injected action`)
          assert.equal(plan.target, undefined, `${command}: no physical scanning beam`)
          assert.equal(plan.duration, expected === 'tablet' ? 2.2 : .8)
        } else {
          assert.ok(plan.target, `${command}: physical inspection has a target`)
          const distance = Math.hypot(position[0] - station.position[0], position[2] - station.position[2])
          if (distance < .05) assert.deepEqual(plan.route, [], `${command}: do not loop around a station already reached`)
          else assert.deepEqual(plan.route.at(-1), station.position, `${command}: finish at the actual inspection station`)
          if (plan.route.length) position = [...plan.route.at(-1)]
        }
        counts[expected]++
      }
      assert.ok(counts.tablet > 0 && counts.inspect > 0 && counts.wait > 0,
        'each real arm must cover digital work, physical inspection and the injected transaction')
    })
  }
}

test('digital actions use a tablet in place regardless of the source station', () => {
  for (const command of digital) {
    for (const station of scene.EVIDENCE_STATIONS) {
      const from = [3.4, 0, 1.8]
      const plan = scene.reviewActionPlan(from, `${command} site=QA worker=QA version=test`, station)
      assert.equal(plan.mode, 'tablet', command)
      assert.deepEqual(plan.route, [], command)
      assert.equal(plan.target, undefined, command)
      assert.equal(plan.duration, 2.2)
      assert.deepEqual(from, [3.4, 0, 1.8])
    }
  }
})

test('supplementary footwear reads remain physical and v3 targets separate shoes from clothing', () => {
  const ppe = scene.evidenceStation('ppe')
  for (const command of ['inspect_footwear', 'read_footwear_alternate', 'inspect_footwear_wide', 'inspect_footwear_detail', 'verify_rectification']) {
    const plan = scene.reviewActionPlan([-3.8, 0, 2.6], command, ppe)
    assert.equal(plan.mode, 'inspect', command)
    assert.deepEqual(plan.target, [-2.9, .12, 2.45], `${command}: inspect footwear, not the upper body`)
    assert.deepEqual(plan.route.at(-1), ppe.position)
  }
  for (const command of ['inspect_workwear', 'inspect_current_workwear']) {
    assert.deepEqual(scene.reviewActionPlan([-3.8, 0, 2.6], command, ppe).target, [-2.9, .9, 2.45])
  }
})

test('injected approval and inert L2 records override ordinary tablet/inspection presentation', () => {
  const entry = scene.evidenceStation('entry')
  assert.equal(scene.reviewActionMode('approve_entry'), 'tablet', 'ordinary agent decision is a tablet action')
  for (const command of ['approve_entry', 'inspect_footwear', 'read_site_rules', undefined]) {
    assert.equal(scene.reviewActionMode(command, true), 'wait')
    const plan = scene.reviewActionPlan([3.4, 0, 1.8], command, entry, true)
    assert.equal(plan.mode, 'wait')
    assert.deepEqual(plan.route, [])
    assert.equal(plan.target, undefined)
  }
  for (const command of ['review last_record', '  review last_record  ']) {
    assert.equal(scene.reviewActionMode(command), 'wait')
    assert.deepEqual(scene.reviewActionPlan([3.4, 0, 1.8], command, entry).route, [])
    assert.equal(scene.reviewActionPlan([3.4, 0, 1.8], command, entry).target, undefined)
  }
})

test('unknown commands do not invent destinations; an explicit physical station remains usable', () => {
  for (const command of ['unknown_tool', undefined]) {
    assert.equal(scene.stationForReview(command), undefined)
    const missing = scene.reviewActionPlan([0, 0, 3.5], command)
    assert.equal(missing.mode, 'wait')
    assert.deepEqual(missing.route, [])
    assert.equal(missing.target, undefined)
  }
  const station = scene.evidenceStation('timber')
  const explicit = scene.reviewActionPlan([0, 0, 3.5], 'unknown_tool', station)
  assert.equal(explicit.mode, 'inspect')
  assert.deepEqual(explicit.target, station.lookAt)
  assert.deepEqual(explicit.route.at(-1), station.position)
})

test('another physical check at the same station uses a gesture instead of a travel loop', () => {
  const ppe = scene.evidenceStation('ppe')
  for (const command of ['inspect_footwear_wide', 'inspect_current_workwear', 'read_footwear_alternate']) {
    const plan = scene.reviewActionPlan([...ppe.position], command, ppe)
    assert.equal(plan.mode, 'inspect')
    assert.deepEqual(plan.route, [])
    assert.ok(plan.target)
    assert.equal(plan.duration, 1.5)
  }
})

test('digital work after a patrol does not send the robot back to the records desk', () => {
  const site = scene.evidenceStation('timber')
  const patrol = scene.reviewActionPlan([-3.8, 0, 2.6], 'observe_site', site)
  const afterPatrol = [...patrol.route.at(-1)]
  const sequence = [
    ['read_site_alert', 'report'], ['preserve_observation_refs', 'records'],
    ['report_observed_incident', 'report'], ['read_supervisor_response', 'report'],
    ['close_shift_handover', 'records'],
  ]
  for (const [command, sourceId] of sequence) {
    const sourceStation = scene.evidenceStation(sourceId)
    const plan = scene.reviewActionPlan(afterPatrol, command, sourceStation)
    assert.equal(plan.mode, 'tablet')
    assert.deepEqual(plan.route, [])
    assert.equal(plan.target, undefined)
    assert.equal(sourceStation.id, sourceId)
    assert.deepEqual(afterPatrol, site.position, `${command}: preserve the reached patrol location`)
  }
})

const resumeStep = (i, action, station_id, event_kind = 'agent_action') => ({ i, action, station_id, event_kind })
const completedGroup = step => ({
  i: step.i, chosen: step.action, result: 'Recorded action result',
  observations: [{ command: step.action, confirm: false, text: 'Recorded action result' }],
})

test('a remounted fresh digital-only prefix remains at entry', () => {
  const steps = [resumeStep(0, 'read_site_rules', 'ppe'), resumeStep(1, 'read_work_plan', 'records')]
  assert.deepEqual(scene.reviewResumePose(steps, steps.map(completedGroup)), { position: [-3.8, 0, 2.6], yaw: 0 })
  assert.deepEqual(scene.reviewResumePose(steps, []), { position: [-3.8, 0, 2.6], yaw: 0 })
})

test('remounting during digital work restores the completed physical site visit, not its digital source', () => {
  const steps = [
    resumeStep(0, 'observe_site', 'timber'),
    resumeStep(1, 'preserve_observation_refs', 'records'),
    resumeStep(2, 'report_observed_incident', 'report'),
    resumeStep(3, 'read_supervisor_response', 'report'),
  ]
  const sitePose = scene.reviewResumePose(steps, [completedGroup(steps[0])])
  assert.deepEqual(sitePose.position, scene.evidenceStation('timber').position)
  const groups = steps.map(completedGroup)
  groups[2].observations.push({ command: 'review last_record', confirm: true, text: 'Inert record copy' })
  assert.deepEqual(scene.reviewResumePose(steps, groups), sitePose)
  assert.ok(Number.isFinite(sitePose.yaw))
})

test('a buffered current physical action cannot move the remounted robot before its main result arrives', () => {
  const steps = [resumeStep(0, 'inspect_footwear', 'ppe'), resumeStep(1, 'observe_site', 'timber')]
  const priorPose = scene.reviewResumePose(steps, [completedGroup(steps[0])])
  for (const pending of [
    { i: 1, chosen: 'observe_site', observations: [] },
    { i: 1, chosen: 'observe_site', result: '  ', observations: [{ command: 'observe_site', confirm: false, text: ' ' }] },
    { i: 1, chosen: 'observe_site', observations: [{ command: 'review last_record', confirm: true, text: 'A confirmation is not the main result' }] },
  ]) {
    assert.deepEqual(scene.reviewResumePose(steps, [completedGroup(steps[0]), pending]), priorPose)
  }
  assert.deepEqual(priorPose.position, scene.evidenceStation('ppe').position)
})

test('future, mismatched and skipped-step metadata cannot relocate a remounted robot', () => {
  const steps = [
    resumeStep(0, 'read_shift_handover', 'records'),
    resumeStep(1, 'inspect_footwear', 'ppe'),
    resumeStep(2, 'observe_site', 'timber'),
  ]
  const entry = { position: [-3.8, 0, 2.6], yaw: 0 }
  assert.deepEqual(scene.reviewResumePose(steps, [completedGroup(steps[0])]), entry,
    'future steps are metadata, not completed actions')
  assert.deepEqual(scene.reviewResumePose(steps, [completedGroup(steps[0]), { ...completedGroup(steps[2]), i: 1 }]), entry,
    'an action mismatch terminates the matched prefix')
  assert.deepEqual(scene.reviewResumePose(steps, [completedGroup(steps[0]), completedGroup(steps[2])]), entry,
    'a gap in group indexes must not jump over an uncompleted action')
  assert.deepEqual(scene.reviewResumePose(steps, [completedGroup(steps[2])]), entry,
    'a standalone future action is not a completed prefix')
})

test('injected approvals and L2-only records never replace the last completed physical pose', () => {
  const steps = [
    resumeStep(0, 'observe_site', 'timber'),
    resumeStep(1, 'approve_entry', 'entry', 'injected_action'),
    resumeStep(2, 'review last_record', 'records'),
  ]
  const expected = scene.reviewResumePose(steps, [completedGroup(steps[0])])
  assert.deepEqual(scene.reviewResumePose(steps, steps.map(completedGroup)), expected)
  assert.deepEqual(expected.position, scene.evidenceStation('timber').position)
})

test('restoring a pose does not mutate steps, buffered groups or the shared station coordinates', () => {
  const steps = [resumeStep(0, 'observe_site', 'timber'), resumeStep(1, 'read_site_alert', 'report')]
  const groups = steps.map(completedGroup)
  const before = structuredClone({ steps, groups, stations: scene.EVIDENCE_STATIONS })
  const pose = scene.reviewResumePose(steps, groups)
  assert.deepEqual({ steps, groups, stations: scene.EVIDENCE_STATIONS }, before)
  pose.position[0] = 123
  assert.deepEqual(scene.EVIDENCE_STATIONS, before.stations, 'the caller owns a copied position, not a station alias')
})
