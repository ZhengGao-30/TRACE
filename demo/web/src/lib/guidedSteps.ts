/**
 * Guided-view data layer.
 *
 * Turns raw action strings ("verify loto_tag valve=V-103") into human language
 * ("Verify the lock-out tag on valve V-103"), and groups the many small
 * decisions of a run into a few big, named phases that the workflow strip can
 * present to a non-expert audience.
 *
 * Phases are assigned by an ordered rule list + a monotone clamp: a step
 * classified into an EARLIER phase than the current one stays in the current
 * phase (the trajectory only moves forward). Steps no rule claims inherit the
 * current phase, so unknown actions never break the strip.
 */

export interface GuidedStep {
  i: number
  raw: string
  /** full verb phrase: "Verify the lock-out tag on valve V-103" */
  label: string
  /** short chip text: "Lock-out tag · V-103" */
  chip: string
  /** plural chip used when consecutive same-mkey steps merge: "Lock-out tags ×3" */
  group?: string
  /** merge key: consecutive chips sharing it collapse into one "×N" chip */
  mkey: string
}

export interface Phase {
  id: string
  num: number
  title: string
  desc: string
  steps: GuidedStep[]
}

// ---------------------------------------------------------------------------
// small text helpers
// ---------------------------------------------------------------------------

const GAS_SUB: Record<string, string> = { O2: 'O₂', H2S: 'H₂S', CO: 'CO', LEL: 'LEL' }
const pretty = (s: string) => s.replace(/_/g, ' ')
/** "tomato 2" → "tomato", "sinkbasin" → "sink basin" */
const friendly = (s: string) => pretty(s).replace(/\s+\d+$/, '')

interface Parsed {
  verb: string
  /** object tokens joined with '_' ("loto_tag"), '' when none */
  obj: string
  params: Record<string, string>
}

function parse(raw: string): Parsed {
  const toks = raw.trim().split(/\s+/)
  const objToks: string[] = []
  const params: Record<string, string> = {}
  for (const tk of toks.slice(1)) {
    const eq = tk.indexOf('=')
    if (eq > 0) params[tk.slice(0, eq)] = tk.slice(eq + 1)
    else objToks.push(tk)
  }
  return { verb: toks[0] ?? '', obj: objToks.join('_'), params }
}

// ---------------------------------------------------------------------------
// humaniser — HSE operations language ("verb object key=value …")
// ---------------------------------------------------------------------------

interface Human { label: string; chip: string }
type Rule = (p: Parsed) => Human

/** Plural chip labels for merged runs of the same action (keyed by object). */
const HSE_GROUPS: Record<string, string> = {
  competency_register: 'Qualification look-ups',
  medical_clearance: 'Medical clearances',
  loto_tag: 'Lock-out tags',
  energy_isolation: 'Power isolations',
  ventilation_fan: 'Ventilation fans',
  gas_meter: 'Gas readings',
  evidence: 'Evidence items',
  containment: 'Containment actions',
  geotagged_sample: 'Geotagged samples',
  sensor_calibration: 'Sensor calibrations',
  calibrated_sensor: 'Sensor readings',
  remediation: 'Clean-up steps',
  scene: 'Photographs',
  compliance_report: 'Compliance report',
}

const HSE_RULES: Record<string, Rule> = {
  // confined-space permit
  competency_register: (p) => ({ label: `Look up ${p.params.worker}'s qualifications`, chip: `${p.params.worker} · qualifications` }),
  scba_pressure: (p) => ({ label: `Check breathing apparatus ${p.params.unit ?? ''}`.trim(), chip: 'Breathing apparatus' }),
  gas_detector_count: (p) => ({ label: `Confirm gas detectors for ${p.params.entrants ?? ''} entrants`.trim(), chip: 'Gas detectors' }),
  rescue_team: () => ({ label: 'Confirm the rescue team is on standby', chip: 'Rescue team' }),
  ventilation_fan: (p) => ({ label: `Check ventilation fan ${p.params.id ?? ''}`.trim(), chip: `Ventilation ${p.params.id ?? ''}`.trim() }),
  energy_isolation: (p) => ({ label: `Verify power isolation ${p.params.source ?? ''}`.trim(), chip: `Power isolation ${p.params.source ?? ''}`.trim() }),
  signage_posted: () => ({ label: 'Check that warning signage is posted', chip: 'Warning signage' }),
  incident_history: () => ({ label: "Review the site's incident history", chip: 'Incident history' }),
  communication_link: (p) => ({ label: `Test the ${p.params.channel ?? ''} radio link`.trim(), chip: 'Radio link' }),
  previous_permit: () => ({ label: 'Review the previous permit', chip: 'Previous permit' }),
  medical_clearance: (p) => ({ label: `Confirm ${p.params.worker} is medically cleared`, chip: `${p.params.worker} · medical` }),
  retrieval_equipment: (p) => ({ label: `Check the rescue tripod ${p.params.id ?? ''}`.trim(), chip: 'Rescue tripod' }),
  lighting: () => ({ label: 'Check the lighting in the tank', chip: 'Lighting' }),
  loto_tag: (p) => ({ label: `Verify the lock-out tag on valve ${p.params.valve ?? ''}`.trim(), chip: `Lock-out tag ${p.params.valve ?? ''}`.trim() }),
  harness_inspection: (p) => ({ label: `Inspect harness ${p.params.id ?? ''}`.trim(), chip: 'Harness' }),
  weather_forecast: () => ({ label: 'Check the weather forecast', chip: 'Weather' }),
  attendant_assigned: () => ({ label: 'Confirm an attendant is assigned', chip: 'Attendant' }),
  barrier_setup: () => ({ label: 'Verify the barriers are set up', chip: 'Barriers' }),
  standby_vehicle: () => ({ label: 'Confirm a standby vehicle is ready', chip: 'Standby vehicle' }),
  purge_duration: () => ({ label: 'Verify the tank purge duration', chip: 'Purge duration' }),
  meter_calibration: () => ({ label: 'Verify the gas meter calibration', chip: 'Meter calibration' }),
  gas_meter: (p) => {
    const ch = GAS_SUB[p.params.channel ?? ''] ?? pretty(p.params.channel ?? 'gas')
    return { label: `Read the ${ch} level`, chip: `${ch} reading` }
  },
  msds: (p) => ({ label: `Review the safety data sheet (${pretty(p.params.substance ?? '')})`, chip: 'Safety data sheet' }),
  first_aid_station: () => ({ label: 'Check the first-aid station', chip: 'First aid' }),
  evidence: (p) => ({ label: `Attach the ${pretty(p.params.item ?? 'evidence')}`, chip: `Evidence · ${pretty(p.params.item ?? '')}`.trim() }),
  permit_record: () => ({ label: 'Compile the permit record', chip: 'Permit record' }),
  countersign: (p) => ({ label: `Request the countersignature from ${p.params.worker ?? ''}`.trim(), chip: 'Countersign' }),
  control_room: () => ({ label: 'Notify the control room', chip: 'Notify control room' }),
  entrants: () => ({ label: 'Brief the entrants before entry', chip: 'Brief entrants' }),
  permit: (p) => ({ label: `Issue the permit${p.params.validity ? ` (valid ${p.params.validity})` : ''}`, chip: 'Issue permit' }),

  // spill response
  containment: (p) => ({ label: `Log containment: ${pretty(p.params.action ?? '')}`, chip: 'Containment' }),
  drain_plan: () => ({ label: 'Verify the drain plan', chip: 'Drain plan' }),
  bund_capacity: (p) => ({ label: `Check bund capacity ${p.params.id ?? ''}`.trim(), chip: 'Bund capacity' }),
  licence_conditions: (p) => ({ label: `Review the licence conditions ${p.params.ref ?? ''}`.trim(), chip: 'Licence conditions' }),
  tide_state: () => ({ label: 'Check the tide state at the outfall', chip: 'Tide state' }),
  ppe_compliance: () => ({ label: "Verify the team's PPE compliance", chip: 'PPE check' }),
  source: (p) => ({
    label: `${p.verb === 'isolate' ? 'Isolate' : 'Identify'} the spill source (${pretty(p.params.equipment ?? '')})`,
    chip: 'Spill source',
  }),
  site_supervisor: () => ({ label: 'Notify the site supervisor', chip: 'Notify supervisor' }),
  scene: (p) => ({ label: `Photograph the scene (${pretty(p.params.location ?? '')})`, chip: 'Photograph' }),
  sensor_calibration: (p) => ({ label: `Verify sensor ${p.params.id ?? ''} is calibrated`.trim(), chip: `Calibrate ${p.params.id ?? ''}`.trim() }),
  weather_conditions: () => ({ label: 'Record the weather conditions', chip: 'Weather record' }),
  calibrated_sensor: (p) => ({ label: `Read sensor ${p.params.id ?? ''} at ${pretty(p.params.location ?? '')}`.trim(), chip: `${p.params.id ?? ''} reading`.trim() }),
  operator: (p) => ({ label: `Interview operator ${p.params.id ?? ''}`.trim(), chip: 'Interview' }),
  release_volume: () => ({ label: 'Estimate the release volume', chip: 'Release volume' }),
  neutralising_stock: (p) => ({ label: `Check neutralising stock (${pretty(p.params.item ?? '')})`, chip: 'Neutralising stock' }),
  spill_history: () => ({ label: "Review the site's spill history", chip: 'Spill history' }),
  reading: (p) => ({ label: `Compare ${pretty(p.params.reading ?? 'the reading')} against the licence limit`, chip: 'Licence comparison' }),
  geotagged_sample: (p) => ({ label: `Capture geotagged sample ${p.params.id ?? ''}`.trim(), chip: `Sample ${p.params.id ?? ''}`.trim() }),
  chain_of_custody: () => ({ label: 'Verify the chain of custody', chip: 'Chain of custody' }),
  remediation: (p) => ({ label: `Record clean-up: ${pretty(p.params.action ?? '')}`, chip: 'Clean-up' }),
  regulator: (p) => ({ label: `Notify the regulator (${p.params.ref ?? ''})`, chip: 'Notify regulator' }),
  compliance_report: (p) => ({
    label: `${p.verb === 'file' ? 'File' : 'Compile'} the compliance report ${p.params.ref ?? ''}`.trim(),
    chip: 'Compliance report',
  }),
}

function humanizeHse(raw: string): { h: Human; mkey: string; verb: string; obj: string } {
  const p = parse(raw)
  const rule = HSE_RULES[p.obj]
  if (rule) return { h: rule(p), mkey: `${p.verb} ${p.obj}`, verb: p.verb, obj: p.obj }
  // fallback: "verb object key=value" → readable sentence
  const rest = [pretty(p.obj), ...Object.entries(p.params).map(([k, v]) => `${pretty(k)} ${v}`)]
    .filter(Boolean).join(' · ')
  const label = `${p.verb[0]?.toUpperCase() ?? ''}${p.verb.slice(1)} ${rest}`.trim()
  return { h: { label, chip: label }, mkey: `${p.verb} ${p.obj}`, verb: p.verb, obj: p.obj }
}

// ---------------------------------------------------------------------------
// humaniser — ALFWorld household commands ("go to cabinet 5", "take tomato 2 …")
// ---------------------------------------------------------------------------

function humanizeAlf(raw: string): { h: Human; mkey: string; verb: string; obj: string } {
  const m = (re: RegExp) => raw.match(re)
  let mm
  if ((mm = m(/^go to (.+)$/))) {
    const h = { label: `Go to the ${friendly(mm[1])}`, chip: 'Move' }
    return { h, mkey: 'go', verb: 'go', obj: '' }
  }
  if ((mm = m(/^take (.+?) from (.+)$/))) {
    const h = { label: `Pick up the ${friendly(mm[1])}`, chip: `Pick up ${friendly(mm[1])}` }
    return { h, mkey: 'take', verb: 'take', obj: '' }
  }
  if ((mm = m(/^(?:put|move) (.+?) (?:in|on|to) (.+)$/))) {
    const h = { label: `Place the ${friendly(mm[1])} in the ${friendly(mm[2])}`, chip: `Place ${friendly(mm[1])}` }
    return { h, mkey: 'place', verb: 'put', obj: '' }
  }
  if ((mm = m(/^(clean|heat|cool) (.+?) with (.+)$/))) {
    const v = mm[1]
    const h = { label: `${v[0].toUpperCase() + v.slice(1)} the ${friendly(mm[2])}`, chip: `${v[0].toUpperCase() + v.slice(1)} ${friendly(mm[2])}` }
    return { h, mkey: v, verb: v, obj: '' }
  }
  if ((mm = m(/^(open|close) (.+)$/))) {
    const v = mm[1]
    const h = { label: `${v[0].toUpperCase() + v.slice(1)} the ${friendly(mm[2])}`, chip: 'Move' }
    return { h, mkey: 'go', verb: 'go', obj: '' }
  }
  const h = { label: pretty(raw), chip: pretty(raw) }
  return { h, mkey: raw.split(' ')[0] ?? raw, verb: raw.split(' ')[0] ?? '', obj: '' }
}

/** Humanise one raw action string for the given scenario. */
export function humanize(raw: string, scenario: string): { label: string; chip: string; group?: string; mkey: string; verb: string; obj: string } {
  if (scenario === 'alfworld') {
    const r = humanizeAlf(raw)
    return { ...r.h, mkey: r.mkey, verb: r.verb, obj: r.obj, group: r.verb === 'go' ? 'Move around' : undefined }
  }
  const r = humanizeHse(raw)
  return { ...r.h, mkey: r.mkey, verb: r.verb, obj: r.obj, group: HSE_GROUPS[r.obj] }
}

// ---------------------------------------------------------------------------
// phase definitions
// ---------------------------------------------------------------------------

interface PhaseDef {
  id: string
  title: string
  desc: string
  /** HSE: match on the parsed object name */
  objs?: string[]
  /** ALFWorld: match on the verb */
  verbs?: string[]
}

const CONFINED_PHASES: PhaseDef[] = [
  { id: 'background', title: 'Background checks', desc: 'Site history, crew competency, rescue team on standby.',
    objs: ['competency_register', 'scba_pressure', 'gas_detector_count', 'rescue_team', 'ventilation_fan',
           'energy_isolation', 'signage_posted', 'incident_history', 'communication_link', 'previous_permit'] },
  { id: 'people', title: 'Verify people & gear', desc: 'Medical clearance, harnesses, lock-out tags, barriers.',
    objs: ['medical_clearance', 'retrieval_equipment', 'lighting', 'loto_tag', 'harness_inspection',
           'weather_forecast', 'attendant_assigned', 'barrier_setup', 'standby_vehicle', 'purge_duration',
           'meter_calibration'] },
  { id: 'gas', title: 'Gas testing', desc: 'Read O₂, CO, LEL and H₂S levels inside the tank.',
    objs: ['gas_meter', 'msds', 'first_aid_station'] },
  { id: 'signoff', title: 'Evidence & sign-off', desc: 'Attach certificates, compile the record, countersign.',
    objs: ['evidence', 'permit_record', 'countersign', 'control_room', 'entrants'] },
  { id: 'issue', title: 'Issue permit', desc: 'The permit, valid for 8 hours.', objs: ['permit'] },
]

const SPILL_PHASES: PhaseDef[] = [
  { id: 'contain', title: 'Contain the spill', desc: 'Stop the release and protect the drains.',
    objs: ['containment', 'drain_plan', 'bund_capacity'] },
  { id: 'assess', title: 'Assess & measure', desc: 'Licence conditions, sensors, interviews, photographs.',
    objs: ['licence_conditions', 'tide_state', 'ppe_compliance', 'source', 'site_supervisor', 'scene', 'msds',
           'sensor_calibration', 'weather_conditions', 'weather_forecast', 'calibrated_sensor', 'operator',
           'release_volume', 'neutralising_stock', 'spill_history', 'reading'] },
  { id: 'samples', title: 'Samples & clean-up', desc: 'Geotagged samples, chain of custody, remediation.',
    objs: ['geotagged_sample', 'chain_of_custody', 'remediation'] },
  { id: 'report', title: 'Report & notify', desc: 'Attach evidence, notify the regulator, file the report.',
    objs: ['evidence', 'regulator', 'compliance_report'] },
]

const ALF_PHASES: PhaseDef[] = [
  { id: 'search', title: 'Search the room', desc: 'Look around and find the object.',
    verbs: ['go', 'look', 'examine', 'inventory'] },
  { id: 'pickup', title: 'Pick it up & carry it over', desc: 'Take the object and carry it to where it is needed.',
    verbs: ['take', 'open', 'close'] },
  { id: 'prepare', title: 'Prepare it', desc: 'Clean, heat or cool the object as the task asks.',
    verbs: ['clean', 'heat', 'cool', 'use'] },
  { id: 'place', title: 'Put it in place', desc: 'Place the object where it belongs.',
    verbs: ['put', 'move'] },
]

const GENERIC_PHASES: PhaseDef[] = [
  { id: 'work', title: 'The agent at work', desc: 'Every decision quietly carries the watermark.' },
]

function defsFor(scenario: string, taskType?: string): PhaseDef[] {
  const tt = taskType ?? ''
  if (tt.includes('confined_space')) return CONFINED_PHASES
  if (tt.includes('spill')) return SPILL_PHASES
  if (scenario === 'alfworld') return ALF_PHASES
  if (scenario === 'hse') return GENERIC_PHASES
  return GENERIC_PHASES
}

/**
 * Build the phase-grouped workflow from an ordered list of raw action strings.
 * Unknown steps inherit the current phase; phases left empty are dropped and
 * the rest re-numbered, so the strip never shows a hollow stage.
 */
export function buildWorkflow(actions: string[], scenario: string, taskType?: string): Phase[] {
  const defs = defsFor(scenario, taskType)
  const assigned: number[] = []
  let cur = 0
  for (const raw of actions) {
    const { verb, obj } = scenario === 'alfworld' ? humanizeAlf(raw) : humanizeHse(raw)
    let idx = defs.findIndex((d) =>
      (d.objs && d.objs.includes(obj)) || (d.verbs && d.verbs.includes(verb)))
    if (idx < 0) idx = cur // unclaimed step: stay in the current phase
    cur = Math.max(cur, idx) // monotone clamp: never move backwards
    assigned.push(cur)
  }

  const phases: Phase[] = []
  defs.forEach((d, di) => {
    const steps: GuidedStep[] = []
    actions.forEach((raw, i) => {
      if (assigned[i] !== di) return
      const h = humanize(raw, scenario)
      steps.push({ i, raw, label: h.label, chip: h.chip, group: h.group, mkey: h.mkey })
    })
    if (steps.length) phases.push({ id: d.id, num: phases.length + 1, title: d.title, desc: d.desc, steps })
  })
  return phases
}

/** Total number of small steps across all phases. */
export function totalSteps(phases: Phase[]): number {
  return phases.reduce((n, p) => n + p.steps.length, 0)
}
