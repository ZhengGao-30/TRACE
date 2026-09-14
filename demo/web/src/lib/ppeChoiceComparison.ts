import type { PairedTrajectoryStep } from '../components/PairedWorkflowStrip'
import { inspectionLabel, requirementKey } from './ppePlayback'
import type { PlaybackArm } from './ppePlayback'
import { ppeActionMethodLabel } from './ppeInspection'

export interface PPEChoiceOption {
  action: string
  label: string
  selected: boolean
  art: string
}

export interface PPEChoiceArm {
  stepNumber: number
  options: PPEChoiceOption[]
}

export interface PPEChoiceComparisonData {
  title: string
  changed: boolean
  arms: { standard: PPEChoiceArm; trace: PPEChoiceArm }
}

function commandRequirement(command: string): string {
  return /^record_ppe_(pass|fail|hold)$/.test(command) ? 'ppe_conclusion' : command.split(' method=')[0]
}

export function optionArt(command: string): string {
  const [action, method] = command.split(' method=')
  const clothing = action.includes('workwear') || action === 'initial_fastening'
  if (method === 'desk') return 'office'
  if (method === 'camera') return clothing ? 'workwear-screen' : 'boot-screen'
  if (method === 'direct') return clothing ? 'workwear' : 'boot'
  if (method === 'tag') return 'boot'
  if (method === 'scan') return 'boot-scan'
  if (method === 'certificate') return 'certificate'
  if (method === 'register') return action === 'replacement_certificate' ? 'stock' : 'register'
  if (method === 'tablet' || method === 'form') return 'tablet'
  if (method === 'bundle') return 'evidence'
  if (method === 'references') return 'evidence-references'
  if (commandRequirement(command) === 'ppe_conclusion') return 'checklist'
  const documents: Record<string, string> = {
    worker_identity: 'identity',
    work_assignment: 'rules',
    workwear_rule: 'rules',
    footwear_rule: 'rules',
    previous_clearance: 'rules',
    replacement_stock: 'stock',
    change_confirmation: 'reply',
    compile_checklist: 'checklist',
    archive_receipt: 'receipt',
  }
  return documents[action] ?? 'tablet'
}

// Each arm retains only its own recorded choices for this requirement.
// The chosen action is evidence of an executed choice even if p was not saved.
function choices(step: PairedTrajectoryStep): Map<string, string> {
  const requirement = step.requirement_id ?? commandRequirement(step.action)
  const options = new Map<string, string>()
  for (const candidate of step.distribution ?? []) {
    if (candidate.p > 0 && commandRequirement(candidate.cmd) === requirement && !options.has(candidate.cmd)) {
      options.set(candidate.cmd, candidate.label)
    }
  }
  if (!options.has(step.action)) options.set(step.action, step.label)
  return options
}

export function buildPPEChoiceComparison(
  selected: { standard?: PairedTrajectoryStep; trace?: PairedTrajectoryStep },
  revealed: (source: PlaybackArm, step?: PairedTrajectoryStep) => boolean,
): PPEChoiceComparisonData | null {
  const { standard, trace } = selected
  if (!standard || !trace || requirementKey(standard) !== requirementKey(trace)) return null
  const conclusion = standard.requirement_id === 'ppe_conclusion' || trace.requirement_id === 'ppe_conclusion'
    || commandRequirement(standard.action) === 'ppe_conclusion' || commandRequirement(trace.action) === 'ppe_conclusion'
  if (conclusion && (!revealed('standard', standard) || !revealed('trace', trace))) return null

  const standardChoices = choices(standard), traceChoices = choices(trace)
  const order = [...new Set([...standardChoices.keys(), ...traceChoices.keys()])]
  const arm = (step: PairedTrajectoryStep, options: Map<string, string>): PPEChoiceArm => ({
    stepNumber: step.i + 1,
    options: order.filter(action => options.has(action)).map(action => ({
      action,
      label: ppeActionMethodLabel(action, conclusion) || options.get(action) || action,
      selected: action === step.action,
      art: optionArt(action),
    })),
  })

  return {
    title: inspectionLabel(standard),
    changed: standard.action !== trace.action,
    arms: { standard: arm(standard, standardChoices), trace: arm(trace, traceChoices) },
  }
}
