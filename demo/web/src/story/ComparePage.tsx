import { Fragment, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, ShieldCheck, Eye, CornerDownRight, Dices } from 'lucide-react'
import { asset } from '../lib/asset'
import { navigate } from '../Router'
import { PageShell, Panel, Banner, Ask } from './ui'

/**
 * What the watermark actually changes.
 *
 * Three things, in the order a viewer asks them:
 *
 *   the CHOICES differ    almost every step lands on a different action. That is
 *                         Layer 1: the key deals each candidate a number r, the
 *                         score -ln(r)/p combines it with the agent's own
 *                         preference p, and the lowest score wins. Clicking a
 *                         step opens that race, because "different" reads as
 *                         "worse" until you can see what the agent thought of
 *                         each option.
 *   the WORK is the same  every required check still gets done, including the
 *                         safety-critical re-test.
 *   the COST is a line    Layer 2 appends an inert attestation to some steps.
 *                         It has to appear as a row in the log, not as a number
 *                         in a footnote, because that is literally where it is.
 */

interface RaceRow { label: string; p: number; r: number; score: number; win: boolean }
interface Step {
  i: number; action: string; label: string; phase: string; result: string
  k: number; attest: string | null; p: number; pMax: number; nCand: number
  flag: boolean; required: boolean; rank: number; race: RaceRow[]
}
interface Arm {
  arm: string; steps: Step[]; n_steps: number; records: number; success: boolean
  required_done: number; required_total: number; attestations: number
  pMedian: number; z1: number; z2: number; d1: boolean; d2: boolean
}
interface Distortion {
  stepIndex: number; nKeys: number; nCandidates: number; totalVariation: number
  rows: { label: string; p: number; freq: number }[]
}
interface Job {
  game_id: string; task_type: string; query: string
  model?: string; temperature?: number; tau: number; window: number
  standard: Arm; trace: Arm
  agreement: { same: number; of: number }
  distortion: Distortion[]
}

/**
 * The distortion-free claim, checked rather than asserted.
 *
 * A single run picks one action, so no single run can show that the distribution
 * is preserved. Running the same step under many keys and counting can. The two
 * bars per option are what the agent asked for and what the watermark actually
 * does -- if the mechanism distorted anything, they would come apart.
 */
function DistortionCheck({ d, stepLabel }: { d: Distortion; stepLabel: string }) {
  const max = Math.max(...d.rows.flatMap((r) => [r.p, r.freq]), 0.01)
  return (
    <div className="card p-4">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] items-start">
        <div className="min-w-0">
          {d.rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 mb-1.5">
              <span className="w-[168px] shrink-0 text-[14px] text-slate-600 truncate text-right">
                {r.label}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <motion.div className="h-[9px] rounded-r bg-slate-300"
                  initial={{ width: 0 }} animate={{ width: `${(r.p / max) * 100}%` }}
                  transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }} />
                <motion.div className="h-[9px] rounded-r bg-l1-500"
                  initial={{ width: 0 }} animate={{ width: `${(r.freq / max) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.12, ease: [0.32, 0.72, 0, 1] }} />
              </div>
              <span className="mono text-[12.5px] text-slate-400 tabular-nums w-[76px] shrink-0">
                {r.p.toFixed(3)} / {r.freq.toFixed(3)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-4 mt-2.5 pt-2 border-t border-slate-100 text-[12.5px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-[9px] rounded-r bg-slate-300" />
              <span className="text-slate-500">what the agent asked for (p)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-[9px] rounded-r bg-l1-500" />
              <span className="text-slate-500">how often the watermark picks it</span>
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-50/70 ring-1 ring-emerald-200 p-3 md:w-[210px]">
          <div className="text-[12.5px] text-emerald-700 font-semibold">Difference between them</div>
          <div className="text-[36px] font-extrabold text-emerald-700 tabular-nums leading-none mt-1">
            {(d.totalVariation * 100).toFixed(1)}%
          </div>
          <p className="text-[12.5px] text-slate-500 leading-snug mt-2">
            Step {d.stepIndex + 1} — “{stepLabel}” — re-run under {d.nKeys.toLocaleString()}{' '}
            different keys, across{' '}
            {d.nCandidates} options. A gap this small is the counting noise you get from{' '}
            {d.nKeys.toLocaleString()} samples — not the mechanism leaning on anything.
          </p>
        </div>
      </div>
    </div>
  )
}

function StepLine({ s, other, side, open, onToggle }: {
  s: Step; other?: Step; side: 'std' | 'trace'
  open: boolean; onToggle: () => void
}) {
  const differs = other ? other.action !== s.action : false
  const isTrace = side === 'trace'
  return (
    <div className="mb-1.5">
      <button onClick={onToggle}
        className={[
          'w-full text-left rounded-lg px-2.5 py-2 ring-1 transition-colors',
          open ? 'bg-l1-50 ring-l1-200'
            : differs ? 'bg-amber-50/50 ring-amber-100 hover:bg-amber-50'
              : 'bg-slate-50/70 ring-slate-100 hover:bg-slate-50',
        ].join(' ')}>
        <div className="flex items-center gap-2">
          <span className="w-5 text-[12.5px] font-semibold tabular-nums text-slate-300 shrink-0">
            {s.i + 1}
          </span>
          <span className="flex-1 min-w-0 text-[14px] text-slate-700 truncate">
            {s.label}
          </span>
        </div>
      </button>

      {/* Layer 2's cost, exactly where it lands */}
      {isTrace && s.attest && (
        <div className="flex items-center gap-1.5 pl-7 pr-2 py-1.5">
          <CornerDownRight size={11} className="text-l2-400 shrink-0" />
          <span className="text-[14px] text-l2-700">{s.attest}</span>
          <span className="chip bg-l2-100 text-l2-700 text-[12.5px] shrink-0">
            inert · no state change
          </span>
        </div>
      )}

      {/* the Layer 1 race that produced this choice */}
      <AnimatePresence initial={false}>
        {open && isTrace && s.race.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="overflow-hidden">
            <div className="mt-1 rounded-lg bg-white ring-1 ring-l1-200 p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Dices size={12} className="text-l1-600" />
                <span className="text-[12.5px] font-bold text-l1-700">
                  How Layer 1 chose · {s.nCand} options
                </span>
                <span className="ml-auto text-[12.5px] text-slate-400">
                  it took the agent's #{s.rank} preference
                </span>
              </div>
              <div className="mono text-[12.5px] text-slate-400 mb-1.5">
                score = −ln(r) ÷ p · lowest wins
              </div>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-1.5
                              text-[12.5px] tabular-nums">
                <span className="text-slate-400">option</span>
                <span className="text-slate-400 text-right">p</span>
                <span className="text-slate-400 text-right">r</span>
                <span className="text-slate-400 text-right">score</span>
                {s.race.map((r, k) => (
                  <Fragment key={k}>
                    <span key={`l${k}`} className={[
                      'truncate', r.win ? 'font-bold text-l1-700' : 'text-slate-500',
                    ].join(' ')}>{r.label}</span>
                    <span key={`p${k}`} className={`text-right ${r.win ? 'font-bold text-l1-700' : 'text-slate-500'}`}>
                      {r.p.toFixed(3)}
                    </span>
                    <span key={`r${k}`} className={`text-right ${r.win ? 'font-bold text-l1-700' : 'text-slate-400'}`}>
                      {r.r.toFixed(3)}
                    </span>
                    <span key={`s${k}`} className={`text-right ${r.win ? 'font-bold text-l1-700' : 'text-slate-400'}`}>
                      {r.score.toFixed(2)}{r.win ? ' ←' : ''}
                    </span>
                  </Fragment>
                ))}
              </div>
              <div className="text-[12.5px] text-slate-400 leading-snug mt-2 pt-1.5
                              border-t border-slate-100">
                Dividing by p keeps the agent's own preference in charge — a high-p
                option needs far less luck to win. The key only decides which of the
                options the agent liked actually gets taken.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ComparePage() {
  const [jobs, setJobs] = useState<{ game_id: string; task_type: string }[]>([])
  const [gameId, setGameId] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [openStep, setOpenStep] = useState<number>(0)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    fetch(asset('static/compare/index.json'), { cache: 'no-cache' })
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs); if (d.jobs.length) setGameId(d.jobs[0].game_id) })
      .catch(() => setJobs([]))
  }, [])

  useEffect(() => {
    if (!gameId) return
    fetch(asset(`static/compare/${gameId}.json`), { cache: 'no-cache' })
      .then((r) => r.json())
      .then((j) => { setJob(j); setRevealed(false); setOpenStep(0) })
      .catch(() => setJob(null))
  }, [gameId])

  const win = useMemo(() => {
    if (!job) return null
    const n = job.window
    const cut = (a: Arm) => a.steps.slice(0, n)
    return { std: cut(job.standard), trace: cut(job.trace) }
  }, [job])

  if (!job || !win) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-400">
      loading…
    </div>
  }

  const s = job.standard, t = job.trace
  const selected = job.distortion.find((d) => d.stepIndex === openStep) ?? job.distortion[0]
  const selectedLabel = job.trace.steps.find((x) => x.i === selected?.stepIndex)?.label ?? ''
  const grow = Math.round((t.records / s.records - 1) * 100)
  const diff = job.agreement.of - job.agreement.same

  return (
    <PageShell
      title="Same job. Different route. Same permit."
      subtitle={`Two agents ran the identical HSE job. They chose differently at ${diff} of ${job.agreement.of} steps — and finished with the same checks done.`}
      right={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <select value={gameId} onChange={(e) => setGameId(e.target.value)}
            className="rounded-lg bg-white px-2.5 py-1.5 text-[14px] ring-1 ring-slate-200">
            {jobs.map((j) => <option key={j.game_id} value={j.game_id}>{j.task_type}</option>)}
          </select>
          <button onClick={() => navigate('/')}
            className="text-[14px] text-slate-400 hover:text-l1-600 px-2">← project</button>
        </div>
      }>

      <Ask n={1} q="Did the agent choose differently?" a={`Yes — at ${diff} of ${job.agreement.of} steps.`}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel n={1} tone="indigo" title="Standard agent"
            badge={<Bot size={16} className="text-l1-600" />}>
            <div className="text-[12.5px] text-slate-400 mb-2">
              samples straight from its own distribution
            </div>
            {win.std.map((st, k) => (
              <StepLine key={st.i} s={st} other={win.trace[k]} side="std"
                open={false} onToggle={() => {}} />
            ))}
          </Panel>

          <Panel n={2} tone="emerald" title="TRACE agent"
            badge={<ShieldCheck size={16} className="text-emerald-600" />}>
            <div className="text-[12.5px] text-slate-400 mb-2">
              click a step — the race below and the check underneath both follow it
            </div>
            {win.trace.map((st, k) => (
              <StepLine key={st.i} s={st} other={win.std[k]} side="trace"
                open={openStep === st.i}
                onToggle={() => setOpenStep(st.i)} />
            ))}
          </Panel>
        </div>
        <div className="text-[12.5px] text-slate-400 mt-2 text-center">
          first {job.window} of {job.trace.n_steps} steps · a tinted row is one where the two
          agents chose differently · the violet lines are what Layer 2 appends
        </div>
      </Ask>

      {selected && (
        <Ask n={2} q="Then is it choosing worse actions?" a="No — the distribution is untouched.">
          <DistortionCheck d={selected} stepLabel={selectedLabel} />
        </Ask>
      )}

      <Ask n={3} q="What does it cost?" a={`+${grow}% longer log.`}>
        <div className="card p-4 grid gap-4 md:grid-cols-[auto_1fr] items-center">
          <div className="flex items-baseline gap-2">
            <span className="text-[30px] font-bold text-slate-400 tabular-nums">{s.records}</span>
            <span className="text-slate-300">→</span>
            <span className="text-[36px] font-extrabold text-l2-700 tabular-nums">{t.records}</span>
            <span className="text-[14px] text-slate-500">lines</span>
          </div>
          <p className="text-[14px] text-slate-500 leading-snug">
            The extra {t.records - s.records} are the violet lines above: an attestation is
            re-reading an entry the agent already has. It calls no instrument, changes no
            state, writes nothing into the permit, and is never taken instead of a real
            check. How many lines a step holds is what the second mark is written in.
          </p>
        </div>
      </Ask>

      <Ask n={4} q="What does it buy?" a="A record that can be traced to its author.">
        <div className="flex justify-center mb-3">
          <motion.button onClick={() => setRevealed((v) => !v)} whileTap={{ scale: 0.97 }}
            className={[
              'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[16px] font-semibold shadow-sm',
              revealed ? 'bg-white text-slate-600 ring-1 ring-slate-200' : 'bg-l1-600 text-white hover:bg-l1-700',
            ].join(' ')}>
            <Eye size={15} />
            {revealed ? 'Hide the check' : 'Check who produced each record'}
          </motion.button>
        </div>
        <AnimatePresence>
          {revealed && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} className="grid gap-3 lg:grid-cols-2">
              {([[s, false], [t, true]] as const).map(([arm, isT]) => (
                <div key={String(isT)} className={[
                  'rounded-2xl p-4 ring-1',
                  arm.d1 || arm.d2 ? 'bg-emerald-50/70 ring-emerald-200' : 'bg-slate-100/70 ring-slate-200',
                ].join(' ')}>
                  <div className="text-[14px] font-semibold text-slate-500 mb-1.5">
                    {isT ? 'TRACE agent' : 'Standard agent'}
                  </div>
                  <div className={[
                    'text-[24px] font-extrabold leading-tight',
                    arm.d1 || arm.d2 ? 'text-emerald-700' : 'text-slate-500',
                  ].join(' ')}>
                    {arm.d1 || arm.d2 ? 'Traceable' : 'Anonymous'}
                  </div>
                  <div className="text-[14px] text-slate-600 mt-1">
                    {arm.d1 || arm.d2
                      ? 'Both marks read. The holder cannot disown this record.'
                      : 'Nothing ties this record to the agent that produced it. Anyone can claim it, and anyone can disown it.'}
                  </div>
                  <div className="mono text-[12.5px] text-slate-400 mt-1.5 tabular-nums">
                    choices {arm.z1.toFixed(2)} · shape {arm.z2.toFixed(2)} · needs {job.tau.toFixed(1)}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Ask>

      <div className="mt-4">
        <Banner tone="emerald"
          title="Different route. Same work. Only one is provable."
          sub={`Both agents completed ${s.required_done}/${s.required_total} required checks, including the safety-critical re-test, and issued the permit. Not measured here: efficiency, or whether a different route is ever a worse route.`} />
      </div>

      <p className="text-[12.5px] text-slate-400 mt-3 leading-relaxed">
        Both arms run once against {job.model} at temperature {job.temperature}, through the
        same environment. The standard arm samples from the elicited distribution; the TRACE
        arm runs the unmodified two-layer watermark over the same distribution.
      </p>
    </PageShell>
  )
}
