import type { PairedTrajectoryStep, PairedWorkflowData } from '../components/PairedWorkflowStrip'
import { buildPPEChoiceComparison, type PPEChoiceOption } from './ppeChoiceComparison'
import { inspectionLabel, requirementKey, type PlaybackArm } from './ppePlayback'
import { ppeActionMethodLabel } from './ppeInspection'

type SelectedSteps = { standard?: PairedTrajectoryStep; trace?: PairedTrajectoryStep }
type Revealed = (source: PlaybackArm, step?: PairedTrajectoryStep) => boolean

export interface PPEStoryChoice {
  key: string
  title: string
  standard: PairedTrajectoryStep
  trace: PairedTrajectoryStep
  standardMethod: string
  traceMethod: string
  options: PPEChoiceOption[]
  otherCandidateCount: number
  changed: boolean
  forced: boolean
  keyGuided: boolean
}

export interface PPEStoryLogEntry {
  key: string
  step: PairedTrajectoryStep
  stepNumber: number
  title: string
  method: string
  changed: boolean
  revealed: boolean
}

export interface PPEWatermarkStoryData {
  differences: PPEStoryChoice[]
  current: PPEStoryChoice | null
  log: PPEStoryLogEntry[]
}

const isConclusion = (step: PairedTrajectoryStep) => step.requirement_id === 'ppe_conclusion'
  || /^record_ppe_(pass|fail|hold)$/.test(step.action)

// These pictures explain one requirement's recorded alternatives. Other checks
// can also have been available at the same decision; they are not hidden choices
// of this requirement or candidates borrowed from the baseline run.
function storyChoice(selected: SelectedSteps, revealed: Revealed): PPEStoryChoice | null {
  const comparison = buildPPEChoiceComparison(selected, revealed)
  if (!comparison || !selected.standard || !selected.trace) return null
  const { standard, trace } = selected
  const candidates = new Set((trace.distribution ?? []).filter(row => Number.isFinite(row.p) && row.p > 0).map(row => row.cmd))
  const optionCommands = new Set(comparison.arms.trace.options.map(option => option.action))
  const recordedCount = Number.isInteger(trace.nCand) && (trace.nCand ?? 0) > 0 ? trace.nCand! : 0
  const candidateCount = Math.max(recordedCount, candidates.size)
  const forced = trace.forced === true || candidateCount === 1
  return {
    key: requirementKey(trace),
    title: comparison.title,
    standard,
    trace,
    standardMethod: ppeActionMethodLabel(standard.action, revealed('standard', standard)),
    traceMethod: ppeActionMethodLabel(trace.action, revealed('trace', trace)),
    options: comparison.arms.trace.options,
    otherCandidateCount: [...candidates].filter(command => !optionCommands.has(command)).length,
    changed: comparison.changed,
    forced,
    keyGuided: trace.watermarked === true && trace.detector_eligible !== false && !forced && candidateCount > 1,
  }
}

export function buildPPEWatermarkStory(
  pair: PairedWorkflowData,
  selected: SelectedSteps,
  revealed: Revealed,
): PPEWatermarkStoryData {
  const standardByRequirement = new Map<string, PairedTrajectoryStep>()
  for (const step of pair.standard.steps) {
    if (!standardByRequirement.has(requirementKey(step))) standardByRequirement.set(requirementKey(step), step)
  }
  const choices = pair.trace.steps.map(trace => storyChoice({ standard: standardByRequirement.get(requirementKey(trace)), trace }, revealed))
  const differences = choices.filter((choice): choice is PPEStoryChoice => !!choice?.changed)
  const changedKeys = new Set(differences.map(choice => choice.key))
  const selectedKey = selected.trace ? requirementKey(selected.trace) : selected.standard ? requirementKey(selected.standard) : null
  const selectionMatches = !!selected.standard && !!selected.trace && requirementKey(selected.standard) === requirementKey(selected.trace)
  const current = selectionMatches ? choices.find(choice => choice?.key === selectedKey) ?? null : null

  return {
    differences,
    current,
    // The complete trace is the single log used by detection. It includes
    // unchanged methods as well as differences, in its actual execution order.
    log: pair.trace.steps.map((step, index) => {
      const counterpart = standardByRequirement.get(requirementKey(step))
      const visible = revealed('trace', step) && (!isConclusion(step) || (!!counterpart && revealed('standard', counterpart)))
      return {
        key: requirementKey(step),
        step,
        stepNumber: index + 1,
        title: inspectionLabel(step, visible),
        method: ppeActionMethodLabel(step.action, visible),
        changed: changedKeys.has(requirementKey(step)),
        revealed: visible,
      }
    }),
  }
}

export interface PPESourceCandidate {
  id: string
  label: string
  state: 'pending' | 'supported' | 'not_supported'
  layer1: boolean | null
  layer2: boolean | null
  z1: number | null
  z2: number | null
  n1: number | null
  n2: number | null
}

export interface PPESourceSummary {
  status: 'pending' | 'unavailable' | 'candidate_match' | 'ambiguous' | 'insufficient_evidence'
  message: string
  scope: string | null
  threshold: number | null
  candidates: PPESourceCandidate[]
  supportedIds: string[]
}

const finiteScore = (value: number) => Number.isFinite(value) ? value : null
const sampleCount = (value: number) => Number.isInteger(value) && value >= 0 ? value : null

// Read the saved detector results for this complete trace. This function does
// not detect an individual action, compare against the standard run, or unlock
// results when the explanatory animation finishes.
export function sourceSummary(pair: PairedWorkflowData | null, available: boolean): PPESourceSummary {
  const unavailable: PPESourceSummary = {
    status: 'unavailable',
    message: 'Candidate-key results are not recorded for this complete log.',
    scope: null,
    threshold: null,
    candidates: [],
    supportedIds: [],
  }
  const attribution = pair?.attribution
  // An admission-prefix result or a result for another record cannot stand in
  // for this complete log. Controlled-shift scopes have their own separate UI.
  if (!attribution || attribution.record_scope !== 'trace_agent_actions'
    || !Array.isArray(attribution.candidates) || !attribution.candidates.length
    || attribution.candidates.some(candidate => !candidate || typeof candidate.agent_id !== 'string' || !candidate.agent_id
      || typeof candidate.label !== 'string' || !candidate.label)
    || new Set(attribution.candidates.map(candidate => candidate.agent_id)).size !== attribution.candidates.length) return unavailable

  if (!available) return {
    status: 'pending',
    message: 'Awaiting full replay',
    scope: attribution.record_scope,
    threshold: null,
    candidates: attribution.candidates.map(candidate => ({
      id: candidate.agent_id, label: candidate.label, state: 'pending',
      layer1: null, layer2: null, z1: null, z2: null, n1: null, n2: null,
    })),
    supportedIds: [],
  }
  if (!Number.isFinite(attribution.threshold) || attribution.threshold < 0
    || !Array.isArray(attribution.matched_agent_ids)) return unavailable

  const threshold = attribution.threshold
  const candidates: PPESourceCandidate[] = attribution.candidates.map(candidate => {
    const n1 = sampleCount(candidate.n1), n2 = sampleCount(candidate.n2)
    const z1 = finiteScore(candidate.z1), z2 = finiteScore(candidate.z2)
    const layer1 = n1 !== null && n1 > 0 && z1 !== null && z1 > threshold && candidate.layer1_detected === true
    const layer2 = n2 !== null && n2 > 0 && z2 !== null && z2 > threshold && candidate.layer2_detected === true
    return {
      id: candidate.agent_id, label: candidate.label,
      state: layer1 || layer2 ? 'supported' : 'not_supported',
      layer1, layer2, z1, z2, n1, n2,
    }
  })
  const supported = candidates.filter(candidate => candidate.state === 'supported')
  const supportedIds = supported.map(candidate => candidate.id)
  const base = { scope: attribution.record_scope, threshold, candidates, supportedIds }
  if (supported.length > 1 || attribution.status === 'ambiguous') return {
    ...base,
    status: 'ambiguous',
    message: supported.length > 1 ? 'More than one candidate has support. The source is ambiguous.' : 'The recorded result does not identify a unique source.',
  }
  if (supported.length === 1 && attribution.status === 'candidate_match'
    && attribution.matched_agent_ids.length === 1 && attribution.matched_agent_ids[0] === supported[0].id) return {
    ...base,
    status: 'candidate_match',
    message: `The full log supports ${supported[0].label} among the tested candidates.`,
  }
  return {
    ...base,
    status: 'insufficient_evidence',
    message: 'The record does not provide enough consistent evidence for a source match.',
  }
}

// The key checker shows a validated snapshot that was saved with the public
// demo fixture. This is deliberately separate from sourceSummary(..., false),
// which keeps the live full-replay detector UI gated until that replay ends.
export function savedExperimentSummary(pair: PairedWorkflowData | null): PPESourceSummary {
  return sourceSummary(pair, true)
}
