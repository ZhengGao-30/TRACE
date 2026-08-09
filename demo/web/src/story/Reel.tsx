import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Scissors, Wand2,
  ChevronDown, ArrowLeft, ImageIcon,
} from 'lucide-react'
import { asset } from '../lib/asset'
import { navigate } from '../Router'
import { StatusPill } from './ui'

/**
 * The attack, told as a reel rather than a dashboard.
 *
 * Someone had a reason to edit this permit, and the point of the piece is that
 * the reason and the edit are both perfectly understandable -- right up until
 * the second mark speaks. So the viewer walks the story one panel at a time,
 * picks the edit themselves at the fork, and only then finds out what it cost.
 *
 * Every panel that makes a claim about the data can be opened: the analysis
 * drawer under it is the real trajectory, the real deletions and the real
 * substitutions, so the story is never asked to be taken on faith. The drawer
 * shows a short window rather than all 43 steps -- the point is legibility, not
 * completeness, and the full record already lives on the demo page.
 */

interface Step {
  i: number; action: string; label: string; phase: string
  k: number; result: string; flag: boolean
}
interface AttackCase {
  kind: 'deletion' | 'rewrite'
  actor: string
  aliveByStep?: Record<string, boolean[]>
  goneSteps?: number[]; recordsRemoved?: number; targeted?: number[]
  changed?: Record<string, { was: string; now: string }>
  stepsRewritten?: number; survivingGroups: number
  z1: number; z2: number; d1: boolean; d2: boolean; audit: number
}
interface Job {
  game_id: string; task_type: string; query: string
  model?: string; attack_model?: string; tau: number
  steps: Step[]
  clean: { z1: number; z2: number; groups: number; records: number }
  attacks: AttackCase[]
}

type Branch = 'deletion' | 'rewrite' | null

interface Act {
  id: string
  n: number
  kicker: string
  caption: string
  /** art slot: file under static/story/art/, dropped in once drawn */
  art: string
  /** which branch this act belongs to; null = shown on both */
  only?: Branch
  drawer?: 'record' | 'reading' | 'edit' | 'marks'
}

const ACTS: Act[] = [
  { id: 'service', n: 1, art: 'normal-service.webp',
    kicker: 'Normal service',
    caption: 'An AI agent works the entry permit for digester tank T-114. Two people are waiting to go in.',
    drawer: 'record' },
  { id: 'reading', n: 2, art: 'the-reading.webp',
    kicker: 'One reading comes back wrong',
    caption: 'Hydrogen sulphide reads 8.4 ppm — inside the limit, but above the re-test trigger. Until it is re-tested, nobody enters.',
    drawer: 'reading' },
  { id: 'slacking', n: 3, art: 'the-slacking.webp',
    kicker: 'Nobody was watching',
    caption: 'The supervisor had stepped away. The agent flagged the reading and the flag sat there, unread.' },
  { id: 'incident', n: 4, art: 'the-incident.webp',
    kicker: 'They went in',
    caption: 'Nobody stopped them. There will be an investigation, and the permit is the evidence it turns on.' },
  { id: 'fork', n: 5, art: 'the-panic.webp',
    kicker: 'The record can be edited',
    caption: 'It is the one document showing he was warned and was not there. Two ways to make that go away — pick one.' },
  { id: 'coverup', n: 6, art: 'the-coverup.webp',
    kicker: 'The edit',
    caption: '', drawer: 'edit' },
  { id: 'audit', n: 7, art: 'the-audit.webp',
    kicker: 'The investigator reads it',
    caption: 'On its face there is nothing wrong with this permit. Every line is a real check, in a plausible order.' },
  { id: 'marks', n: 8, art: 'the-marks.webp',
    kicker: 'It was signed twice',
    caption: '', drawer: 'marks' },
  { id: 'verdict', n: 9, art: 'the-verdict.webp',
    kicker: 'The verdict',
    caption: '' },
]

/** Placeholder until the panel art is drawn. */
function ArtSlot({ act, branch }: { act: Act; branch: Branch }) {
  const [failed, setFailed] = useState(false)
  const src = asset(`static/story/art/${branch && act.id === 'coverup'
    ? act.art.replace('.webp', `-${branch}.webp`) : act.art}`)
  if (failed) {
    return (
      <div className="w-full h-full grid place-items-center rounded-2xl
                      bg-slate-100 ring-1 ring-dashed ring-slate-300">
        <div className="text-center px-6">
          <ImageIcon size={26} className="mx-auto text-slate-300" />
          <div className="text-[14px] font-semibold text-slate-400 mt-2">{act.kicker}</div>
          <div className="mono text-[12.5px] text-slate-300 mt-1">{act.art}</div>
        </div>
      </div>
    )
  }
  return (
    <img src={src} alt={act.kicker} onError={() => setFailed(true)}
      className="w-full h-full object-contain rounded-2xl" />
  )
}

/** A short window of the record, not the whole 43 steps. */
function RecordWindow({ steps, atk, branch, mode }: {
  steps: Step[]; atk?: AttackCase; branch: Branch
  mode: 'clean' | 'after'
}) {
  const hot = steps.findIndex((s) => s.flag)
  const start = Math.max(0, Math.min(hot - 3, steps.length - 8))
  const slice = steps.slice(start, start + 8)
  return (
    <div>
      {slice.map((s) => {
        const alive = atk?.aliveByStep?.[String(s.i)] ?? []
        const gone = mode === 'after' && branch === 'deletion'
          && alive.length > 0 && alive.every((a) => !a)
        const partial = mode === 'after' && branch === 'deletion'
          && alive.some((a) => !a) && !gone
        const sub = mode === 'after' && branch === 'rewrite'
          ? atk?.changed?.[String(s.i)] : undefined
        return (
          <div key={s.i} className={[
            'rounded-xl px-3 py-2.5 mb-1.5 ring-1',
            gone ? 'bg-rose-50 ring-rose-200'
              : sub ? 'bg-amber-50/70 ring-amber-200'
                : s.flag ? 'bg-white ring-l1-200' : 'bg-slate-50/70 ring-slate-100',
          ].join(' ')}>
            <div className="flex items-center gap-2.5">
              <span className="w-6 text-[12.5px] font-semibold tabular-nums text-slate-400 shrink-0">
                {s.i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {sub ? (
                  <>
                    <div className="text-[12.5px] text-slate-400 line-through truncate">{sub.was}</div>
                    <div className="text-[14px] text-amber-800 truncate">{sub.now}</div>
                  </>
                ) : (
                  <div className={[
                    'text-[14px] truncate',
                    gone ? 'text-slate-300 line-through' : 'text-slate-700',
                  ].join(' ')}>{s.label}</div>
                )}
                {s.flag && !gone && !sub && (
                  <div className="text-[12.5px] text-l1-700 mt-0.5">{s.result}</div>
                )}
              </div>
              {/* the two lines a step can hold -- the shape mark, drawn */}
              <span className="flex items-center gap-1 shrink-0">
                {Array.from({ length: s.k }).map((_, j) => {
                  const dead = mode === 'after' && branch === 'deletion' && alive[j] === false
                  return (
                    <span key={j} className={[
                      'inline-block w-2 h-3.5 rounded-[2px]',
                      dead ? 'bg-transparent border border-dashed border-rose-300'
                        : j === 0 ? 'bg-l2-500' : 'bg-l2-400',
                    ].join(' ')} />
                  )
                })}
              </span>
              {gone && <StatusPill kind="deleted" label="Deleted" />}
              {sub && <StatusPill kind="rewritten" label="Rewritten" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Reel() {
  const [jobs, setJobs] = useState<{ game_id: string; task_type: string }[]>([])
  const [gameId, setGameId] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [at, setAt] = useState(0)
  const [branch, setBranch] = useState<Branch>(null)
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    fetch(asset('static/story/index.json'), { cache: 'no-cache' })
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs); if (d.jobs.length) setGameId(d.jobs[0].game_id) })
      .catch(() => setJobs([]))
  }, [])

  useEffect(() => {
    if (!gameId) return
    fetch(asset(`static/story/${gameId}.json`), { cache: 'no-cache' })
      .then((r) => r.json())
      .then((j) => { setJob(j); setAt(0); setBranch(null); setOpen(false) })
      .catch(() => setJob(null))
  }, [gameId])

  const act = ACTS[at]
  const atFork = act?.id === 'fork'
  const blocked = atFork && !branch          // cannot advance without choosing

  const next = useCallback(() => {
    if (blocked) return
    setAt((i) => Math.min(ACTS.length - 1, i + 1)); setOpen(false)
  }, [blocked])
  const prev = useCallback(() => {
    setAt((i) => Math.max(0, i - 1)); setOpen(false)
  }, [])

  useEffect(() => {
    if (!playing) return
    if (blocked || at >= ACTS.length - 1) { setPlaying(false); return }
    const id = window.setTimeout(next, 4200)
    return () => window.clearTimeout(id)
  }, [playing, at, blocked, next])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [next, prev])

  const atk = useMemo(
    () => job?.attacks.find((a) => a.kind === branch), [job, branch])

  if (!job) {
    return <div className="min-h-screen grid place-items-center text-[14px] text-slate-400">
      loading…
    </div>
  }

  const caption = act.id === 'coverup'
    ? (branch === 'deletion'
        ? `${atk?.recordsRemoved} lines are cut out, including that reading. The permit closes over every gap.`
        : `${atk?.stepsRewritten} steps are given a different action. Every line still reads as real work.`)
    : act.id === 'marks'
      ? (branch === 'deletion'
          ? 'The choice mark rode through the gaps and still names the agent. The shape mark broke on the first line taken — which is how anyone learns lines were taken.'
          : 'The shape mark never moved: rewording cannot change how many lines a step holds. It still names the agent, and the broken choice mark says the wording was altered.')
      : act.id === 'verdict'
        ? (branch === 'deletion'
            ? 'Cutting the record out is what announced that a record was cut out.'
            : 'Rewriting every word left the one mark that is not made of words.')
        : act.caption

  return (
    <div className="min-h-screen bg-slate-50/60 px-4 py-5">
      <div className="max-w-[1180px] mx-auto">

        {/* chrome */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/demo')}
            className="chip bg-white text-slate-600 ring-1 ring-slate-200 hover:text-l1-700">
            <ArrowLeft size={12} /> demo
          </button>
          <div className="flex-1 flex items-center gap-1.5">
            {ACTS.map((a, i) => (
              <button key={a.id} onClick={() => { if (i <= at || branch) { setAt(i); setOpen(false) } }}
                className={[
                  'h-1.5 rounded-full transition-all',
                  i === at ? 'w-8 bg-l1-600' : i < at ? 'w-4 bg-l1-300' : 'w-4 bg-slate-200',
                ].join(' ')} />
            ))}
          </div>
          <select value={gameId} onChange={(e) => setGameId(e.target.value)}
            className="rounded-lg bg-white px-3 py-2 text-[14px] ring-1 ring-slate-200">
            {jobs.map((j) => <option key={j.game_id} value={j.game_id}>{j.task_type}</option>)}
          </select>
        </div>

        {/* the panel */}
        <div className="rounded-3xl bg-white ring-1 ring-slate-900/[0.06] shadow-card p-5">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] items-center">
            <div className="relative aspect-[4/3] md:aspect-square">
              {/* Same reason as the caption: fade the incoming panel in on a key
                  change, never gate it behind an outgoing exit animation. */}
              <motion.div key={act.id + (branch ?? '')}
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0">
                <ArtSlot act={act} branch={branch} />
              </motion.div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="grid place-items-center w-8 h-8 rounded-full bg-l1-600
                                 text-white text-[16px] font-bold shrink-0">{act.n}</span>
                <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900 leading-tight">
                  {act.kicker}
                </h2>
              </div>
              {/* Keyed fade-IN only. An AnimatePresence with mode="wait" holds the
                  outgoing element until its exit animation finishes, so a stalled
                  animation (a backgrounded tab pauses rAF) leaves the panel frozen
                  on the previous act while the rest of the page has moved on. */}
              <motion.p key={caption}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28 }}
                className="text-[16px] leading-relaxed text-slate-600">
                {caption}
              </motion.p>

              {/* the fork */}
              {atFork && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {([['deletion', Scissors, 'Cut the record out',
                      'Remove the reading, and enough other lines that the gap does not show.'],
                     ['rewrite', Wand2, 'Reword the record',
                      'Have an LLM put a different, equally plausible action in its place.']] as const)
                    .map(([k, Icon, title, sub]) => (
                      <button key={k} onClick={() => setBranch(k as Branch)}
                        className={[
                          'text-left rounded-2xl p-3.5 ring-1 transition-colors',
                          branch === k ? 'bg-rose-50 ring-rose-300'
                            : 'bg-slate-50 ring-slate-200 hover:bg-white hover:ring-l1-200',
                        ].join(' ')}>
                        <Icon size={17} className={branch === k ? 'text-rose-500' : 'text-slate-400'} />
                        <div className="text-[14px] font-bold text-slate-800 mt-1.5">{title}</div>
                        <div className="text-[12.5px] text-slate-500 leading-snug mt-0.5">{sub}</div>
                      </button>
                    ))}
                </div>
              )}

              {/* the marks, when they speak */}
              {act.id === 'marks' && atk && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {([['The choice mark', atk.d1, job.clean.z1, atk.z1],
                     ['The shape mark', atk.d2, job.clean.z2, atk.z2]] as const).map(
                    ([name, ok, was, now]) => (
                      <div key={name} className={[
                        'rounded-2xl p-3.5 ring-1',
                        ok ? 'bg-emerald-50/70 ring-emerald-200' : 'bg-rose-50/60 ring-rose-200',
                      ].join(' ')}>
                        <div className={[
                          'text-[19px] font-extrabold leading-none',
                          ok ? 'text-emerald-700' : 'text-rose-600',
                        ].join(' ')}>{ok ? '✓ reads' : '✕ broken'}</div>
                        <div className="text-[14px] font-semibold text-slate-700 mt-1.5">{name}</div>
                        <div className="mono text-[12.5px] text-slate-400 mt-1 tabular-nums">
                          {was.toFixed(1)} → {now.toFixed(1)} · needs {job.tau.toFixed(1)}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {act.id === 'verdict' && atk && (
                <motion.div
                  initial={{ scale: 1.3, opacity: 0, rotate: -6 }}
                  animate={{ scale: 1, opacity: 1, rotate: -2 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                  className="mt-4 inline-block rounded-xl border-[3px] border-rose-500
                             px-4 py-2.5 text-rose-600">
                  <div className="text-[24px] font-extrabold tracking-tight leading-none">
                    {branch === 'deletion' ? 'RECORDS REMOVED' : 'WORDING ALTERED'}
                  </div>
                  <div className="text-[12.5px] font-semibold mt-1">
                    and the agent is still named
                  </div>
                </motion.div>
              )}

              {/* analysis drawer */}
              {act.drawer && (
                <button onClick={() => setOpen((v) => !v)}
                  className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold
                             text-l1-700 hover:text-l1-600">
                  <ChevronDown size={15}
                    className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                  {open ? 'Hide the record' : 'Show me the record'}
                </button>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {open && act.drawer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                className="overflow-hidden">
                <div className="mt-4 pt-4 border-t border-slate-100">
                  {act.drawer === 'edit' && branch ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <div className="eyebrow mb-2">before</div>
                        <RecordWindow steps={job.steps} branch={branch} mode="clean" />
                      </div>
                      <div>
                        <div className="eyebrow mb-2">after the edit</div>
                        <RecordWindow steps={job.steps} atk={atk} branch={branch} mode="after" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="eyebrow mb-2">
                        {act.drawer === 'reading' ? 'the step everything turns on' : 'the record being built'}
                      </div>
                      <RecordWindow steps={job.steps} branch={null} mode="clean" />
                      <div className="text-[12.5px] text-slate-400 mt-2">
                        showing 8 of {job.clean.groups} steps · the violet blocks are how many
                        lines each step holds
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* transport */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={prev} disabled={at === 0}
            className="chip bg-white ring-1 ring-slate-200 text-slate-600 disabled:opacity-40">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setPlaying((v) => !v)} disabled={blocked}
            className="chip bg-l1-600 text-white hover:bg-l1-700 disabled:opacity-40">
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? 'pause' : 'play'}
          </button>
          <button onClick={() => { setAt(0); setBranch(null); setOpen(false); setPlaying(false) }}
            className="chip bg-white ring-1 ring-slate-200 text-slate-600">
            <RotateCcw size={13} />
          </button>
          <button onClick={next} disabled={at === ACTS.length - 1 || blocked}
            className="chip bg-white ring-1 ring-slate-200 text-slate-600 disabled:opacity-40">
            <ChevronRight size={14} />
          </button>
          {blocked && (
            <span className="ml-2 text-[14px] text-rose-500 font-semibold">
              pick an edit to carry on
            </span>
          )}
        </div>

        <p className="text-[12.5px] text-slate-400 mt-4 text-center leading-relaxed">
          The record, the deletions and the substitutions are the real ones —{' '}
          {job.model} produced the trajectory, {job.attack_model} chose the replacements.
          The people and the incident are a scenario built around them.
        </p>
      </div>
    </div>
  )
}
