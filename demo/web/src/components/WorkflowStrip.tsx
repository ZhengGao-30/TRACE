import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { Phase } from '../lib/guidedSteps'
import { totalSteps } from '../lib/guidedSteps'

/**
 * The guided-view workflow strip: the run's many small decisions grouped into
 * a few named phases. Each phase card is an accordion — click it to see the
 * small steps inside as chips (done ✓ / current ● / upcoming).
 */

type StepState = 'done' | 'cur' | 'todo'

function phaseStatus(p: Phase, current: number): 'done' | 'now' | 'todo' {
  const last = p.steps[p.steps.length - 1].i
  const first = p.steps[0].i
  if (current > last) return 'done'
  if (current >= first) return 'now'
  return 'todo'
}

/** Merge consecutive steps that share a merge key into one "plural ×N" chip. */
function mergedChips(p: Phase, current: number, running: boolean) {
  const out: { chip: string; n: number; state: StepState; group?: string }[] = []
  for (const s of p.steps) {
    const state: StepState = s.i < current ? 'done' : s.i === current ? (running ? 'cur' : 'done') : 'todo'
    const prev = out[out.length - 1]
    if (prev && prev.chip === s.chip && prev.state === state) {
      prev.n++
    } else if (prev && s.group && prev.group === s.group && prev.state === state) {
      prev.n++
    } else {
      out.push({ chip: s.chip, n: 1, state, group: s.group })
    }
  }
  return out
}

export default function WorkflowStrip({
  phases, current, running, expanded, onToggle,
}: {
  phases: Phase[]
  /** index of the latest step that has arrived (-1 = nothing yet) */
  current: number
  running: boolean
  expanded: string | null
  onToggle: (id: string) => void
}) {
  const total = totalSteps(phases)
  const shown = Math.max(0, Math.min(current + 1, total))
  const expandedPhase = phases.find((p) => p.id === expanded) ?? null

  return (
    <div>
      <div className="flex items-baseline gap-2.5 mb-2 px-0.5">
        <h2 className="text-[13px] font-extrabold text-slate-800">The agent's workflow</h2>
        <span className="text-[11px] text-slate-400">
          {total} small decisions, grouped into {phases.length} phases — click a phase to see the steps inside
        </span>
        <span className="ml-auto chip bg-l1-50 text-l1-700 ring-1 ring-l1-100 tabular-nums">
          step {shown} / {total}
        </span>
      </div>

      <div className="flex items-stretch">
        {phases.map((p, pi) => {
          const st = phaseStatus(p, current)
          const doneN = p.steps.filter((s) => s.i <= current).length
          const open = expanded === p.id
          return (
            <div key={p.id} className="contents">
              {pi > 0 && <div className="self-center px-1.5 text-slate-300 text-[15px]">→</div>}
              <button
                onClick={() => onToggle(p.id)}
                className={[
                  'flex-1 rounded-2xl px-3 py-2.5 text-left transition-all duration-500 ease-fluid',
                  st === 'now'
                    ? 'flex-[1.3] bg-white ring-2 ring-l1-500 shadow-lift'
                    : st === 'done'
                      ? 'bg-emerald-50/40 ring-1 ring-emerald-200 hover:ring-emerald-300'
                      : 'bg-white ring-1 ring-slate-200 opacity-70 hover:opacity-100',
                ].join(' ')}>
                <div className="flex items-center gap-1.5">
                  <span className={[
                    'text-[12px] font-extrabold',
                    st === 'now' ? 'text-l1-700' : st === 'done' ? 'text-emerald-700' : 'text-slate-500',
                  ].join(' ')}>
                    {String(p.num)}&nbsp;{p.title}
                  </span>
                  {st === 'done' && <span className="text-emerald-600 text-[11px] font-bold">✓</span>}
                  {st === 'now' && running && (
                    <span className="w-2 h-2 rounded-full bg-l1-500 animate-pulseRing" />
                  )}
                  <span className="ml-auto text-slate-300">
                    {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{p.desc}</div>
                {st === 'now' && (
                  <div className="mt-1.5 h-1 rounded-full bg-l1-100 overflow-hidden">
                    <motion.div className="h-full bg-l1-500 rounded-full"
                      animate={{ width: `${(doneN / p.steps.length) * 100}%` }}
                      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }} />
                  </div>
                )}
                <div className="mt-1 text-[9.5px] font-semibold text-slate-400">
                  {st === 'done'
                    ? <>{p.steps.length} steps · <span className="text-l1-600">◈ marked</span></>
                    : st === 'now'
                      ? `${doneN} / ${p.steps.length} steps done`
                      : `${p.steps.length} steps`}
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {/* micro-step chips of the expanded phase */}
      <AnimatePresence initial={false}>
        {expandedPhase && (
          <motion.div
            key={expandedPhase.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden">
            <div className="mt-2 card border-l-[3px] border-l-l1-500 px-3.5 py-2.5
                            flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] font-extrabold text-l1-700 mr-1 whitespace-nowrap">
                Phase {expandedPhase.num} steps:
              </span>
              {mergedChips(expandedPhase, current, running).map((c, idx) => (
                <span key={idx} className={[
                  'text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ring-1',
                  c.state === 'done' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : c.state === 'cur' ? 'bg-l1-500 text-white font-bold ring-l1-500 shadow-sm'
                    : 'bg-slate-50 text-slate-400 ring-slate-200',
                ].join(' ')}>
                  {c.state === 'done' ? '✓ ' : c.state === 'cur' ? '● ' : ''}
                  {c.n > 1 && c.group ? c.group : c.chip}{c.n > 1 ? ` ×${c.n}` : ''}
                </span>
              ))}
              <span className="ml-auto text-[10px] text-slate-400 whitespace-nowrap">
                each finished step = <b className="text-l1-600">one more piece of watermark evidence</b>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
