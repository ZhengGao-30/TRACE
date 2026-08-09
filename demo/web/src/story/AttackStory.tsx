import { Fragment, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scissors, Wand2, UserRoundX, CornerDownRight, ArrowLeft } from 'lucide-react'
import { asset } from '../lib/asset'
import { navigate } from '../Router'
import { PageShell, Panel, Ask, StatusPill, Banner } from './ui'

/**
 * The two attacks, in the same shape as the comparison page: numbered questions,
 * one visual each, plain words first and the statistic in small print.
 *
 * The claim worth landing is not "the score went down". It is that the two marks
 * fail under DIFFERENT edits -- deletion takes the shape mark and leaves the
 * choice mark standing, rewriting does the reverse -- so the pair does not merely
 * say the record was altered, it says which edit was made. Running the two cases
 * back to back is the only way that reads.
 */

interface Step {
  i: number; action: string; label: string; phase: string
  k: number; result: string; flag: boolean
}
interface AttackCase {
  kind: 'deletion' | 'rewrite'
  rate: number; title: string; subtitle: string; actor: string
  aliveByStep?: Record<string, boolean[]>
  goneSteps?: number[]; recordsRemoved?: number; targeted?: number[]
  changed?: Record<string, { was: string; now: string }>
  stepsRewritten?: number; survivingGroups: number
  z1: number; z2: number; d1: boolean; d2: boolean; audit: number
  banner: string; bannerSub: string
}
interface Job {
  game_id: string; task_type: string; query: string
  model?: string; attack_model?: string; tau: number
  steps: Step[]
  clean: { z1: number; z2: number; groups: number; records: number }
  attacks: AttackCase[]
}

/** A window centred on the record an interested party would want gone. */
function windowOf(steps: Step[], size = 9) {
  const hot = steps.findIndex((s) => s.flag)
  const anchor = hot >= 0 ? hot : 0
  let start = Math.max(0, anchor - Math.floor(size / 2))
  start = Math.min(start, Math.max(0, steps.length - size))
  return { start, slice: steps.slice(start, start + size) }
}

type State = 'ok' | 'partial' | 'deleted' | 'rewritten'

function Row({ s, state, lost, was, targeted, showAttest }: {
  s: Step; state: State; lost: number; was?: string
  targeted: boolean; showAttest: boolean
}) {
  const dead = state === 'deleted'
  return (
    <div className={[
      'rounded-xl px-3 py-2.5 mb-1.5 ring-1 transition-colors',
      targeted && dead ? 'bg-rose-50 ring-rose-300'
        : dead ? 'bg-rose-50/50 ring-rose-100'
          : state === 'rewritten' ? 'bg-amber-50/70 ring-amber-200'
            : state === 'partial' ? 'bg-slate-50 ring-slate-200'
              : 'bg-slate-50/70 ring-slate-100',
    ].join(' ')}>
      <div className="flex items-center gap-2.5">
        <span className={[
          'w-6 text-[12.5px] font-semibold tabular-nums shrink-0',
          dead ? 'text-slate-300' : 'text-slate-400',
        ].join(' ')}>{s.i + 1}</span>

        <div className="min-w-0 flex-1">
          {state === 'rewritten' ? (
            <>
              <div className="text-[12.5px] text-slate-400 line-through truncate">{was}</div>
              <div className="text-[14px] text-amber-800 font-medium truncate">{s.label}</div>
            </>
          ) : (
            <div className={[
              'text-[14px] truncate',
              dead ? 'text-slate-300 line-through' : 'text-slate-700',
            ].join(' ')}>{s.label}</div>
          )}
          {targeted && dead && (
            <div className="text-[12.5px] text-rose-600 mt-0.5">
              this is the reading that required a re-test
            </div>
          )}
          {state === 'partial' && (
            <div className="text-[12.5px] text-slate-400 mt-0.5">
              {lost} of {s.k} lines removed — the step still looks complete
            </div>
          )}
        </div>

        <span className="shrink-0">
          {dead ? <StatusPill kind="deleted" label="Deleted" />
            : state === 'rewritten' ? <StatusPill kind="rewritten" label="Rewritten" />
              : state === 'partial' ? <StatusPill kind="rewritten" label={`−${lost} line`} />
                : <StatusPill kind="ok" label="Intact" />}
        </span>
      </div>

      {showAttest && !dead && s.k >= 2 && (
        <div className="flex items-center gap-1.5 pl-8 pt-1.5">
          <CornerDownRight size={12} className="text-l2-400 shrink-0" />
          <span className="text-[12.5px] text-l2-700">Re-read the last entry</span>
        </div>
      )}
    </div>
  )
}

/** Plain-word verdict for one mark. */
function Verdict({ tone, name, what, ok, brokenWord, why, z, zClean, tau }: {
  tone: 'l1' | 'l2'; name: string; what: string; ok: boolean
  brokenWord: string; why: string; z: number; zClean: number; tau: number
}) {
  return (
    <div className={[
      'rounded-2xl p-4 ring-1',
      ok ? 'bg-emerald-50/70 ring-emerald-200' : 'bg-rose-50/60 ring-rose-200',
    ].join(' ')}>
      <div className="flex items-start gap-3">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className={[
            'grid place-items-center w-11 h-11 rounded-full shrink-0 text-white',
            'text-[24px] font-bold leading-none',
            ok ? 'bg-emerald-500' : 'bg-rose-500',
          ].join(' ')}>
          {ok ? '✓' : '✕'}
        </motion.span>
        <div className="min-w-0 flex-1">
          <div className={[
            'text-[19px] font-extrabold tracking-tight leading-none',
            ok ? 'text-emerald-700' : 'text-rose-600',
          ].join(' ')}>
            {ok ? 'STILL READS' : brokenWord}
          </div>
          <div className={[
            'text-[14px] font-semibold mt-1',
            tone === 'l1' ? 'text-l1-700' : 'text-l2-700',
          ].join(' ')}>{name}</div>
          <div className="text-[12.5px] text-slate-500 leading-snug mt-0.5">{what}</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-900/[0.06]">
        <div className="text-[14px] leading-snug text-slate-600">{why}</div>
        <div className="mono text-[12.5px] text-slate-400 tabular-nums mt-2">
          score {zClean.toFixed(1)} → {z.toFixed(1)} · needs {tau.toFixed(1)}
        </div>
      </div>
    </div>
  )
}

export default function AttackStory() {
  const [jobs, setJobs] = useState<{ game_id: string; task_type: string }[]>([])
  const [gameId, setGameId] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [which, setWhich] = useState(0)

  useEffect(() => {
    fetch(asset('static/story/index.json'), { cache: 'no-cache' })
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs); if (d.jobs.length) setGameId(d.jobs[0].game_id) })
      .catch(() => setJobs([]))
  }, [])

  useEffect(() => {
    if (!gameId) return
    fetch(asset(`static/story/${gameId}.json`), { cache: 'no-cache' })
      .then((r) => r.json()).then(setJob).catch(() => setJob(null))
  }, [gameId])

  const win = useMemo(() => (job ? windowOf(job.steps) : null), [job])
  if (!job || !win) {
    return <div className="min-h-screen grid place-items-center text-[14px] text-slate-400">
      loading…
    </div>
  }

  const atk = job.attacks[which]
  const isDel = atk.kind === 'deletion'
  const tau = job.tau

  const stateOf = (s: Step): State => {
    if (!isDel) return atk.changed?.[String(s.i)] ? 'rewritten' : 'ok'
    const alive = atk.aliveByStep?.[String(s.i)] ?? []
    if (!alive.length) return 'ok'
    if (alive.every((a) => !a)) return 'deleted'
    return alive.some((a) => !a) ? 'partial' : 'ok'
  }
  const lostAt = (s: Step) => isDel
    ? (atk.aliveByStep?.[String(s.i)] ?? []).filter((a) => !a).length : 0

  const changed = isDel
    ? `${atk.recordsRemoved} of ${job.clean.records} lines gone.`
    : `${atk.stepsRewritten} of ${job.clean.groups} steps rewritten.`

  return (
    <PageShell
      title={atk.title}
      subtitle={atk.subtitle}
      right={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {job.attacks.map((a, i) => (
              <button key={a.kind} onClick={() => setWhich(i)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2',
                  'text-[14px] font-semibold transition-colors',
                  i === which ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}>
                {a.kind === 'deletion' ? <Scissors size={14} /> : <Wand2 size={14} />}
                {a.kind === 'deletion' ? 'Deletion' : 'LLM rewrite'}
              </button>
            ))}
          </div>
          <select value={gameId} onChange={(e) => setGameId(e.target.value)}
            className="rounded-lg bg-white px-3 py-2 text-[14px] ring-1 ring-slate-200">
            {jobs.map((j) => <option key={j.game_id} value={j.game_id}>{j.task_type}</option>)}
          </select>
          <button onClick={() => navigate('/demo')}
            className="text-[14px] text-slate-400 hover:text-l1-600 px-2">
            <ArrowLeft size={13} className="inline mr-1" />demo
          </button>
        </div>
      }>

      <AnimatePresence mode="wait">
        <motion.div key={atk.kind + gameId}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>

          <Ask n={1} q="What did they change?" a={changed} tone="rose">
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel n={1} tone="indigo" title="The record as produced">
                <div className="text-[12.5px] text-slate-400 mb-2.5">
                  {job.clean.groups} steps · {job.clean.records} lines
                </div>
                {win.slice.map((s) => (
                  <Row key={s.i} s={s} state="ok" lost={0} targeted={false} showAttest />
                ))}
              </Panel>

              <div className="relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white
                                   px-3 py-1.5 ring-1 ring-rose-200 shadow-sm">
                    <UserRoundX size={13} className="text-rose-500" />
                    <span className="text-[12.5px] font-semibold text-rose-600">{atk.actor}</span>
                  </span>
                </div>
                <Panel n={2} tone="rose" title={isDel ? 'After deletion' : 'After the rewrite'}>
                  <div className="text-[12.5px] text-slate-400 mb-2.5">
                    {atk.survivingGroups} steps survive
                  </div>
                  {win.slice.map((s) => (
                    <Row key={s.i} s={s} state={stateOf(s)} lost={lostAt(s)}
                      was={atk.changed?.[String(s.i)]?.was}
                      targeted={(atk.targeted ?? []).includes(s.i)}
                      showAttest={isDel} />
                  ))}
                </Panel>
              </div>
            </div>
            <div className="text-[12.5px] text-slate-400 mt-2 text-center">
              steps {win.start + 1}–{win.start + win.slice.length} of {job.steps.length}
            </div>
          </Ask>

          <Ask n={2} q="Could you tell by reading it?"
            a="No — it still reads as a valid permit." tone="rose">
            <div className="card p-4 text-[14px] leading-relaxed text-slate-600 max-w-4xl">
              {isDel
                ? 'Every surviving line is a real check that really happened, and the permit closes over each gap. Nothing on the face of the document says a record is missing — which is exactly what makes deletion worth doing.'
                : 'Every line names a legitimate check drawn from the same admissible set, in a plausible order, and the number of lines per step is untouched. Nothing on the face of the document says it was reworded.'}
            </div>
          </Ask>

          <Ask n={3} q="Can TRACE still name the agent?"
            a={atk.d1 || atk.d2 ? 'Yes.' : 'No — it took both edits at once.'}
            tone={atk.d1 || atk.d2 ? 'emerald' : 'rose'}>
            <div className="grid gap-3 lg:grid-cols-2">
              <Verdict tone="l1" name="The choice mark" ok={atk.d1} brokenWord="OVERWRITTEN"
                what="Left in which action each step took."
                why={atk.d1
                  ? 'Each mark is anchored to the step before it, so a gap disturbs only one step and the rest re-find themselves. Cutting lines out cannot reach it.'
                  : 'Every action was swapped for a different one, so there is nothing left of the original choices to read.'}
                z={atk.z1} zClean={job.clean.z1} tau={tau} />
              <Verdict tone="l2" name="The shape mark" ok={atk.d2} brokenWord="BROKEN"
                what="Left in how many lines each step holds."
                why={atk.d2
                  ? 'Rewording a line never changes how many lines a step has, so this mark is exactly what it was before the edit.'
                  : 'Every removed line shifts the ones after it, so the shape stops lining up. It breaks on the first line taken — which is how you learn any were taken.'}
                z={atk.z2} zClean={job.clean.z2} tau={tau} />
            </div>
          </Ask>

          <Ask n={4} q="Does it also say what was done?"
            a="Yes — the mark that fails names the edit." tone="emerald">
            <div className="card p-4">
              <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-[12.5px] max-w-2xl">
                <div />
                <div className="text-center font-semibold text-slate-400 pb-1">shape mark reads</div>
                <div className="text-center font-semibold text-slate-400 pb-1">shape mark broken</div>
                {([[true, 'choice mark reads'], [false, 'choice mark gone']] as const).map(
                  ([rowOk, rowLbl]) => (
                    <Fragment key={rowLbl}>
                      <div className="pr-2 self-center text-right font-semibold text-slate-400">
                        {rowLbl}
                      </div>
                      {[true, false].map((colOk) => {
                        const here = atk.d1 === rowOk && atk.d2 === colOk
                        const text = rowOk && colOk ? 'untouched'
                          : rowOk && !colOk ? 'lines were removed'
                            : !rowOk && colOk ? 'wording was rewritten' : 'both, at a cost'
                        return (
                          <div key={String(colOk)} className={[
                            'rounded-xl px-3 py-3 text-center leading-tight ring-1 transition-colors',
                            here ? 'bg-l1-600 text-white ring-l1-600 font-bold shadow-sm'
                              : 'bg-slate-50 text-slate-400 ring-slate-200',
                          ].join(' ')}>
                            {text}
                          </div>
                        )
                      })}
                    </Fragment>
                  ))}
              </div>
              <p className="text-[14px] text-slate-500 leading-snug mt-3 max-w-2xl">
                The two marks are not two attempts at the same job. One is anchored to
                content, the other to position, so they fail under different edits — and
                which one failed is the diagnosis.
                {!atk.d1 && !atk.d2 && (
                  <> Taking both needed deletion AND rewriting together, and the log now
                    contradicts the executed stream on {(atk.audit * 100).toFixed(0)}% of
                    steps — a third thing to explain.</>
                )}
              </p>
            </div>
          </Ask>

          <div className="mt-5">
            <Banner tone={atk.d1 || atk.d2 ? 'emerald' : 'slate'}
              title={atk.banner} sub={atk.bannerSub} />
          </div>

          <p className="text-[12.5px] text-slate-400 mt-4 leading-relaxed">
            Real trajectory from {job.model}, through the unmodified two-layer watermark.
            The rewrite is {job.attack_model} choosing a different admissible action at each
            step, following attacks/alfworld/llm_substitute.py. Detection threshold{' '}
            {tau.toFixed(1)}; the untouched record scores {job.clean.z1.toFixed(2)} and{' '}
            {job.clean.z2.toFixed(2)}.
          </p>
        </motion.div>
      </AnimatePresence>
    </PageShell>
  )
}
