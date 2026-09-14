
import { PPE_TASK, PPE_PHASES, ppeActionLabel } from './ppeInspection'

export interface GuidedStep {
  i: number
  raw: string
  label: string
  chip: string
  group?: string
  mkey: string
}

export interface Phase {
  id: string
  num: number
  title: string
  desc: string
  steps: GuidedStep[]
}


export interface WorkflowAction {

  i?: number
  wm_index?: number | null
  chosen?: string
  action?: string
  stage_id?: string
  phase?: string
  label?: string
  evidence_ids?: string[]
}

export interface WorkflowStage {
  id: string
  title: string
  description?: string
  desc?: string
}

const pretty = (s: string) => s.replaceAll('_', ' ')
const friendly = (s: string) => pretty(s).replace(/\s+\d+$/, '')

interface HumanAction {
  label: string
  chip: string
  group?: string
  mkey: string
  verb: string
  obj: string
}


export function humanize(raw: string, scenario: string): HumanAction {
  let match: RegExpMatchArray | null
  const make = (label: string, chip: string, verb: string, mkey = verb): HumanAction => ({
    label, chip, verb, mkey, obj: '', group: verb === 'go' ? 'Move around' : undefined,
  })
  if (scenario === 'hse') {
    const label = ppeActionLabel(raw, '')
    if (label) return make(label, label, raw.split(' ')[0] ?? '')
  }
  if (scenario === 'alfworld') {
    if ((match = raw.match(/^go to (.+)$/))) return make(`Go to the ${friendly(match[1])}`, 'Move', 'go')
    if ((match = raw.match(/^take (.+?) from (.+)$/))) return make(`Pick up the ${friendly(match[1])}`, `Pick up ${friendly(match[1])}`, 'take')
    if ((match = raw.match(/^(?:put|move) (.+?) (?:in|on|to) (.+)$/))) {
      return make(`Place the ${friendly(match[1])} in the ${friendly(match[2])}`, `Place ${friendly(match[1])}`, 'put', 'place')
    }
    if ((match = raw.match(/^(clean|heat|cool) (.+?) with (.+)$/))) {
      const verb = match[1]
      const title = verb[0].toUpperCase() + verb.slice(1)
      return make(`${title} the ${friendly(match[2])}`, `${title} ${friendly(match[2])}`, verb)
    }
    if ((match = raw.match(/^(open|close) (.+)$/))) {
      const verb = match[1]
      return make(`${verb[0].toUpperCase() + verb.slice(1)} the ${friendly(match[2])}`, 'Move', 'go')
    }
  }
  const text = pretty(raw)
  const label = text ? text[0].toUpperCase() + text.slice(1) : 'Action not recorded'
  return make(label, label, raw.split(' ')[0] ?? '')
}

interface PhaseDef {
  id: string
  title: string
  desc: string
  verbs?: string[]
}

const CONSTRUCTION_PHASES: PhaseDef[] = [
  { id: 'identify', title: 'Identify incident', desc: 'Confirm the event time, site and worker before reviewing the case.' },
  { id: 'ppe', title: 'Review PPE', desc: 'Inspect footwear, workwear and the site requirements before recording a finding.' },
  { id: 'timeline', title: 'Reconstruct events', desc: 'Establish the falling-object sequence from the available evidence.' },
  { id: 'corroborate', title: 'Cross-check evidence', desc: 'Check sources and flag missing or conflicting information.' },
  { id: 'report', title: 'Submit review', desc: 'Compile, validate and submit the evidence-backed incident report.' },
]

const ENTRY_PHASES: PhaseDef[] = [
  { id: 'identify', title: 'Identify worker', desc: 'Establish who is requesting entry and which site requirements apply.' },
  { id: 'inspect', title: 'Inspect PPE', desc: 'Choose which available observations to inspect. A check can be missed; missing evidence is not a pass.' },
  { id: 'decide', title: 'Decide entry', desc: 'Record the Agent’s assessment and entry decision. Safety compliance is evaluated separately from whether a tool can execute.' },
]

export const SHIFT_PHASES: PhaseDef[] = [
  { id: 'briefing', title: 'Briefing', desc: 'Read the shift plan and safety requirements before inspecting the site.' },
  { id: 'identity', title: 'Identity', desc: 'Verify the worker and the assigned work using the available records.' },
  { id: 'ppe', title: 'PPE check', desc: 'Inspect protective equipment and record an evidence-based assessment.' },
  { id: 'admission', title: 'Admission', desc: 'Keep the agent’s recommendation separate from the controller’s effective admission transaction. An injected fault is not a sampled action.' },
  { id: 'patrol', title: 'Patrol', desc: 'Continue the duty checks while the synthetic site clock advances. Site events are not watermarked agent choices.' },
  { id: 'response', title: 'Response', desc: 'Respond to the recorded site conditions and complete the shift record. Source attribution and safety findings remain separate.' },
]

const HOUSEHOLD_PHASES: PhaseDef[] = [
  { id: 'search', title: 'Search the room', desc: 'Look around and find the object.', verbs: ['go', 'look', 'examine', 'inventory'] },
  { id: 'pickup', title: 'Pick it up & carry it over', desc: 'Take the object and carry it to where it is needed.', verbs: ['take', 'open', 'close'] },
  { id: 'prepare', title: 'Prepare it', desc: 'Clean, heat or cool the object as the task asks.', verbs: ['clean', 'heat', 'cool', 'use'] },
  { id: 'place', title: 'Put it in place', desc: 'Place the object where it belongs.', verbs: ['put', 'move'] },
]






export function buildWorkflow(
  actions: (string | WorkflowAction)[], scenario: string, taskType?: string, stages?: WorkflowStage[],
): Phase[] {
  const entryCheck = taskType === 'construction_ppe_entry_check'
  const shift = taskType === 'construction_ppe_shift'
  const construction = shift || entryCheck || taskType === PPE_TASK || taskType === 'construction_ppe_incident_review'
  const defs: PhaseDef[] = taskType === PPE_TASK ? [...PPE_PHASES] : stages?.length
    ? stages.map((stage) => ({ ...stage, desc: stage.description ?? stage.desc ?? '' }))
    : shift ? [...SHIFT_PHASES] : entryCheck ? [...ENTRY_PHASES] : construction ? [...CONSTRUCTION_PHASES]
      : scenario === 'alfworld' ? [...HOUSEHOLD_PHASES]
        : [{ id: 'work', title: 'Recorded actions', desc: 'Review the available execution record.' }]
  const records = actions.map((action) => typeof action === 'string' ? { chosen: action } : action)
  const explicit = construction || !!stages?.length || records.some((record) => !!record.stage_id)
  if (explicit) {
    for (const record of records) {
      const id = record.stage_id || record.phase || 'unclassified'
      if (!defs.some((def) => def.id === id)) {
        defs.push({ id, title: id === 'unclassified' ? 'Stage not recorded' : pretty(id), desc: 'Stage metadata from the recorded run.' })
      }
    }
  }
  let currentPhase = 0
  const assignments = records.map((record) => {
    if (explicit) return defs.findIndex((def) => def.id === (record.stage_id || record.phase || 'unclassified'))
    const action = humanize(record.chosen ?? record.action ?? '', scenario)
    const found = defs.findIndex((def) => def.verbs?.includes(action.verb))
    currentPhase = Math.max(currentPhase, found < 0 ? currentPhase : found)
    return currentPhase
  })
  const phases: Phase[] = []
  defs.forEach((def, phaseIndex) => {
    const steps: GuidedStep[] = []
    records.forEach((record, i) => {
      if (assignments[i] !== phaseIndex) return
      const raw = record.chosen ?? record.action ?? ''
      const action = humanize(raw, scenario)
      const label = taskType === PPE_TASK ? ppeActionLabel(raw, record.label ?? action.label) : record.label ?? action.label
      const chip = taskType === PPE_TASK ? label : record.label ?? action.chip
      steps.push({ i: record.i ?? i, raw, label, chip, group: action.group, mkey: action.mkey })
    })
    if (steps.length) phases.push({ id: def.id, num: phases.length + 1, title: def.title, desc: def.desc, steps })
  })
  return phases
}

export function totalSteps(phases: Phase[]): number {
  return phases.reduce((sum, phase) => sum + phase.steps.length, 0)
}
