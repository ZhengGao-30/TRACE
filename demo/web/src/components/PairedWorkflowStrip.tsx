import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3, CheckCircle2, Dices, KeyRound, ShieldCheck, X,
} from 'lucide-react'
import type { Phase } from '../lib/guidedSteps'
import { totalSteps } from '../lib/guidedSteps'

export interface PairedRaceRow {
  label: string
  p: number
  r: number
  score: number
  win: boolean
}

export interface PairedTrajectoryStep {
  i: number
  action: string
  label: string
  p?: number
  rank?: number
  nCand?: number
  attest?: string | null
  required?: boolean
  race?: PairedRaceRow[]
}

export interface PairedTrajectoryArm {
  steps: PairedTrajectoryStep[]
  success: boolean
  required_done: number
  required_total: number
}

export interface PairedWorkflowData {
  task_type: string
  standard: PairedTrajectoryArm
  trace: PairedTrajectoryArm
  agreement: { same: number; of: number }
}

type DecisionSource = 'trace' | 'standard'

interface DistributionEntry {
  label: string
  p: number
  selected: boolean
}

function phaseContains(phase: Phase, step: number) {
  return phase.steps.some((item) => item.i === step)
}

function phaseDone(phase: Phase, current: number) {
  const last = phase.steps[phase.steps.length - 1]?.i ?? 0
  return current > last
}

function probabilitySnapshot(step: PairedTrajectoryStep) {
  const candidates = new Map<string, DistributionEntry>()
  for (const row of step.race ?? []) {
    candidates.set(row.label, {
      label: row.label,
      p: row.p,
      selected: row.label === step.label,
    })
  }
  if (!candidates.has(step.label)) {
    candidates.set(step.label, {
      label: step.label,
      p: step.p ?? 0,
      selected: true,
    })
  }

  const chosen = candidates.get(step.label)
  const others = [...candidates.values()]
    .filter((row) => row.label !== step.label)
    .sort((a, b) => b.p - a.p)
  const rows = [...(chosen ? [chosen] : []), ...others].slice(0, 5)
  const shownProbability = rows.reduce((sum, row) => sum + row.p, 0)
  return {
    rows,
    otherCount: Math.max(0, (step.nCand ?? rows.length) - rows.length),
    otherProbability: Math.max(0, 1 - shownProbability),
  }
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function ActionWindow({ phase, steps, focus, source, selectedSource, current, onSelect }: {
  phase: Phase
  steps: PairedTrajectoryStep[]
  focus: number
  source: DecisionSource
  selectedSource: DecisionSource | null
  current: number
  onSelect: (source: DecisionSource, index: number) => void
}) {
  const trace = source === 'trace'
  const phaseIndices = phase.steps.map((step) => step.i)
  const focusPosition = Math.max(0, phaseIndices.indexOf(focus))
  const windowSize = Math.min(3, phaseIndices.length)
  const start = Math.max(0, Math.min(focusPosition - 1, phaseIndices.length - windowSize))
  const visible = phaseIndices.slice(start, start + windowSize)

  return (
    <div className={[
      'rounded-2xl border px-3 py-3',
      trace ? 'border-indigo-200 bg-indigo-50/65' : 'border-slate-200 bg-slate-50/90',
    ].join(' ')}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={[
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em]',
          trace ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white',
        ].join(' ')}>
          {trace ? <ShieldCheck size={11} /> : <Dices size={11} />}
          {trace ? 'With watermark' : 'Without watermark'}
        </span>
        <span className="text-[10px] font-medium text-slate-400">Click an action to inspect its decision</span>
      </div>

      <div className="flex min-h-[42px] items-center justify-center gap-2">
        {start > 0 && <span className="text-slate-300">…</span>}
        {visible.map((index, order) => {
          const item = steps[index]
          if (!item) return null
          const selected = selectedSource === source && index === focus
          const counterpart = selectedSource !== null && selectedSource !== source && index === focus
          const arrived = current < 0 || index <= current
          return (
            <div key={index} className="contents">
              {order > 0 && <span className="text-slate-300">→</span>}
              <motion.button layout animate={{ scale: selected ? 1.02 : 1 }}
                onClick={() => onSelect(source, index)}
                aria-label={`${trace ? 'With' : 'Without'} watermark step ${index + 1}: ${item.label}`}
                className={[
                  'min-w-0 rounded-xl px-3 py-2 text-left text-[10.5px] transition md:max-w-[280px]',
                  selected
                    ? trace
                      ? 'bg-indigo-600 text-white ring-1 ring-indigo-600 shadow-sm'
                      : 'bg-slate-800 text-white ring-1 ring-slate-800 shadow-sm'
                    : counterpart
                      ? 'bg-white text-slate-700 ring-2 ring-amber-300'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-indigo-300',
                  arrived ? '' : 'opacity-40',
                ].join(' ')}>
                <span className={selected ? 'text-white/60' : 'text-slate-300'}>{index + 1}</span>
                <span className="ml-2 font-semibold">{item.label}</span>
              </motion.button>
            </div>
          )
        })}
        {start + windowSize < phaseIndices.length && <span className="text-slate-300">…</span>}
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
            <BarChart3 size={12} className="text-indigo-500" /> Agent's action probabilities
          </div>
          <div className="mt-0.5 text-[9.5px] text-slate-400">Original policy output p · recorded before sampling</div>
        </div>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-extrabold text-emerald-700 ring-1 ring-emerald-200">
          {trace ? 'unchanged by TRACE ✓' : 'original distribution'}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {distribution.rows.map((row) => (
          <div key={row.label} className="grid items-center gap-2 text-[9.5px]"
            style={{ gridTemplateColumns: 'minmax(130px, 1fr) minmax(90px, 1.25fr) 48px' }}>
            <span className={row.selected ? 'truncate font-extrabold text-indigo-700' : 'truncate text-slate-500'}>
              {row.label}{row.selected ? ' ← selected' : ''}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.span initial={{ width: 0 }} animate={{ width: `${Math.max(4, row.p / maxProbability * 100)}%` }}
                className={['block h-full rounded-full', row.selected ? 'bg-indigo-500' : 'bg-slate-300'].join(' ')} />
            </span>
            <span className={row.selected ? 'text-right font-bold text-indigo-700' : 'text-right text-slate-400'}>{percent(row.p)}</span>
          </div>
        ))}
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
        {step.nCand ?? distribution.rows.length} valid actions in this decision · displayed candidates plus the aggregated remainder
      </div>
    </div>
  )
}

function DecisionInspector({ source, step, onClose }: {
  source: DecisionSource
  step: PairedTrajectoryStep
  onClose: () => void
}) {
  const trace = source === 'trace'
  const scoreRows = [...(step.race ?? [])].sort((a, b) => a.score - b.score).slice(0, 6)
  const winner = scoreRows.find((row) => row.win) ?? scoreRows[0]

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
            {trace ? <KeyRound size={12} /> : <Dices size={12} />}
            {trace ? 'Watermarked decision' : 'Ordinary decision'} · step {step.i + 1}
          </span>
          <span className="truncate text-[10px] font-semibold text-slate-500">{step.label}</span>
          <button onClick={onClose} aria-label="Close decision details"
            className="ml-auto rounded-full bg-white p-1.5 text-slate-400 ring-1 ring-slate-200 hover:text-slate-700">
            <X size={12} />
          </button>
        </div>

        <div className="grid gap-2.5 lg:grid-cols-2">
          <ProbabilityBars step={step} trace={trace} />

          {trace ? (
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
                    <span className={row.win ? 'truncate font-extrabold text-indigo-700' : 'truncate text-slate-500'}>{row.label}</span>
                    <span className={row.win ? 'text-right font-bold text-indigo-700' : 'text-right text-slate-400'}>{row.p.toFixed(3)}</span>
                    <span className={row.win ? 'text-right font-bold text-indigo-700' : 'text-right text-slate-400'}>{row.r.toFixed(3)}</span>
                    <span className={row.win ? 'text-right font-extrabold text-indigo-700' : 'text-right text-slate-400'}>{row.score.toFixed(2)}{row.win ? ' ←' : ''}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[8.5px] text-slate-400">Lowest-score candidates shown · {step.nCand ?? scoreRows.length} candidates evaluated</div>
            </div>
          ) : (
            <div className="flex flex-col justify-center rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[.06em] text-slate-600">
                No watermark score
              </span>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-600">
                <span className="rounded-lg bg-slate-100 px-2.5 py-2">Agent policy p</span>
                <span className="text-slate-300">→</span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-2">ordinary sample</span>
                <span className="text-slate-300">→</span>
                <span className="rounded-lg bg-slate-800 px-2.5 py-2 text-white">{step.label}</span>
              </div>
              <p className="mt-4 text-[10.5px] leading-relaxed text-slate-500">
                The action is sampled directly from the Agent's original distribution p. No keyed score is applied.
              </p>
            </div>
          )}
        </div>

        <div className={[
          'mt-2.5 rounded-xl px-3 py-2 text-[10.5px] font-semibold',
          trace ? 'bg-indigo-600 text-white' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
        ].join(' ')}>
          {trace
            ? `TRACE kept p unchanged. “${winner?.label ?? step.label}” had the lowest keyed score${winner ? ` (${winner.score.toFixed(2)})` : ''}, so it was selected.`
            : 'The probability distribution comes directly from the Agent. TRACE does not rewrite it.'}
        </div>
      </div>
    </motion.div>
  )
}

export default function PairedWorkflowStrip({
  phases, pair, current, running, expanded, onToggle,
}: {
  phases: Phase[]
  pair: PairedWorkflowData
  current: number
  running: boolean
  expanded: string | null
  onToggle: (id: string) => void
}) {
  const total = totalSteps(phases)
  const shown = Math.max(0, Math.min(current + 1, total))
  const activePhase = phases.find((phase) => phaseContains(phase, current))
  const selectedPhase = phases.find((phase) => phase.id === expanded) ?? activePhase ?? phases[0] ?? null
  const [manualFocus, setManualFocus] = useState<number | null>(null)
  const [selectedSource, setSelectedSource] = useState<DecisionSource | null>(null)

  useEffect(() => {
    setManualFocus(null)
    setSelectedSource(null)
  }, [selectedPhase?.id, pair])

  const changedIndices = useMemo(() => {
    if (!selectedPhase) return []
    return selectedPhase.steps
      .map((step) => step.i)
      .filter((index) => pair.trace.steps[index]?.action !== pair.standard.steps[index]?.action)
  }, [selectedPhase, pair])

  const comparisonIndices = changedIndices.length > 0
    ? changedIndices
    : selectedPhase?.steps.map((step) => step.i) ?? []
  const replayFocus = current >= 0 && phaseContains(selectedPhase ?? phases[0], current) ? current : null
  const focusIndex = (running ? replayFocus : manualFocus) ?? replayFocus ?? comparisonIndices[0] ?? -1
  const sameRequired = pair.trace.required_done === pair.standard.required_done
    && pair.trace.required_total === pair.standard.required_total
  const differentN = pair.agreement.of - pair.agreement.same

  function selectAction(source: DecisionSource, index: number) {
    const alreadyOpen = selectedSource === source && focusIndex === index
    setManualFocus(index)
    setSelectedSource(alreadyOpen ? null : source)
  }

  if (!selectedPhase || focusIndex < 0) return null

  const inspectedStep = selectedSource === 'trace'
    ? pair.trace.steps[focusIndex]
    : selectedSource === 'standard'
      ? pair.standard.steps[focusIndex]
      : null

  return (
    <section className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white/85 p-3.5 shadow-[0_16px_50px_-38px_rgba(15,23,42,.45)]">
      <div className="mb-3 flex flex-wrap items-center gap-2 px-0.5">
        <div>
          <h2 className="text-[13px] font-extrabold text-slate-800">Same task, two ways through it</h2>
          <p className="mt-0.5 text-[10.5px] text-slate-400">Click an action to see how the Agent chose it</p>
        </div>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500 tabular-nums">
          step {shown} / {total}
        </span>
      </div>

      <ActionWindow phase={selectedPhase} steps={pair.trace.steps} focus={focusIndex}
        source="trace" selectedSource={selectedSource} current={current} onSelect={selectAction} />

      <AnimatePresence initial={false} mode="wait">
        {selectedSource === 'trace' && inspectedStep && (
          <DecisionInspector key={`trace-${focusIndex}`} source="trace" step={inspectedStep}
            onClose={() => setSelectedSource(null)} />
        )}
      </AnimatePresence>

      <div className="my-2.5 rounded-2xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/65 to-white p-2.5">
        <div className="flex flex-wrap items-center gap-2 px-0.5">
          <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[.08em] text-white">
            Shared main workflow
          </span>
          <span className="text-[10px] font-medium text-indigo-500">Same task requirements in both runs</span>
        </div>
        <div className="mt-2 flex items-stretch">
          {phases.map((phase, index) => {
            const selected = phase.id === selectedPhase.id
            return (
              <div key={phase.id} className="contents">
                {index > 0 && <div className="self-center px-1.5 text-[14px] text-indigo-200">→</div>}
                <button onClick={() => onToggle(phase.id)}
                  className={[
                    'relative min-w-0 flex-1 rounded-xl px-3 py-3 text-left transition-all duration-200',
                    selected
                      ? 'bg-white ring-2 ring-indigo-400 shadow-sm'
                      : phaseDone(phase, current)
                        ? 'bg-emerald-50/70 ring-1 ring-emerald-200'
                        : 'bg-white/70 ring-1 ring-indigo-100 hover:bg-white',
                  ].join(' ')}>
                  <div className="flex items-center gap-1.5">
                    <span className={[
                      'truncate text-[10.5px] font-extrabold',
                      selected ? 'text-indigo-700' : 'text-slate-600',
                    ].join(' ')}>{phase.num}&nbsp; {phase.title}</span>
                    {selected && running && <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulseRing" />}
                    {phaseDone(phase, current) && <span className="ml-auto text-[10px] font-bold text-emerald-600">✓</span>}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <ActionWindow phase={selectedPhase} steps={pair.standard.steps} focus={focusIndex}
        source="standard" selectedSource={selectedSource} current={current} onSelect={selectAction} />

      <AnimatePresence initial={false} mode="wait">
        {selectedSource === 'standard' && inspectedStep && (
          <DecisionInspector key={`standard-${focusIndex}`} source="standard" step={inspectedStep}
            onClose={() => setSelectedSource(null)} />
        )}
      </AnimatePresence>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/75 px-3 py-2.5">
        <CheckCircle2 size={16} className="text-emerald-600" />
        <div>
          <div className="text-[11.5px] font-extrabold text-emerald-800">Different choices. Same final result.</div>
          <div className="text-[10px] text-emerald-700/75">
            {sameRequired
              ? `${differentN}/${pair.agreement.of} positions differ · both completed ${pair.trace.required_done}/${pair.trace.required_total} required checks.`
              : 'Both trajectories are evaluated against the same required checklist.'}
          </div>
        </div>
        <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[9.5px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          task completed ✓
        </span>
      </div>
    </section>
  )
}
