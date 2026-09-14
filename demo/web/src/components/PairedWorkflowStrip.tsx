import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle, BarChart3, CheckCircle2, Dices, KeyRound, ShieldCheck, X,
} from 'lucide-react'
import type { Phase, WorkflowStage } from '../lib/guidedSteps'
import { buildWorkflow, totalSteps } from '../lib/guidedSteps'
import { PPE_TASK, ppeActionLabel, ppeActionOptionLabel, ppeCheckLabel, type PPERecordFields, type PPECheck } from '../lib/ppeInspection'

export interface PairedRaceRow {
  cmd?: string
  label: string
  p: number
  r: number
  score: number
  win: boolean
}

export interface PairedTrajectoryStep extends PPERecordFields {
  i: number
  requirement_id?: string
  procedure?: string
  variant_id?: string
  wm_index?: number | null
  event_kind?: string
  detector_eligible?: boolean
  station_id?: string
  timestamp?: string
  watermarked?: boolean
  k?: number
  action: string
  label: string
  p?: number
  rank?: number
  nCand?: number
  attest?: string | null
  required?: boolean
  race?: PairedRaceRow[]
  stage_id?: string
  phase?: string
  result?: string
  evidence_ids?: string[]
  distribution?: { cmd: string; label: string; p: number }[]
  blocked_actions?: { command?: string; label: string; reason: string }[]
  state_before?: { stage_id?: string; facts?: Record<string, unknown>; [key: string]: unknown }
  state_after?: { stage_id?: string; facts?: Record<string, unknown>; [key: string]: unknown }
  policy_source?: string
  policy_state_id?: string
  forced?: boolean
  world_state_before?: Record<string, unknown>
  world_state_after?: Record<string, unknown>
  world_events?: EntryWorldEvent[]
  fault?: ControllerFault
}

interface ReportValidation {
  valid: boolean
  success?: boolean
  issues?: string[]
}

export interface EntryWorldEvent {
  id: string
  timestamp?: string
  kind: string
  title?: string
  description?: string
  worker_state?: string
  timber_state?: string
  [key: string]: unknown
}

export interface EntryViolation {
  code?: string
  message: string
  action?: string
  evidence_ids?: string[]
  [key: string]: unknown
}

export interface EntryDecision {
  action?: string
  verdict?: string
  assessment?: unknown
  timestamp?: string
  source?: string
  [key: string]: unknown
}

export interface ControllerFault {
  id?: string
  kind?: string
  description?: string
  requested_action?: string
  effective_action?: string
  timestamp?: string
  [key: string]: unknown
}

export interface IncidentReport {
  checklist?: PPECheck[]
  evaluation?: { actual_ppe_compliant: boolean; judgment_correct: boolean; expected_assessment: string; evidence_sufficient: boolean }
  status: string
  facts: Record<string, unknown>
  unresolved?: unknown[]
  evidence_ids?: string[]
  decision?: EntryDecision
  effective_decision?: EntryDecision
  recommendation?: EntryDecision
  admission_snapshot?: { facts?: Record<string, unknown>; [key: string]: unknown }
  fault_injections?: ControllerFault[]
  world_state?: Record<string, unknown>
  safety?: { compliant: boolean; violations: EntryViolation[]; [key: string]: unknown }
  world_events?: EntryWorldEvent[]
  [key: string]: unknown
}

export interface EntryAttribution {
  record_scope: 'trace_agent_actions' | 'controlled_scenario_policy_actions_admission' | 'controlled_scenario_policy_actions_full'
    | 'controlled_codex_llm_actions_admission' | 'controlled_codex_llm_actions_full'
  candidates: { agent_id: string; label: string; z1: number; z2: number; layer1_detected: boolean; layer2_detected: boolean; n1: number; n2: number }[]
  status: 'candidate_match' | 'ambiguous' | 'insufficient_evidence'
  matched_agent_ids: string[]
  threshold: number
  limitations: string[]
}

export interface EntryAttributionScope {
  label: string
  action_count: number
  detect?: {
    layer1: { z: number; n: number; detected?: boolean }
    layer2: { z: number; n: number; detected?: boolean }
    tau?: number
  }
  attribution?: EntryAttribution
}

export interface PairedTrajectoryArm {
  steps: PairedTrajectoryStep[]
  success: boolean
  required_done: number
  required_total: number
  report?: IncidentReport
  validation?: ReportValidation
}

export interface PairedWorkflowData {
  choice_replay?: import('../lib/ppeChoiceReplay').ChoiceReplayRecord
  game_id?: string
  case_id?: string
  task_type: string
  visual_variant?: string
  query?: string
  scene?: string
  standard: PairedTrajectoryArm
  trace: PairedTrajectoryArm
  agreement: { same: number; of: number }
  stages?: WorkflowStage[]
  case_title?: string
  synthetic?: boolean
  story_frames?: { id: string; title: string; caption: string; time?: string }[]
  provenance?: { policy_source?: string; source?: string; agent_source?: string; input_disclosure?: string; [key: string]: unknown }
  validation?: { same_facts: boolean; both_valid: boolean; same_outcome: boolean; issues?: string[] }
  attribution?: EntryAttribution
  attribution_scopes?: { admission?: EntryAttributionScope; full?: EntryAttributionScope }
}

type DecisionSource = 'trace' | 'standard'

interface DistributionEntry {
  cmd: string
  label: string
  p: number
  selected: boolean
}

function phaseContains(phase: Phase, step: number) {
  return phase.steps.some((item) => item.i === step)
}

function phaseDone(phase: Phase, current: number) {
  if (!phase.steps.length) return false
  const last = phase.steps[phase.steps.length - 1]?.i ?? 0
  return current > last
}

export function isInjectedStep(step: PairedTrajectoryStep) {
  return step.event_kind === 'injected_action' || step.policy_source === 'fault_injection'
}

export function trajectorySource(pair: PairedWorkflowData) {
  const source = pair.provenance?.policy_source ?? pair.provenance?.agent_source ?? pair.provenance?.source


  const decisions = [...pair.trace.steps, ...pair.standard.steps].filter((step) =>
    !isInjectedStep(step) && step.policy_source !== 'forced_rule')
  const verified = decisions.length > 0 && decisions.every((step) => step.policy_source === source)
  const label = verified && source === 'scenario_policy' ? 'Authored scenario policy · not an LLM run'
    : verified && source === 'codex_llm' ? 'Recorded Codex LLM run'
      : verified && source === 'api' ? 'Recorded API agent run' : 'Agent source not verified'
  return { source, verified, label }
}

export function probabilitySnapshot(step: PairedTrajectoryStep) {
  if (isInjectedStep(step)) return { rows: [] as DistributionEntry[], otherCount: 0, otherProbability: 0 }
  const candidates = new Map<string, DistributionEntry>()
  for (const row of step.distribution ?? step.race ?? []) {
    const cmd = row.cmd ?? row.label
    candidates.set(cmd, {
      cmd,
      label: row.label,
      p: row.p,
      selected: row.cmd ? row.cmd === step.action : row.label === step.label,
    })
  }
  if (![...candidates.values()].some((row) => row.selected) && step.p != null) {
    candidates.set(step.action, {
      cmd: step.action,
      label: step.label,
      p: step.p,
      selected: true,
    })
  }

  const chosen = [...candidates.values()].find((row) => row.selected)
  const others = [...candidates.values()]
    .filter((row) => !row.selected)
    .sort((a, b) => b.p - a.p)
  const rows = [...(chosen ? [chosen] : []), ...others].slice(0, 5)
  const shownProbability = rows.reduce((sum, row) => sum + row.p, 0)
  return {
    rows,
    otherCount: Math.max(0, (step.distribution?.length ?? step.nCand ?? candidates.size) - rows.length),
    otherProbability: Math.max(0, 1 - shownProbability),
  }
}

export function percent(value: number) {
  if (value > 0 && value < 0.001) return '<0.1%'
  return `${(value * 100).toFixed(1)}%`
}

export function probabilityValue(value: number) {
  return value > 0 && value < 0.001 ? '<0.001' : value.toFixed(3)
}



export function canInspectAction(taskType: string, source: DecisionSource, index: number, current: number, running: boolean, total: number, completedIndex?: number) {
  if (taskType === PPE_TASK && completedIndex !== undefined) return index >= 0 && total > 0 && (source === 'trace' ? index <= completedIndex : !running && completedIndex >= total - 1)
  if (taskType !== 'construction_ppe_shift' && taskType !== PPE_TASK) return true
  if (index < 0 || current < 0 || total <= 0) return false
  const finished = !running && current + 1 >= total
  if (source === 'standard') return finished
  return index <= current - (running ? 1 : 0)
}

export function ActionWindow({ indices, steps, focus, source, selectedSource, current, running = false, onSelect, canInspect }: {
  indices: number[]
  steps: PairedTrajectoryStep[]
  focus: number
  source: DecisionSource
  selectedSource: DecisionSource | null
  current: number
  running?: boolean
  onSelect: (source: DecisionSource, index: number) => void
  canInspect?: (index: number) => boolean
}) {
  const trace = source === 'trace'
  const detailsAvailable = !canInspect || indices.every(canInspect)
  const phaseIndices = indices
  const focusPosition = Math.max(0, phaseIndices.indexOf(focus))
  const windowSize = Math.min(3, phaseIndices.length)
  const start = Math.max(0, Math.min(focusPosition - 1, phaseIndices.length - windowSize))
  const visible = phaseIndices.slice(start, start + windowSize)

  return (
    <div className={[
      'grid items-center gap-2 rounded-xl border px-3 py-2.5 sm:grid-cols-[154px_minmax(0,1fr)]',
      trace ? 'border-indigo-100 bg-indigo-50/35' : 'border-slate-200/80 bg-slate-50/70',
    ].join(' ')}>
      <div className="flex flex-wrap items-center gap-1.5 sm:flex-col sm:items-start">
        <span className={[
          'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.04em]',
          trace ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white',
        ].join(' ')}>
          {trace ? <ShieldCheck size={11} /> : <Dices size={11} />}
          {trace ? 'With watermark' : 'Without watermark'}
        </span>
        <span className="text-[9px] font-medium leading-relaxed text-slate-400">{canInspect
          ? trace ? detailsAvailable ? 'Recorded actions · click for details' : 'Recorded actions · replay highlighted' : detailsAvailable ? 'Recorded comparison · click for details' : 'Recorded comparison · details after replay'
          : 'Click an action for details'}</span>
      </div>

      <div className="mx-auto grid w-full max-w-[840px] grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-2">
        {start > 0 ? <button type="button"
          onClick={() => onSelect(source, phaseIndices[start - 1])}
          aria-label={`${trace ? 'With' : 'Without'} watermark earlier actions`}
          title="Show earlier actions"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-lg text-slate-500 ring-1 ring-slate-200 transition hover:text-indigo-600 hover:ring-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">‹</button> : <span aria-hidden="true" className="h-7 w-7" />}
        <div data-workflow-slots={source} className="mx-auto grid w-full gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, visible.length)}, minmax(0, 1fr))`, maxWidth: Math.max(1, visible.length) * 240 + Math.max(0, visible.length - 1) * 12 }}>
        {visible.map((index, order) => {
          const item = steps.find((step) => step.i === index)
          if (!item) return null
          const locked = canInspect ? !canInspect(index) : false
          const selected = !locked && selectedSource === source && index === focus


          const active = trace && running && index === current
          const label = ppeActionLabel(item.action, item.label, !locked)
          return (
            <div key={index} data-workflow-slot={index} className="relative min-w-0">
              {order > 0 && <span aria-hidden="true" className="absolute -left-3 top-1/2 w-3 -translate-y-1/2 text-center text-[10px] text-slate-300">›</span>}
              <motion.button layout animate={{ scale: 1 }}
                onClick={() => { if (!locked) onSelect(source, index) }}
                disabled={locked}
                aria-label={`${trace ? 'With' : 'Without'} watermark step ${index + 1}: ${label}`}
                aria-current={active ? 'step' : undefined}
                data-active={active}
                title={label}
                className={[
                  'flex h-12 w-full min-w-0 max-w-[240px] items-center gap-2 rounded-lg px-2.5 text-left text-[10.5px] transition-colors',
                  active
                    ? isInjectedStep(item) ? 'bg-amber-50 text-amber-900 ring-2 ring-amber-400' : 'bg-indigo-100 text-indigo-900 ring-2 ring-indigo-500 shadow-sm'
                    : selected
                    ? trace
                      ? 'bg-indigo-600 text-white ring-1 ring-indigo-600 shadow-sm'
                      : 'bg-slate-800 text-white ring-1 ring-slate-800 shadow-sm'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 enabled:hover:ring-indigo-300',
                  locked ? 'cursor-default disabled:opacity-100' : '',
                ].join(' ')}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold ${active ? 'bg-white/80 text-indigo-700' : selected ? 'bg-white/15 text-white/80' : 'bg-slate-100 text-slate-400'}`}>{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-semibold leading-[14px]">{label}</span>
                  {isInjectedStep(item) && <span className={`block text-[8px] font-bold ${selected ? 'text-amber-100' : 'text-amber-700'}`}>Controller · excluded</span>}
                </span>
                {active && <span aria-label="Playing now" className={`h-1.5 w-1.5 shrink-0 animate-pulse rounded-full ${isInjectedStep(item) ? 'bg-amber-500' : 'bg-indigo-500'}`} />}
              </motion.button>
            </div>
          )
        })}
        {!visible.length && <span className="text-[10px] text-slate-400">No recorded action in this stage.</span>}
        </div>
        {start + windowSize < phaseIndices.length ? <button type="button"
          onClick={() => onSelect(source, phaseIndices[start + windowSize])}
          aria-label={`${trace ? 'With' : 'Without'} watermark later actions`}
          title="Show later actions"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-lg text-slate-500 ring-1 ring-slate-200 transition hover:text-indigo-600 hover:ring-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">›</button> : <span aria-hidden="true" className="h-7 w-7" />}
      </div>
    </div>
  )
}

function ProbabilityBars({ step, trace }: { step: PairedTrajectoryStep; trace: boolean }) {
  const distribution = probabilitySnapshot(step)
  const maxProbability = Math.max(...distribution.rows.map((row) => row.p), 0.001)
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold text-slate-700">
            <BarChart3 size={12} className="text-indigo-500" /> {step.policy_source === 'scenario_policy' ? 'Scenario action weights' : "Agent's action probabilities"}
          </div>
          <div className="mt-0.5 text-[9.5px] text-slate-400">
            {step.policy_source === 'scenario_policy'
              ? 'Authored scenario weights, not LLM probabilities · normalized before sampling'
              : step.forced || step.policy_source === 'forced_rule'
              ? 'Environment rule · one executable action with probability 1'
              : step.policy_source === 'codex_llm' ? 'Codex LLM-elicited weights · normalized before sampling · not token log probabilities'
              : step.distribution ? 'Normalized action weights from the model · before sampling' : 'Recorded policy p · before sampling'}
          </div>
        </div>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-extrabold text-emerald-700 ring-1 ring-emerald-200">
          {trace ? 'unchanged by TRACE ✓' : 'original distribution'}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {distribution.rows.map((row) => (
          <div key={row.cmd} className="grid items-center gap-2 text-[9.5px]"
            style={{ gridTemplateColumns: 'minmax(130px, 1fr) minmax(90px, 1.25fr) 48px' }}>
            <span className={row.selected ? 'truncate font-extrabold text-indigo-700' : 'truncate text-slate-500'}>
              {ppeActionOptionLabel(row.cmd, row.label)}{row.selected ? ' ← selected' : ''}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.span initial={{ width: 0 }} animate={{ width: `${Math.max(4, row.p / maxProbability * 100)}%` }}
                className={['block h-full rounded-full', row.selected ? 'bg-indigo-500' : 'bg-slate-300'].join(' ')} />
            </span>
            <span className={row.selected ? 'text-right font-bold text-indigo-700' : 'text-right text-slate-400'}>{percent(row.p)}</span>
          </div>
        ))}
        {!distribution.rows.length && <p className="text-[10px] text-slate-500">No probability distribution was recorded for this decision.</p>}
        {distribution.otherCount > 0 && (
          <div className="grid items-center gap-2 text-[9.5px]"
            style={{ gridTemplateColumns: 'minmax(130px, 1fr) minmax(90px, 1.25fr) 48px' }}>
            <span className="text-slate-400">Other {distribution.otherCount} actions</span>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-slate-200"
                style={{ width: `${Math.max(4, distribution.otherProbability / Math.max(distribution.otherProbability, maxProbability) * 100)}%` }} />
            </span>
            <span className="text-right text-slate-400">{percent(distribution.otherProbability)}</span>
          </div>
        )}
      </div>
      <div className="mt-2 text-[8.5px] text-slate-400">
        {step.distribution?.length ?? step.nCand ?? distribution.rows.length} executable actions in this decision
        {distribution.otherCount > 0 ? ' · remaining candidates aggregated' : ' · all recorded candidates shown'}
      </div>
    </div>
  )
}

export function DecisionInspector({ source, step, phaseTitle, onClose }: {
  source: DecisionSource
  step: PairedTrajectoryStep
  phaseTitle: string
  onClose: () => void
}) {
  const trace = source === 'trace'
  const injected = isInjectedStep(step)
  const scoreRows = [...(step.race ?? [])].sort((a, b) => a.score - b.score).slice(0, 6)
  const winner = scoreRows.find((row) => row.win)
    ?? scoreRows.find((row) => row.cmd ? row.cmd === step.action : row.label === step.label)
  const forced = !injected && (step.forced || (step.distribution?.length ?? step.nCand) === 1)

  return (
    <motion.div initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -6 }} transition={{ duration: 0.24 }} className="overflow-hidden">
      <div className={[
        'my-2.5 rounded-2xl border p-3',
        trace ? 'border-indigo-200 bg-indigo-50/45' : 'border-slate-300 bg-slate-50/80',
      ].join(' ')}>
        <div className="mb-2.5 flex items-center gap-2">
          <span className={[
            'inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[.08em]',
            trace ? 'text-indigo-700' : 'text-slate-700',
          ].join(' ')}>
            {injected ? <AlertCircle size={12} /> : trace ? <KeyRound size={12} /> : <Dices size={12} />}
            {injected ? 'Injected controller action' : trace ? 'Watermarked decision' : 'Ordinary decision'} · step {step.i + 1}
          </span>
          <span className="truncate text-[10px] font-semibold text-slate-500">{ppeActionOptionLabel(step.action, step.label)}</span>
          <button onClick={onClose} aria-label="Close decision details"
            className="ml-auto rounded-full bg-white p-1.5 text-slate-400 ring-1 ring-slate-200 hover:text-slate-700">
            <X size={12} />
          </button>
        </div>

        {!injected && (step.stage_id || step.phase) && (
          <div className="mb-2.5 rounded-xl bg-white/80 px-3 py-2 text-[10px] leading-relaxed text-slate-600">
            <span className="font-bold">{phaseTitle}.</span> The environment enforces timing and tool prerequisites, not the correctness of the Agent’s judgment. An executable decision can still violate safety rules.
            {!!step.blocked_actions?.length && (
              <details className="mt-1 text-slate-500">
                <summary className="cursor-pointer text-[9px]">Why other actions are unavailable</summary>
                <ul className="mt-1 space-y-1">
                  {step.blocked_actions.slice(0, 3).map((action, index) => (
                    <li key={action.command ?? index}>{ppeActionOptionLabel(action.command, action.label)}: {action.reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {injected ? <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[10.5px] leading-relaxed text-amber-900">
          <p className="font-extrabold">Independent controller fault · excluded from watermark detection</p>
          <p className="mt-1">This transaction was injected by the scenario controller, not sampled by the agent. It has no policy probability, keyed winner or Layer 2 watermark.</p>
          {step.fault?.description && <p className="mt-1 text-amber-800">{step.fault.description}</p>}
          <p className="mt-1 text-[9px] text-amber-700">Display step {step.i + 1} · no eligible sampler index · no detector sample</p>
        </div> : <div className="grid gap-2.5 lg:grid-cols-2">
          <ProbabilityBars step={step} trace={trace} />

          {forced ? (
            <div className="flex flex-col justify-center rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <span className="text-[11px] font-extrabold text-slate-700">One executable action</span>
              <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">
                In this recorded state, both samplers must select “{ppeActionOptionLabel(step.action, step.label)}”.
                Layer 1 cannot change this decision.
              </p>
            </div>
          ) : trace ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-indigo-200">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold text-indigo-700">
                  <KeyRound size={12} /> Keyed score
                </div>
                <code className="ml-auto rounded-md bg-indigo-50 px-2 py-1 text-[9px] text-indigo-700">−ln(r) ÷ p · lowest wins</code>
              </div>
              <div className="mt-2.5 grid gap-x-2 gap-y-1.5 text-[9px] tabular-nums"
                style={{ gridTemplateColumns: 'minmax(120px, 1fr) 42px 42px 52px' }}>
                <span className="text-slate-400">candidate</span><span className="text-right text-slate-400">p</span>
                <span className="text-right text-slate-400">r</span><span className="text-right text-slate-400">score</span>
                {scoreRows.map((row, index) => (
                  <div key={`${row.label}-${index}`} className="contents">
                    <span className={row.win ? 'truncate font-extrabold text-indigo-700' : 'truncate text-slate-500'}>{ppeActionOptionLabel(row.cmd, row.label)}</span>
                    <span className={row.win ? 'text-right font-bold text-indigo-700' : 'text-right text-slate-400'}>{probabilityValue(row.p)}</span>
                    <span className={row.win ? 'text-right font-bold text-indigo-700' : 'text-right text-slate-400'}>{row.r.toFixed(3)}</span>
                    <span className={row.win ? 'text-right font-extrabold text-indigo-700' : 'text-right text-slate-400'}>{row.score.toFixed(2)}{row.win ? ' ←' : ''}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[8.5px] text-slate-400">Lowest-score candidates shown · {step.nCand ?? scoreRows.length} candidates evaluated</div>
              {!scoreRows.length && <p className="mt-2 text-[10px] text-slate-500">No keyed scores were recorded.</p>}
            </div>
          ) : (
            <div className="flex flex-col justify-center rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[.06em] text-slate-600">
                No watermark score
              </span>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-600">
                <span className="rounded-lg bg-slate-100 px-2.5 py-2">{step.policy_source === 'scenario_policy' ? 'Scenario policy p' : 'Agent policy p'}</span>
                <span className="text-slate-300">→</span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-2">ordinary sample</span>
                <span className="text-slate-300">→</span>
                <span className="rounded-lg bg-slate-800 px-2.5 py-2 text-white">{ppeActionOptionLabel(step.action, step.label)}</span>
              </div>
              <p className="mt-4 text-[10.5px] leading-relaxed text-slate-500">
                The action is sampled directly from {step.policy_source === 'scenario_policy' ? 'the authored scenario distribution' : "the Agent's original distribution"} p. No keyed score is applied.
              </p>
            </div>
          )}
        </div>}

        {!injected && <div className={[
          'mt-2.5 rounded-xl px-3 py-2 text-[10.5px] font-semibold',
          trace ? 'bg-indigo-600 text-white' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
        ].join(' ')}>
          {forced
            ? 'The environment requires this action next. There is no alternative for the sampler to choose.'
            : trace && winner
            ? `TRACE kept p unchanged. “${ppeActionOptionLabel(winner?.cmd ?? step.action, winner?.label ?? step.label)}” had the lowest keyed score${winner ? ` (${winner.score.toFixed(2)})` : ''}, so it was selected.`
            : trace ? 'The action is recorded, but its keyed-score explanation is unavailable.'
            : step.policy_source === 'scenario_policy' ? 'These are authored scenario weights, not LLM probabilities. TRACE does not rewrite them.'
              : 'The probability distribution comes directly from the Agent. TRACE does not rewrite it.'}
        </div>}
        {!injected && step.wm_index != null && <p className="mt-2 px-1 text-[9px] text-slate-400">Display step {step.i + 1} · eligible sampler index {step.wm_index} (zero-based){step.detector_eligible === false ? ' · excluded from detection' : ''}</p>}
        {step.result && <p className="mt-2 px-1 text-[10px] leading-relaxed text-slate-600"><b>Result at that time:</b> {step.result}</p>}
        {!injected && step.attest && <p className="mt-2 px-1 text-[9px] text-violet-600">Layer 2 · additional read-only record; no new site check or state change.</p>}
      </div>
    </motion.div>
  )
}

export default function PairedWorkflowStrip({
  phases, pair, current, running, expanded, onToggle, followReplay = false, onFollow, completedIndex,
}: {
  phases: Phase[]
  pair: PairedWorkflowData
  current: number
  completedIndex?: number
  running: boolean
  expanded: string | null
  onToggle: (id: string) => void
  followReplay?: boolean
  onFollow?: () => void
}) {
  const total = totalSteps(phases)
  const shown = Math.max(0, Math.min(current + 1, total))

  const completionCursor = !running && shown === total ? current + 1 : current
  const [manualFocus, setManualFocus] = useState<Record<DecisionSource, number | null>>({ trace: null, standard: null })
  const [selectedSource, setSelectedSource] = useState<DecisionSource | null>(null)
  const armPhases = useMemo(() => ({
    trace: buildWorkflow(pair.trace.steps, 'hse', pair.task_type, pair.stages),
    standard: buildWorkflow(pair.standard.steps, 'hse', pair.task_type, pair.stages),
  }), [pair])


  const displayPhases = useMemo(() => {
    const stageOrder = pair.stages?.length ? pair.stages : [...phases, ...armPhases.standard]
    return [...new Map(stageOrder.map((stage) => [stage.id, stage])).values()].map((stage, index): Phase => ({
      id: stage.id, num: index + 1, title: stage.title,
      desc: ('description' in stage ? stage.description : undefined) ?? stage.desc ?? '',
      steps: phases.find((phase) => phase.id === stage.id)?.steps ?? [],
    }))
  }, [pair.stages, phases, armPhases.standard])
  const activePhase = displayPhases.find((phase) => phaseContains(phase, current))
  const selectedPhase = (followReplay ? activePhase : displayPhases.find((phase) => phase.id === expanded)) ?? activePhase ?? displayPhases[0] ?? null

  useEffect(() => {
    setManualFocus({ trace: null, standard: null })
    setSelectedSource(null)
  }, [selectedPhase?.id, pair])

  const indices = {
    trace: armPhases.trace.find((phase) => phase.id === selectedPhase?.id)?.steps.map((step) => step.i) ?? [],
    standard: armPhases.standard.find((phase) => phase.id === selectedPhase?.id)?.steps.map((step) => step.i) ?? [],
  }
  const focus = {
    trace: (followReplay ? null : manualFocus.trace) ?? (indices.trace.includes(current) ? current : indices.trace[0]) ?? -1,
    standard: (followReplay ? null : manualFocus.standard) ?? indices.standard[0] ?? -1,
  }

  const shift = pair.task_type === 'construction_ppe_shift'
  const inspection = pair.task_type === PPE_TASK
  const gated = shift || inspection
  const canInspect = (source: DecisionSource, index: number) =>
    canInspectAction(pair.task_type, source, index, current, running, total, completedIndex)

  function selectAction(source: DecisionSource, index: number) {
    const alreadyOpen = selectedSource === source && focus[source] === index
    if (followReplay) onToggle(selectedPhase!.id)
    setManualFocus((previous) => ({ ...previous, [source]: index }))

    setSelectedSource(alreadyOpen || !canInspect(source, index) ? null : source)
  }

  function resumeFollow() {
    setManualFocus({ trace: null, standard: null })
    setSelectedSource(null)
    onFollow?.()
  }

  if (!selectedPhase) return null



  const inspectorAllowed = selectedSource !== null && canInspect(selectedSource, focus[selectedSource])
  const inspectedStep = selectedSource && inspectorAllowed ? pair[selectedSource].steps.find((step) => step.i === focus[selectedSource]) : null
  const entryCheck = pair.task_type === 'construction_ppe_entry_check'
  const construction = shift || inspection || entryCheck || pair.task_type === 'construction_ppe_incident_review'
  const agentSource = trajectorySource(pair)
  const agentLabel = agentSource.label
  const shiftPolicyNote = !agentSource.verified ? 'The source of normal action weights has not been verified.'
    : agentSource.source === 'scenario_policy' ? 'Normal actions use authored scenario weights, not LLM probabilities.'
      : agentSource.source === 'codex_llm' ? 'Codex LLM elicits weights over legal actions from synthetic text observations; they are normalized before sampling, not token probabilities.'
        : agentSource.source === 'api' ? 'The API LLM elicits weights over legal actions from synthetic text observations; they are normalized before sampling, not token probabilities.'
          : 'The source of normal action weights has not been verified.'

  return (
    <section className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white/85 p-3.5 shadow-[0_16px_50px_-38px_rgba(15,23,42,.45)]">
      <div className="mb-3 flex flex-wrap items-center gap-2 px-0.5">
        <div>
          <h2 className="text-[13px] font-extrabold text-slate-800">{construction ? pair.case_title ?? 'Site entry check' : 'Same task, two ways through it'}</h2>
          <p className="mt-0.5 text-[10.5px] text-slate-400">{shift ? 'Two recorded trajectories · replay highlights the current action' : 'Click an action to see how the Agent chose it'}</p>
        </div>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500 tabular-nums">
          TRACE replay · step {shown} / {total}
        </span>
        {onFollow && (running || !followReplay) && <button type="button" onClick={resumeFollow}
          title={followReplay ? 'The workflow follows the currently playing action' : 'Return to the currently playing action'}
          aria-pressed={followReplay} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${followReplay ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}>
          {running && followReplay && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />}
          {followReplay ? 'Following replay' : 'Follow replay'}
        </button>}
      </div>

      {construction && (
        <details className="mb-2 px-0.5 text-slate-500">
          <summary className="cursor-pointer text-[10px] text-slate-400">About this record · {agentLabel}</summary>
          <p className="text-[10px] font-bold text-indigo-600">
            {pair.synthetic ? 'Synthetic site scenario' : 'Recorded site scenario'} · {agentLabel}
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
            {inspection ? `Pre-entry PPE inspection. ${shiftPolicyNote} Both runs use the same evidence and prerequisite rules. A correction receipt must be followed by fresh inspection. No access-control action or incident is part of this task.` : shift
              ? `Controlled fault demonstration. ${shiftPolicyNote} Single-action steps follow environment rules. A separate controller injects an admission transaction, excluded from detection. Site events advance with the recorded clock. The injected fault is not a naturally occurring LLM error.`
              : entryCheck
              ? 'Replay what the Agent observed, checked and decided at the time. Site events follow its entry decision; the Agent cannot see future events.'
              : 'The Agent reviews recorded incident evidence. This legacy record is not a site-entry decision run.'}
          </p>
          {typeof pair.provenance?.input_disclosure === 'string' && pair.provenance.input_disclosure.trim() && (
            <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500"><b>Input disclosure:</b> {pair.provenance.input_disclosure}</p>
          )}
        </details>
      )}

      <ActionWindow indices={indices.trace} steps={pair.trace.steps} focus={focus.trace}
        source="trace" selectedSource={selectedSource} current={current} running={running} onSelect={selectAction}
        canInspect={gated ? (index) => canInspect('trace', index) : undefined} />

      {(!gated || inspectorAllowed) && <AnimatePresence initial={false} mode="wait">
        {selectedSource === 'trace' && inspectedStep && (
          <DecisionInspector key={`trace-${focus.trace}`} source="trace" step={inspectedStep} phaseTitle={selectedPhase.title}
            onClose={resumeFollow} />
        )}
      </AnimatePresence>}

      <div className="my-2 rounded-xl border border-indigo-200 bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2 px-0.5">
          <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[.08em] text-white">
            Shared main workflow
          </span>
          <span className="text-[10px] font-medium text-indigo-500">Shared timing rules · independent choices and outcomes</span>
        </div>
        <div data-workflow-phases className="mx-auto mt-2 flex max-w-[960px] items-stretch justify-between gap-2 overflow-x-auto p-1">
          {displayPhases.map((phase, index) => {
            const selected = phase.id === selectedPhase.id
            return (
              <div key={phase.id} className="relative min-w-[112px] max-w-[144px] flex-1">
                {index > 0 && <div aria-hidden="true" className="absolute -left-2 top-1/2 w-2 -translate-y-1/2 text-center text-[10px] text-indigo-200">›</div>}
                <button onClick={() => onToggle(phase.id)}
                  data-workflow-phase={phase.id}
                  className={[
                    'relative flex h-11 w-full items-center rounded-lg px-2 text-left transition-colors duration-200',
                    selected
                      ? 'bg-white ring-2 ring-indigo-400 shadow-sm'
                      : phaseDone(phase, completionCursor)
                        ? 'bg-emerald-50/70 ring-1 ring-emerald-200'
                        : 'bg-white/70 ring-1 ring-indigo-100 hover:bg-white',
                  ].join(' ')}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400">{phase.num}</span>
                    <span className={[
                      'line-clamp-2 min-w-0 text-[10px] font-semibold leading-[13px]',
                      selected ? 'text-indigo-700' : 'text-slate-600',
                    ].join(' ')}>{phase.title}</span>
                    {phase.id === activePhase?.id && running && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 animate-pulse" />}
                    {phaseDone(phase, completionCursor) && <span className="ml-auto text-[10px] font-bold text-emerald-600">✓</span>}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-slate-500">{selectedPhase.desc}</p>
      </div>

      <ActionWindow indices={indices.standard} steps={pair.standard.steps} focus={focus.standard}
        source="standard" selectedSource={selectedSource} current={-1} onSelect={selectAction}
        canInspect={gated ? (index) => canInspect('standard', index) : undefined} />

      {(!gated || inspectorAllowed) && <AnimatePresence initial={false} mode="wait">
        {selectedSource === 'standard' && inspectedStep && (
          <DecisionInspector key={`standard-${focus.standard}`} source="standard" step={inspectedStep} phaseTitle={selectedPhase.title}
            onClose={resumeFollow} />
        )}
      </AnimatePresence>}

      <p className="mt-2 px-1 text-[9px] text-slate-400">
        Aligned by workflow stage, not by step number. Probabilities describe each action's recorded state; different states can have different distributions.
      </p>
      {inspection ? <PPEOutcomeComparison pair={pair} available={!running && total > 0 && shown === total && completedIndex === total - 1} />
        : entryCheck || shift ? <EntryOutcomeComparison pair={pair} available={!running && total > 0 && shown === total} /> : <OutcomeComparison pair={pair} />}
    </section>
  )
}

export function PPEOutcomeComparison({ pair, available }: { pair: PairedWorkflowData; available: boolean }) {
  if (!available) return <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">The current PPE findings and each agent’s conclusion appear after the replay.</p>
  return <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
    <p className="text-xs font-bold text-slate-700">Recorded inspection results <span className="ml-2 font-normal text-slate-500">{pair.validation?.same_outcome ? 'Same inspection outcome' : 'Compare the two recorded outcomes'}</span></p>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">{(['trace', 'standard'] as const).map(source => {
      const report = pair[source].report
      return <div key={source} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <p className={`text-xs font-bold ${source === 'trace' ? 'text-indigo-600' : 'text-slate-500'}`}>{source === 'trace' ? 'With watermark' : 'Without watermark'} · {pair[source].steps.length} actions</p>
        <p className="mt-2 text-sm font-semibold text-slate-800">{decisionLabel(report?.decision)}</p>
        <p className="mt-1 text-xs text-slate-600">Current PPE: {report?.evaluation ? report.evaluation.actual_ppe_compliant ? 'meets the supplied rules' : 'does not meet the supplied rules' : 'evaluation not recorded'}.</p>
        <p className="mt-1 text-xs text-slate-600">Agent conclusion: {report?.evaluation ? report.evaluation.judgment_correct ? 'consistent with the observed evidence' : 'does not match the observed evidence' : 'not evaluated'}.</p>
        <div className="mt-2 space-y-1">{report?.checklist?.map(row => <p key={row.id} className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{ppeCheckLabel(row.id, row.label)}</span><span className={row.status === 'pass' ? 'text-emerald-600' : 'text-amber-700'}>{row.status === 'pass' ? 'Meets rule' : row.status === 'fail' ? 'Issue' : 'Unverified'}</span></p>)}</div>
      </div>
    })}</div>
    <p className="mt-2 text-xs leading-relaxed text-slate-500">Both runs use the same inspection rules. TRACE changes how an action is sampled, not the supplied probabilities or PPE evidence. Matching source keys does not prove a finding is correct.</p>
  </div>
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${canonical(val)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'not recorded'
}

export function displayFact(value: unknown): string {
  if (value == null) return 'Not established'
  if (typeof value === 'string') return value.replaceAll('_', ' ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.map(displayFact).join('; ') : 'None recorded'
  if (typeof value === 'object' && 'status' in value) {
    const fact = value as { status?: string; value?: unknown }
    const status = fact.status?.replaceAll('_', ' ') ?? 'status not recorded'
    return `${displayFact(fact.value)} · ${status}`
  }
  return JSON.stringify(value)
}

export function effectiveEntryDecision(report?: IncidentReport): EntryDecision | undefined {
  return report?.effective_decision ?? report?.decision
}

export function decisionLabel(decision?: EntryDecision): string {
  const labels: Record<string, string> = { approved: 'Entry approved', denied: 'Entry denied', held: 'Entry held for review',
    passed: 'PPE check passed', not_passed: 'PPE check not passed', pending: 'Further verification needed' }
  return decision?.verdict ? labels[decision.verdict] ?? displayFact(decision.verdict)
    : decision?.action ? displayFact(decision.action) : 'Decision not recorded'
}

export function entryDecisionLabel(report?: IncidentReport): string {
  return decisionLabel(effectiveEntryDecision(report))
}

export function entryComparison(pair: PairedWorkflowData) {
  const trace = pair.trace.report
  const standard = pair.standard.report
  const available = !!trace && !!standard


  const valid = available && pair.trace.validation?.valid === true && pair.standard.validation?.valid === true
  const traceDecision = effectiveEntryDecision(trace)
  const standardDecision = effectiveEntryDecision(standard)
  const decisionsKnown = !!traceDecision && !!standardDecision
  const decisionsSame = available && decisionsKnown
    && canonical({ action: traceDecision.action, verdict: traceDecision.verdict, assessment: traceDecision.assessment })
      === canonical({ action: standardDecision.action, verdict: standardDecision.verdict, assessment: standardDecision.assessment })
  const outcomesKnown = available && Array.isArray(trace.world_events) && Array.isArray(standard.world_events)
  const outcomesSame = outcomesKnown && canonical((trace.world_events ?? []).map((event) => ({ kind: event.kind, worker_state: event.worker_state, timber_state: event.timber_state })))
    === canonical((standard.world_events ?? []).map((event) => ({ kind: event.kind, worker_state: event.worker_state, timber_state: event.timber_state })))
  return { available, valid, decisionsKnown, decisionsSame, outcomesKnown, outcomesSame }
}

export function EntryOutcomeComparison({ pair, available }: { pair: PairedWorkflowData; available: boolean }) {
  const comparison = entryComparison(pair)
  const shift = pair.task_type === 'construction_ppe_shift'
  if (!available) return <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">Entry decisions and recorded site outcomes appear after the replay. The two runs are allowed to differ.</p>
  if (!comparison.available) return <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-800">Entry outcome records are incomplete. No shared outcome is asserted.</p>
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-bold text-slate-700">
        <CheckCircle2 size={14} className="text-indigo-500" /> Recorded outcomes
        <span className="ml-auto text-[9px] font-medium text-slate-500">
          {comparison.decisionsKnown ? comparison.decisionsSame ? 'Same effective decision' : 'Different effective decisions' : 'Decision not recorded'} · {comparison.outcomesKnown ? comparison.outcomesSame ? 'same site outcome' : 'different site outcomes' : 'site outcome not recorded'}
        </span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {(['trace', 'standard'] as const).map((source) => {
          const arm = pair[source]
          const report = arm.report!
          return <div key={source} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className={`text-[9px] font-extrabold uppercase tracking-wide ${source === 'trace' ? 'text-indigo-600' : 'text-slate-500'}`}>{source === 'trace' ? 'With watermark' : 'Without watermark'} · {pair.task_type === 'construction_ppe_shift' ? `${arm.steps.filter(step => step.event_kind !== 'injected_action').length} actions + injected fault` : `${arm.steps.length} actions`}</div>
            {shift && <p className="mt-1 text-[10px] text-slate-600">Agent recommendation: <b>{decisionLabel(report.recommendation)}</b></p>}
            <div className="mt-1 text-[12px] font-bold text-slate-800">{shift ? 'Effective decision: ' : ''}{entryDecisionLabel(report)}</div>
            {shift && !!report.fault_injections?.length && <p className="mt-1 text-[9px] font-semibold text-amber-700">Injected controller transaction · not an agent sample</p>}
            <p className="mt-1 text-[10px] text-slate-500">Agent assessment: {displayFact((shift ? report.recommendation : effectiveEntryDecision(report))?.assessment)}</p>
            <p className={`mt-1 text-[10px] ${report.safety?.compliant === false ? 'text-amber-700' : 'text-slate-600'}`}>
              {report.safety ? report.safety.compliant ? 'No rule violation flagged in this record.' : `${report.safety.violations?.length ?? 0} safety-rule issue(s) flagged.` : 'Safety evaluation not recorded.'}
            </p>
            <details className="mt-2 text-[10px] text-slate-500">
              <summary className="cursor-pointer font-semibold">Site events · not Agent actions</summary>
              <ul className="mt-2 space-y-1.5">{report.world_events?.map((event) => <li key={event.id}><span className="mr-1 text-slate-400">{event.timestamp}</span>{event.title ?? displayFact(event.kind)}{event.description ? ` — ${event.description}` : ''}</li>)}</ul>
              {!report.world_events?.length && <p className="mt-1">No site events recorded.</p>}
            </details>
          </div>
        })}
      </div>
      <p className="mt-2 text-[9px] text-slate-500">A completed execution is not necessarily a safe decision. TRACE preserves the supplied probabilities; it does not guarantee identical choices or consequences in two runs.</p>
      {shift && <p className="mt-1 text-[9px] text-slate-500">The fault and physical events are controlled scenario records, not watermarked choices. PPE absence is not asserted to be the sole cause of injury.</p>}
      {!comparison.valid && <p className="mt-1 text-[9px] text-amber-700">Execution-record validation is unavailable or needs attention.</p>}
    </div>
  )
}

function OutcomeComparison({ pair }: { pair: PairedWorkflowData }) {
  const construction = pair.task_type === 'construction_ppe_incident_review'
  const traceReport = pair.trace.report
  const standardReport = pair.standard.report
  const reportsAvailable = !!traceReport && !!standardReport
  const factsSame = reportsAvailable && canonical(traceReport.facts) === canonical(standardReport.facts)
  const bothSucceeded = pair.trace.success && pair.standard.success
  const pathsDiffer = canonical(pair.trace.steps.map((step) => step.action)) !== canonical(pair.standard.steps.map((step) => step.action))
  const verified = construction
    ? bothSucceeded && reportsAvailable && factsSame
      && pair.trace.validation?.valid === true && pair.standard.validation?.valid === true
      && traceReport.status === 'complete' && standardReport.status === 'complete'
      && pair.validation?.same_facts === true && pair.validation?.both_valid === true && pair.validation?.same_outcome === true
    : bothSucceeded && pair.trace.required_done === pair.trace.required_total
      && pair.standard.required_done === pair.standard.required_total
  const factKeys = [...new Set([...Object.keys(traceReport?.facts ?? {}), ...Object.keys(standardReport?.facts ?? {})])]
  const issues = [...new Set([
    ...(pair.validation?.issues ?? []), ...(pair.trace.validation?.issues ?? []), ...(pair.standard.validation?.issues ?? []),
  ])]
  return (
    <div className={[
      'mt-2.5 rounded-2xl border px-3 py-2.5',
      verified ? 'border-emerald-200 bg-emerald-50/75 text-emerald-800' : 'border-amber-200 bg-amber-50/75 text-amber-800',
    ].join(' ')}>
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide opacity-70">Recorded outcomes · both runs</div>
      <div className="flex flex-wrap items-center gap-2">
        {verified ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        <div className="flex-1">
          <div className="text-[11.5px] font-extrabold">
            {construction
              ? verified ? `${pathsDiffer ? 'Different review paths' : 'Same review path'}. Same verified facts.` : reportsAvailable ? 'Review outcomes need attention.' : 'Report comparison not available.'
              : verified ? 'Both runs completed the required checks.' : 'The recorded runs did not both complete.'}
          </div>
          <div className="mt-0.5 text-[10px] opacity-80">
            With watermark: {pair.trace.required_done}/{pair.trace.required_total} checks · without: {pair.standard.required_done}/{pair.standard.required_total} checks.
            {reportsAvailable && ` Report facts ${factsSame ? 'match' : 'differ'}.`}
          </div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[9.5px] font-bold">
          {verified ? construction ? 'review complete ✓' : 'checks complete ✓' : 'see recorded outcome'}
        </span>
      </div>
      {reportsAvailable && (
        <details className="mt-2 text-[10px]">
          <summary className="cursor-pointer font-semibold">Compare the report facts ({factKeys.length})</summary>
          <div className="mt-2 overflow-x-auto rounded-xl bg-white p-2">
            <table className="w-full text-left text-[9px] text-slate-600">
              <thead><tr><th className="p-1">Recorded fact</th><th className="p-1">With watermark</th><th className="p-1">Without watermark</th></tr></thead>
              <tbody>{factKeys.map((key) => <tr key={key} className="border-t border-slate-100">
                <td className="p-1 font-medium">{key.replaceAll('_', ' ').replaceAll('.', ' · ')}</td>
                <td className="p-1">{displayFact(traceReport.facts[key])}</td>
                <td className="p-1">{displayFact(standardReport.facts[key])}</td>
              </tr>)}</tbody>
            </table>
            <p className="mt-2 text-[9px] text-slate-500">Report status · with: {traceReport.status.replaceAll('_', ' ')} · without: {standardReport.status.replaceAll('_', ' ')}</p>
            {(traceReport.unresolved?.length || standardReport.unresolved?.length) ? <p className="mt-1 text-[9px] text-amber-700">Unresolved findings · with: {displayFact(traceReport.unresolved)} · without: {displayFact(standardReport.unresolved)}</p> : null}
          </div>
        </details>
      )}
      {!!issues.length && <p className="mt-2 text-[9px]">{issues.join(' · ')}</p>}
    </div>
  )
}
