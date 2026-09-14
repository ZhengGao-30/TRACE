import type { PairedTrajectoryStep, PairedWorkflowData } from '../components/PairedWorkflowStrip'
import { ppeActionLabel } from './ppeInspection'

export type PlaybackArm = 'standard' | 'trace'
export interface ActionPlayback {
  caseId: string
  source: PlaybackArm
  index: number
  token: string
  status: 'restoring' | 'playing' | 'complete' | 'error'
}
export interface PairedPlaybackState {
  active: ActionPlayback | null
  watched: Record<PlaybackArm, number[]>
}
export type PlaybackEvent =
  | { type: 'reset' }
  | { type: 'play'; action: ActionPlayback }
  | { type: 'ready' | 'complete' | 'fail'; token: string }

export function emptyPlayback(): PairedPlaybackState {
  return { active: null, watched: { standard: [], trace: [] } }
}

export function playbackTransition(state: PairedPlaybackState, event: PlaybackEvent): PairedPlaybackState {
  if (event.type === 'reset') return emptyPlayback()
  if (event.type === 'play') return {
    active: { ...event.action, status: 'restoring' },
    watched: state.active && state.active.caseId !== event.action.caseId ? emptyPlayback().watched : state.watched,
  }
  const active = state.active
  if (!active || active.token !== event.token) return state
  if (event.type === 'ready' && active.status === 'restoring') return { ...state, active: { ...active, status: 'playing' } }
  if (event.type === 'complete' && active.status === 'playing') return {
    active: { ...active, status: 'complete' },
    watched: { ...state.watched, [active.source]: [...new Set([...state.watched[active.source], active.index])] },
  }
  if (event.type === 'fail' && ['restoring', 'playing'].includes(active.status)) return { ...state, active: { ...active, status: 'error' } }
  return state
}

export function actionPlaybackFrame(pair: PairedWorkflowData, active: ActionPlayback) {
  if (pair.game_id !== active.caseId && pair.case_id !== active.caseId) return null
  const steps = pair[active.source].steps
  const index = steps.findIndex(step => step.i === active.index)
  const step = steps[index]
  if (!step) return null
  const complete = active.status === 'complete'
  return {
    step, steps, complete,
    state: complete ? step.scene_state_after : step.scene_state_before,
    checklist: (complete ? step.checklist_after : step.checklist_before) ?? [],
    prefix: steps.slice(0, index + (complete ? 1 : 0)),
    previous: index > 0 ? steps[index - 1] : undefined,
  }
}

export function requirementKey(step: PairedTrajectoryStep): string {
  return step.requirement_id ?? `${step.stage_id}:${step.action.split(' method=')[0]}`
}

export function matchedRequirement(pair: PairedWorkflowData, key: string) {
  return {
    standard: pair.standard.steps.find(step => requirementKey(step) === key),
    trace: pair.trace.steps.find(step => requirementKey(step) === key),
  }
}

export function matchedDecisionContext(a?: PairedTrajectoryStep, b?: PairedTrajectoryStep) {
  if (!a || !b) return { sameState: false, sameDistribution: false }
  const sameState = !!a.policy_state_id && a.policy_state_id === b.policy_state_id
  const normalize = (step: PairedTrajectoryStep) => (step.distribution ?? []).map(row => [row.cmd, row.p] as const).sort(([a], [b]) => a.localeCompare(b))
  const sameDistribution = sameState && !!a.distribution?.length && !!b.distribution?.length
    && JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
  return { sameState, sameDistribution }
}

export function inspectionLabel(step?: PairedTrajectoryStep, revealed = false) {
  if (!step) return 'No corresponding action recorded'
  return ppeActionLabel(step.action, step.label, revealed)
}
