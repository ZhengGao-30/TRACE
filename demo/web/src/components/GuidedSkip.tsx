import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { GroupView } from './GroupCard'
import { humanize } from '../lib/guidedSteps'

/**
 * Guided view (HSE only): "What if the agent skips steps?" — a mini patrol
 * animation over 8 real stations from the run above. Some stations get
 * skipped (the agent misunderstood); the robot walks right past them.
 *
 * Mechanism, verified against the paper's source (core/layer1_exp.py,
 * layer2_count.py): tickets are keyed ONLY on the memory-1 content window —
 * "Position is deliberately absent" (paper §4.1) — and a decision that never
 * executes simply never becomes a group, so the surviving steps re-verify
 * independently; both channels just see a smaller n.
 *
 * The numbers are NOT borrowed from the deletion-attack bundle: they are
 * re-tallied live from this run's real tickets over the surviving subset —
 * z1 = (Σ −ln(1−r_win) − n)/√n over multi-candidate groups, z2 = (X − n/2)/√(n/4)
 * — the detector's exact formulas (verified bit-identical at rate 0).
 * A real skipped run would draw different ticket values with the same
 * distribution; this panel retallies the actual tickets, which is
 * distribution-faithful and adds no new randomness.
 * Post-hoc deletion is a different, harsher story (window desync, tally
 * skeleton shift) — that one lives in the tamper panel.
 */

const RATES = [
  { rate: 0.1, label: '😇 a step or two · 10%' },
  { rate: 0.3, label: '😅 quite a few · 30%' },
  { rate: 0.5, label: '🫣 half the job · 50%' },
]
const N_STATIONS = 8
const STEP_MS = 620

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function stationIcon(cmd: string): string {
  if (/loto|lock/.test(cmd)) return '🏷️'
  if (/gas_meter/.test(cmd)) return '🧪'
  if (/permit/.test(cmd)) return '📋'
  if (/energy_isolation/.test(cmd)) return '⚡'
  if (/ventilation/.test(cmd)) return '💨'
  if (/rescue/.test(cmd)) return '🚑'
  if (/harness/.test(cmd)) return '🧗'
  if (/medical/.test(cmd)) return '🩺'
  if (/competency/.test(cmd)) return '📇'
  if (/weather/.test(cmd)) return '🌦️'
  if (/evidence|compile/.test(cmd)) return '📎'
  if (/countersign|brief|notify/.test(cmd)) return '📣'
  if (/scba/.test(cmd)) return '🫁'
  if (/lighting/.test(cmd)) return '🔦'
  if (/barrier/.test(cmd)) return '🚧'
  if (/first_aid/.test(cmd)) return '⛑️'
  if (/communication/.test(cmd)) return '📻'
  if (/signage/.test(cmd)) return '🪧'
  if (/retrieval/.test(cmd)) return '🛟'
  if (/vehicle/.test(cmd)) return '🚗'
  if (/purge/.test(cmd)) return '🌀'
  if (/calibration/.test(cmd)) return '🎚️'
  if (/msds/.test(cmd)) return '📄'
  if (/incident/.test(cmd)) return '📖'
  if (/attendant/.test(cmd)) return '👷'
  return '🔧'
}

export default function GuidedSkip({
  groups, scenario, ready, tau, open, onToggle,
}: {
  groups: GroupView[]
  scenario: string
  ready: boolean
  tau: number
  open: boolean
  onToggle: () => void
}) {
  const [rate, setRate] = useState(0.3)
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle')
  const [pos, setPos] = useState(-1) // station index the robot stands at
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // seeded skip set over ALL groups of the run; stations mirror their group's fate
  const skip = useMemo(() => {
    const rnd = mulberry32(7)
    const s = new Set<number>()
    groups.forEach((g) => { if (rnd() < rate) s.add(g.i) })
    return s
  }, [groups, rate])

  // 8 evenly spaced real stations
  const stations = useMemo(() => {
    if (!groups.length) return []
    const N = groups.length
    return Array.from({ length: N_STATIONS }, (_, j) => {
      const g = groups[Math.min(Math.round((j + 0.5) * N / N_STATIONS - 0.5), N - 1)]
      const cmd = g.chosen ?? ''
      return {
        i: g.i,
        label: humanize(cmd, scenario).label,
        icon: stationIcon(cmd),
        skipped: skip.has(g.i),
      }
    })
  }, [groups, skip, scenario])

  // honest retally over the surviving subset (detector's exact formulas)
  const stats = useMemo(() => {
    let n1 = 0, x1 = 0, n2 = 0, x2 = 0
    for (const g of groups) {
      if (skip.has(g.i)) continue
      const race = g.race ?? []
      if (race.length >= 2) {
        const w = race.find((r) => r.win)
        if (w) { x1 += -Math.log(Math.max(1 - w.r, 1e-12)); n1++ }
      }
      n2++; if (g.l2hit) x2++
    }
    return {
      kept: n2,
      total: groups.length,
      z1: n1 ? (x1 - n1) / Math.sqrt(n1) : 0,
      z2: n2 ? (x2 - n2 / 2) / Math.sqrt(n2 / 4) : 0,
    }
  }, [groups, skip])

  const play = () => {
    if (timer.current) clearInterval(timer.current)
    setPhase('playing'); setPos(-1)
    let p = -1
    timer.current = setInterval(() => {
      p++
      setPos(p)
      if (p >= N_STATIONS - 1) {
        if (timer.current) clearInterval(timer.current)
        setTimeout(() => setPhase('done'), 500)
      }
    }, STEP_MS)
  }
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  const switchRate = (r: number) => {
    setRate(r); setPhase('idle'); setPos(-1)
    if (timer.current) clearInterval(timer.current)
  }

  // §4.3 / Prop D.13: either channel alone is enough to prove origin
  const originHolds = stats.z1 > tau || stats.z2 > tau

  return (
    <div>
      {/* the toggle device */}
      <button onClick={onToggle}
        className={[
          'w-full card px-4 py-2.5 flex items-center gap-2.5 text-left transition-all duration-500 ease-fluid',
          open ? 'ring-2 ring-amber-400' : 'hover:shadow-lift',
        ].join(' ')}>
        <span className="text-[15px]">🤖</span>
        <span className="text-[12.5px] font-bold text-slate-700">
          What if the agent skips steps? — the seal survives the gaps
        </span>
        <span className="ml-auto text-slate-300">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden">
            <div className="card mt-2 p-5">
              <div className="flex items-center gap-2.5 mb-1">
                <h3 className="text-[15px] font-extrabold text-slate-800">
                  What if the agent skips steps?
                </h3>
                <span className="rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-extrabold px-2 py-1">
                  ✓ Still verifiable
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mb-4">
                Real agents sometimes misunderstand the task and quietly skip an action.
                Watch the patrol — then check what the watermark can still prove.
              </p>

              {!groups.length ? (
                <div className="text-[12px] text-slate-400 text-center py-4">
                  Run the replay above first — the patrol visits this run's real stations. 🏭
                </div>
              ) : (
                <>
                  {/* ================= the mini patrol scene ================= */}
                  <div className="relative rounded-2xl ring-1 ring-slate-100 px-6 pt-7 pb-5 mb-3.5
                                  bg-gradient-to-b from-slate-50 to-slate-100/70 overflow-hidden">
                    {/* dotted route */}
                    <div className="absolute left-12 right-12 top-[62px] h-[3px]
                                    bg-[repeating-linear-gradient(90deg,#cbd5e1_0_10px,transparent_10px_18px)]" />
                    <div className="relative flex justify-between">
                      {stations.map((st, j) => {
                        const resolved = phase !== 'idle' && j <= pos
                        const done = resolved && !st.skipped
                        const skipped = resolved && st.skipped
                        return (
                          <div key={st.i} className="flex flex-col items-center gap-1.5 w-[11%] min-w-0">
                            <motion.div
                              animate={
                                done ? { scale: [1, 1.15, 1], borderColor: '#6366f1', backgroundColor: '#eef2ff' }
                                  : skipped ? { opacity: 0.5, filter: 'grayscale(0.7)' }
                                  : {}
                              }
                              transition={{ duration: 0.35 }}
                              className={[
                                'relative w-12 h-12 rounded-xl grid place-items-center text-[22px] bg-white',
                                done ? 'border-2 border-l1-500 shadow-[0_0_0_4px_#6366f122]'
                                  : skipped ? 'border-2 border-dashed border-slate-300'
                                  : 'border-2 border-slate-200',
                              ].join(' ')}>
                              {st.icon}
                              {done && (
                                <motion.span
                                  initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-l1-500 text-white
                                             text-[10px] grid place-items-center shadow">◈</motion.span>
                              )}
                              {skipped && (
                                <motion.span
                                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white
                                             border-[1.5px] border-dashed border-slate-300 text-slate-400
                                             text-[10px] grid place-items-center">⤼</motion.span>
                              )}
                            </motion.div>
                            <div className={[
                              'text-[9.5px] font-bold text-center leading-tight line-clamp-2',
                              skipped ? 'text-slate-300 line-through' : done ? 'text-l1-700' : 'text-slate-400',
                            ].join(' ')}>
                              {st.label}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* the robot */}
                    <motion.div
                      className="absolute top-3 text-[26px] z-10 drop-shadow-md"
                      initial={false}
                      animate={{ left: `${((Math.max(pos, 0) + 0.5) / N_STATIONS) * 88 + 4}%` }}
                      transition={{ duration: STEP_MS / 1000, ease: pos === 0 ? 'easeOut' : 'linear' }}>
                      🤖
                    </motion.div>
                  </div>

                  {/* controls */}
                  <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                    {ready ? (
                      <button onClick={play} disabled={phase === 'playing'}
                        className="inline-flex items-center gap-2 rounded-full bg-l1-600 text-white text-[12px]
                                   font-extrabold px-5 py-2 shadow-sm hover:bg-l1-700 transition-colors
                                   disabled:opacity-50">
                        {phase === 'done' ? '↺ Watch it again' : phase === 'playing' ? '⏳ Patrolling…' : '▶ Watch the patrol'}
                      </button>
                    ) : (
                      <span className="text-[11.5px] text-slate-400">
                        ⏳ Finish the run above — then walk the patrol.
                      </span>
                    )}
                    <div className="flex gap-1.5">
                      {RATES.map((r) => (
                        <button key={r.rate} onClick={() => switchRate(r.rate)}
                          className={[
                            'rounded-full px-3 py-1.5 text-[11px] font-bold transition-all border-[1.5px]',
                            rate === r.rate
                              ? 'border-amber-400 text-amber-700 bg-amber-50'
                              : 'border-slate-200 text-slate-400 bg-white hover:text-slate-600',
                          ].join(' ')}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <span className="ml-auto text-[10px] text-slate-300 font-semibold">
                      stations from the real run above
                    </span>
                  </div>

                  {/* verdicts */}
                  <AnimatePresence>
                    {phase === 'done' && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className={[
                            'rounded-2xl px-4 py-3 text-[11.5px] leading-relaxed ring-1',
                            originHolds
                              ? 'bg-emerald-50 ring-emerald-200 text-emerald-800'
                              : 'bg-rose-50 ring-rose-200 text-rose-700',
                          ].join(' ')}>
                            <div className="font-extrabold text-[12.5px] mb-1">
                              {originHolds
                                ? '🟢 Every stop it made still proves it’s ours ◈'
                                : '🔴 Too few stops left to prove origin'}
                            </div>
                            Re-tally the <b className="mono">{stats.kept}</b> steps that <i>did</i> happen:
                            selection <b className="mono">z = {stats.z1 >= 0 ? '+' : ''}{stats.z1.toFixed(2)}</b>,
                            tally <b className="mono">z = {stats.z2 >= 0 ? '+' : ''}{stats.z2.toFixed(2)}</b>
                            {' '}(bar: <b className="mono">{tau.toFixed(1)}</b>).
                            The mark lives in what the agent actually does — a step that never
                            happened simply has no ticket.
                          </div>
                          <div className="rounded-2xl px-4 py-3 text-[11.5px] leading-relaxed
                                          bg-amber-50 ring-1 ring-amber-200 text-amber-800">
                            <div className="font-extrabold text-[12.5px] mb-1">
                              🟠 Erasing steps after the fact is tampering — a harsher case
                            </div>
                            A skip <i>during</i> the run is the gentle case: every surviving ticket
                            re-checks on its own, because tickets are keyed on each step's content,
                            never its position. Deleting records afterwards breaks the chain — and
                            even that still holds up to 30% in this very run (tamper panel above).
                          </div>
                        </div>
                        <div className="text-center text-[10.5px] text-slate-400">
                          Numbers re-tallied live from this run's real tickets over the surviving steps —
                          same formulas the detector runs (paper §4.1: position is deliberately absent
                          from the keying).
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
