import type { PairedTrajectoryStep, PairedWorkflowData } from '../components/PairedWorkflowStrip'

export const PPE_ACTION_CATEGORIES = {
  read: { label: 'Read', color: '#567fa8', offset: -24 },
  check: { label: 'Check equipment', color: '#439681', offset: -8 },
  follow: { label: 'Follow up', color: '#c68c45', offset: 8 },
  save: { label: 'Save', color: '#a37697', offset: 24 },
} as const

export type PPEActionCategory = keyof typeof PPE_ACTION_CATEGORIES

const EQUIPMENT_CHECKS = new Set([
  'initial_workwear', 'initial_fastening', 'initial_footwear_view', 'initial_shoe_label',
  'initial_shoe_condition', 'current_workwear', 'current_shoe_label', 'current_shoe_condition',
])
const FOLLOW_UP = new Set(['request_correction', 'change_confirmation'])
const SAVING = new Set(['ppe_conclusion', 'preserve_evidence', 'submit_report', 'archive_receipt'])

// Categories describe the task being performed, regardless of its query channel.
// Viewing an existing close-up is an equipment check; reading a correction reply
// is follow-up, not a command to change clothes or shoes.
export function ppeActionCategory(step: Pick<PairedTrajectoryStep, 'action' | 'requirement_id' | 'scene_action'>): PPEActionCategory {
  const requirement = step.requirement_id ?? step.action.split(' method=')[0]
  if (FOLLOW_UP.has(requirement)) return 'follow'
  if (SAVING.has(requirement) || /^record_ppe_(pass|fail|hold)$/.test(step.action)) return 'save'
  if (EQUIPMENT_CHECKS.has(requirement) || step.scene_action?.mode === 'inspect') return 'check'
  return 'read'
}

export interface PPEPathDifference {
  counterpart?: PairedTrajectoryStep
  methodChanged: boolean
  orderChanged: boolean
  missing: boolean
  stepNumber: number
  counterpartStepNumber?: number
}

// Match the inspection requirement, not the action occupying the same step.
// This fallback is shared with ppePlayback.requirementKey.
const pathRequirementKey = (step: PairedTrajectoryStep) =>
  step.requirement_id ?? `${step.stage_id}:${step.action.split(' method=')[0]}`

export function ppePathDifferences(pair: PairedWorkflowData): {
  standard: Map<number, PPEPathDifference>
  trace: Map<number, PPEPathDifference>
} {
  const compare = (steps: PairedTrajectoryStep[], otherSteps: PairedTrajectoryStep[]) => {
    const counterparts = new Map<string, { step: PairedTrajectoryStep; position: number }>()
    otherSteps.forEach((step, position) => {
      const key = pathRequirementKey(step)
      if (!counterparts.has(key)) counterparts.set(key, { step, position })
    })
    return new Map<number, PPEPathDifference>(steps.map((step, position) => {
      const other = counterparts.get(pathRequirementKey(step))
      return [step.i, {
        counterpart: other?.step,
        methodChanged: !!other && step.action !== other.step.action,
        orderChanged: !!other && position !== other.position,
        missing: !other,
        stepNumber: position + 1,
        counterpartStepNumber: other ? other.position + 1 : undefined,
      }]
    }))
  }
  return {
    standard: compare(pair.standard.steps, pair.trace.steps),
    trace: compare(pair.trace.steps, pair.standard.steps),
  }
}
