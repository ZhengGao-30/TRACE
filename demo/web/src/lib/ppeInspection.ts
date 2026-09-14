export const PPE_TASK = 'construction_ppe_inspection'

// Display names only: recorded commands remain unchanged for replay and detection.
const ACTION_NAMES: Record<string, string> = {
  worker_identity: 'Check worker ID',
  work_assignment: "Check today's job",
  workwear_rule: 'Read clothing rules',
  footwear_rule: 'Read shoe rules',
  previous_clearance: 'Check the previous inspection',
  initial_workwear: 'Check sleeves and trousers',
  initial_fastening: 'Check clothing is fastened',
  initial_footwear_view: 'Look at the shoes',
  initial_shoe_label: 'Read the shoe model',
  initial_shoe_rating: 'Check toe protection',
  initial_shoe_condition: 'Check shoes for damage',
  request_correction: 'Ask worker to fix issues',
  replacement_stock: 'Check for spare shoes',
  replacement_certificate: 'Check the stock reply',
  change_confirmation: "Read the worker's reply",
  current_workwear: 'Recheck the clothing',
  current_shoe_label: 'Read the current shoe model',
  current_shoe_rating: 'Recheck toe protection',
  current_shoe_condition: 'Recheck shoes for damage',
  compile_checklist: 'Review all checks',
  ppe_conclusion: 'Record the result',
  preserve_evidence: 'Save inspection evidence',
  submit_report: 'Send the inspection report',
  archive_receipt: 'Check the report is saved',
}

const RECORD_METHODS: Record<string, string> = {
  worker_identity: 'Read ID details',
  work_assignment: 'Read job details',
  workwear_rule: 'Read the site rules',
  footwear_rule: 'Read the site rules',
  previous_clearance: 'Read the previous report',
  replacement_stock: 'Read stock details',
  change_confirmation: 'Read the saved reply',
  compile_checklist: 'Read the checklist',
  archive_receipt: 'Read the saved receipt',
}

const METHOD_NAMES: Record<string, string> = {
  desk: 'Check with site office',
  direct: 'Look directly',
  camera: 'View the close-up',
  tag: 'Read the shoe label',
  scan: 'Scan the shoe label',
  register: 'Look up the shoe model',
  certificate: 'Read the safety certificate',
  tablet: 'Send a tablet notice',
  bundle: 'Save an evidence index',
  references: 'Save links to observations',
  form: 'Send through the report form',
}

const RESULT_NAMES: Record<string, string> = {
  record_ppe_pass: 'Record: passed',
  record_ppe_fail: 'Record: not passed',
  record_ppe_hold: 'Record: needs review',
}

export function ppeActionLabel(command: string, fallback = '', revealed = false): string {
  if (RESULT_NAMES[command]) return revealed ? RESULT_NAMES[command] : 'Record the result'
  return ACTION_NAMES[command.split(' method=')[0]] ?? fallback
}

export function ppeActionMethodLabel(command: string, revealed = false): string {
  if (RESULT_NAMES[command]) return revealed ? RESULT_NAMES[command].replace('Record: ', 'Result: ') : ''
  const [action, method] = command.split(' method=')
  if (!ACTION_NAMES[action]) return ''
  if (method === 'record') return RECORD_METHODS[action] ?? 'Read the saved details'
  if (method === 'desk' && ['request_correction', 'submit_report'].includes(action)) return 'Send through site office'
  if (action === 'replacement_certificate') {
    if (method === 'register') return 'Check the stock list'
    if (method === 'certificate') return 'Read the supporting document'
  }
  return METHOD_NAMES[method] ?? ''
}

export function ppeActionOptionLabel(command: string | undefined, fallback = ''): string {
  if (!command) return fallback
  const label = ppeActionLabel(command, fallback, true)
  const method = RESULT_NAMES[command] ? '' : ppeActionMethodLabel(command, true)
  return method ? `${label} · ${method}` : label
}

export function ppeCheckLabel(id: string, fallback: string): string {
  const names: Record<string, string> = {
    workwear_coverage: 'Arms and legs covered',
    workwear_fastened: 'Clothing fastened',
    toe_protection: 'Toe protection',
    shoe_condition: 'Shoes in good condition',
  }
  return names[id] ?? fallback
}

export interface PPEAppearance {
  workwear: 'casual' | 'approved_workwear'
  footwear: 'trainers' | 'safety_boots'
}

export interface PPESceneAction {
  mode: 'tablet' | 'inspect' | 'rectify'
  target: 'worker' | 'workwear' | 'footwear' | 'tablet'
  duration_ms: number
}

export interface PPESceneState {
  timestamp: string
  worker_state: 'waiting'
  location: 'checkpoint'
  ppe_revision: number
  ppe: PPEAppearance
}

export interface PPECheck {
  id: string
  label: string
  status: 'pass' | 'fail' | 'unknown'
  finding: string
  evidence_ids: string[]
  observed_at?: string | null
  step_i?: number | null
  ppe_revision: number
}

export interface PPERecordFields {
  scene_action?: PPESceneAction
  scene_state_before?: PPESceneState
  scene_state_after?: PPESceneState
  checklist_before?: PPECheck[]
  checklist_after?: PPECheck[]
}

export const PPE_PHASES = [
  { id: 'identify', title: 'Check the worker', desc: 'Check who the worker is and what job they will do.' },
  { id: 'rules', title: 'Read the rules', desc: 'Read the clothing and shoe rules for this job.' },
  { id: 'inspect', title: 'Check clothes and shoes', desc: 'Look at the clothing, shoes and shoe label.' },
  { id: 'rectify', title: 'Fix and recheck', desc: 'Ask for issues to be fixed, then check what the worker is wearing now.' },
  { id: 'decide', title: 'Record the result', desc: 'Review all checks and record the result.' },
  { id: 'archive', title: 'Save the report', desc: 'Save the evidence, send the report and check it was saved.' },
]

export function ppeMotionSpec(step?: { action: string; scene_action?: PPESceneAction }): PPESceneAction | undefined {
  if (step?.scene_action && step.action.endsWith(' method=camera')) {
    return { ...step.scene_action, mode: 'tablet', target: 'tablet' }
  }
  return step?.scene_action
}

export function ppeReplayFrame(
  steps: ({ i: number; action: string } & PPERecordFields)[],
  groups: { i: number; chosen?: string }[], currentCompleted: boolean,
) {
  let completed = 0
  for (const [index, group] of groups.entries()) {
    const step = steps[index]
    if (!step || step.i !== group.i || step.action !== group.chosen) break
    if (index === groups.length - 1 && !currentCompleted) break
    completed++
  }
  const step = completed ? steps[completed - 1] : undefined
  return { completed, state: step?.scene_state_after ?? steps[0]?.scene_state_before,
    checklist: step?.checklist_after ?? steps[0]?.checklist_before ?? [] }
}
