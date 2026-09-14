import type { PairedWorkflowData } from '../components/PairedWorkflowStrip'
import type { PPEStoryChoice } from './ppeWatermarkStory'

export interface ChoiceReplayCandidate {
  agent_id: string
  label: string
  key1: number
  key2: number
  steps: { i: number; chosen: string; replayed: string; match: boolean; candidate_count: number; forced: boolean }[]
  n_steps: number
  n_matches: number
}

export interface ChoiceReplayRecord {
  scope: 'trace_recorded_decisions'
  method: 'layer1_exp_replay'
  replay_mode: 'same_recorded_history'
  candidates: ChoiceReplayCandidate[]
  provenance?: Record<string, unknown>
}

export function choiceReplayCandidates(pair: PairedWorkflowData): ChoiceReplayCandidate[] {
  const record = pair.choice_replay
  if (record?.scope !== 'trace_recorded_decisions' || record.method !== 'layer1_exp_replay'
    || record.replay_mode !== 'same_recorded_history' || !Array.isArray(record.candidates)) return []
  const candidates = record.candidates
  if (!candidates.length || candidates.some(candidate => !candidate || !candidate.agent_id || !candidate.label
    || !Number.isSafeInteger(candidate.key1) || !Number.isSafeInteger(candidate.key2) || !Array.isArray(candidate.steps))
    || new Set(candidates.map(candidate => candidate.agent_id)).size !== candidates.length
    || new Set(candidates.map(candidate => `${candidate.key1}/${candidate.key2}`)).size !== candidates.length) return []
  return candidates
}

export function keyCandidate(pair: PairedWorkflowData, input: string): ChoiceReplayCandidate | undefined {
  const key = input.trim().replace(/\s/g, '')
  return choiceReplayCandidates(pair).find(candidate => key === `${candidate.key1}/${candidate.key2}`)
}

export interface ChoiceReplayData {
  status: 'pending' | 'unavailable' | 'ready'
  rows: { choice: PPEStoryChoice; chosen: string; replayed: string; match: boolean }[]
  matches: number | null
  total: number
}

/** A replay of saved decisions, never a source detector or a new agent rollout. */
export function buildChoiceReplay(pair: PairedWorkflowData, choices: PPEStoryChoice[], candidateId: string, available: boolean): ChoiceReplayData {
  const selected = choices.filter(choice => choice.changed && choice.keyGuided && !choice.forced)
  const empty = { rows: [], matches: null, total: selected.length }
  if (!available) return { ...empty, status: 'pending' }
  const candidate = choiceReplayCandidates(pair).find(item => item.agent_id === candidateId)
  if (!candidate || !selected.length || candidate.steps.length !== pair.trace.steps.length
    || candidate.n_steps !== candidate.steps.length
    || new Set(candidate.steps.map(step => step.i)).size !== candidate.steps.length) return { ...empty, status: 'unavailable' }
  const trace = new Map(pair.trace.steps.map(step => [step.i, step]))
  for (const row of candidate.steps) {
    const step = trace.get(row.i)
    const actions = new Set((step?.distribution ?? []).filter(item => Number.isFinite(item.p) && item.p > 0).map(item => item.cmd))
    if (!step || row.chosen !== step.action || !actions.has(row.chosen) || !actions.has(row.replayed)
      || row.match !== (row.chosen === row.replayed) || row.candidate_count !== actions.size
      || row.forced !== (step.forced === true || actions.size === 1)) return { ...empty, status: 'unavailable' }
  }
  if (candidate.n_matches !== candidate.steps.filter(row => row.match).length) return { ...empty, status: 'unavailable' }
  const rows = selected.map(choice => {
    const row = candidate.steps.find(item => item.i === choice.trace.i)!
    return { choice, chosen: row.chosen, replayed: row.replayed, match: row.match }
  })
  return { status: 'ready', rows, matches: rows.filter(row => row.match).length, total: rows.length }
}

// Approximate task-count-weighted summary of the paper's rounded main results.
export const TASK_SUCCESS = {
  without: (82.4 * 140 + 81.3 * 134 + 77.2 * 150) / 424,
  with: (83.6 * 140 + 81.1 * 134 + 76.6 * 150) / 424,
  source: 'https://arxiv.org/html/2607.08400v1',
}
