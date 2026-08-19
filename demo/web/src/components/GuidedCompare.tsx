import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { GroupView } from './GroupCard'
import { humanize } from '../lib/guidedSteps'

/**
 * Guided view: "Does the watermark slow the agent down?" — the with/without
 * comparison, aimed at non-experts. Two beats:
 *
 * ① Same task, two runs — two lanes race the same job; both finish with
 *   identical results (real numbers from the replay above). The only
 *   difference: the keyed run can later prove it's ours ◈.
 *
 * ② The repeat test — one real choice, faced 200× with plain dice vs 200×
 *   with the key-stamped lottery (argmin of −log u / p, the actual watermark
 *   draw). Both histograms converge to the same shape: the key re-rolls the
 *   dice, it never rigs them. The keyed sampler is seeded, so "same key →
 *   same tries".
 */

const DRAWS = 200
const BATCHES = 20
const BATCH_MS = 90

/** deterministic PRNG — stands in for the key stream */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Cand { label: string; p: number }

export default function GuidedCompare({
  groups, scenario, ready, open, onToggle,
}: {
  groups: GroupView[]
  scenario: string
  ready: boolean
  open: boolean
  onToggle: () => void
}) {
  // representative step: the decision with the most candidates, top 3 shown
  const cands: Cand[] = useMemo(() => {
    let best: GroupView | null = null
    for (const g of groups) {
      if ((g.race?.length ?? 0) > (best?.race?.length ?? 0)) best = g
    }
    const race = best?.race
    if (!race || race.length < 2) {
      return [
        { label: "the model's top choice", p: 0.6 },
        { label: 'a decent alternative', p: 0.25 },
        { label: 'a long shot', p: 0.15 },
      ]
    }
    const top = [...race].sort((a, b) => b.p - a.p).slice(0, 3)
    const sum = top.reduce((s, r) => s + r.p, 0) || 1
    return top.map((r) => ({
      label: humanize(r.cmd, scenario).label,
      p: r.p / sum,
    }))
  }, [groups, scenario])

  const maxP = Math.max(...cands.map((c) => c.p))
  const steps = groups.length

  // ---- part A: the two-lane race --------------------------------------
  const [lanePhase, setLanePhase] = useState<'idle' | 'running' | 'done'>('idle')
  const laneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runLanes = () => {
    if (laneTimer.current) clearTimeout(laneTimer.current)
    setLanePhase('running')
    laneTimer.current = setTimeout(() => setLanePhase('done'), 2500)
  }

  // ---- part B: the sampling test --------------------------------------
  const [plain, setPlain] = useState<number[]>([0, 0, 0])
  const [keyed, setKeyed] = useState<number[]>([0, 0, 0])
  const [drawn, setDrawn] = useState(0)
  const [drawing, setDrawing] = useState(false)
  const [lastPick, setLastPick] = useState<[string, string] | null>(null)
  const drawTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const drawSamples = () => {
    if (drawing) return
    if (drawTimer.current) clearInterval(drawTimer.current)
    const rng = mulberry32(1337) // the "key": same seed → same draws
    const cum: number[] = []
    cands.reduce((s, c, i) => (cum[i] = s + c.p, s + c.p), 0)
    const per = DRAWS / BATCHES
    const pCounts = [0, 0, 0]
    const kCounts = [0, 0, 0]
    let batch = 0
    setPlain([0, 0, 0]); setKeyed([0, 0, 0]); setDrawn(0)
    setDrawing(true)
    drawTimer.current = setInterval(() => {
      for (let k = 0; k < per; k++) {
        // plain model dice: straight categorical sample from p
        const u = Math.random()
        const pIdx = cum.findIndex((c) => u <= c)
        pCounts[pIdx]++
        // key-stamped dice: the watermark lottery, argmin of −log u / p
        let best = 0; let bestScore = Infinity
        cands.forEach((c, i) => {
          const s = -Math.log(Math.max(rng(), 1e-12)) / c.p
          if (s < bestScore) { bestScore = s; best = i }
        })
        kCounts[best]++
        setLastPick([cands[pIdx].label, cands[best].label])
      }
      batch++
      setPlain([...pCounts]); setKeyed([...kCounts]); setDrawn(batch * per)
      if (batch >= BATCHES && drawTimer.current) {
        clearInterval(drawTimer.current)
        setDrawing(false)
      }
    }, BATCH_MS)
  }
  const sampled = drawn >= DRAWS

  const barH = (n: number) => (drawn ? Math.max(3, (n / drawn) * (84 / maxP)) : 3)

  return (
    <div>
      {/* the toggle device */}
      <button onClick={onToggle}
        className={[
          'w-full card px-4 py-2.5 flex items-center gap-2.5 text-left transition-all duration-500 ease-fluid',
          open ? 'ring-2 ring-emerald-400' : 'hover:shadow-lift',
        ].join(' ')}>
        <span className="text-[15px]">🚀</span>
        <span className="text-[12.5px] font-bold text-slate-700">
          Does the watermark slow the agent down? — spoiler: no
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
                  Does the watermark slow the agent down?
                </h3>
                <span className="rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-extrabold px-2 py-1">
                  ✓ No measurable cost
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mb-4">
                Same task, run twice — once <b className="text-l1-700">with the key 🔑</b>, once{' '}
                <b className="text-slate-600">without it 🚫</b>. Watch what changes (and what doesn't).
              </p>

              {/* ================= ① same task, two runs ================= */}
              <div className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400 mb-2">
                ① Same task, two runs
              </div>
              <div className="flex gap-3 items-stretch mb-2.5">
                {([
                  { key: true, icon: '🔑', title: 'With the watermark' },
                  { key: false, icon: '🚫', title: 'Without the watermark' },
                ] as const).map((lane) => (
                  <div key={lane.title} className={[
                    'flex-1 rounded-2xl px-4 py-3.5 ring-[1.5px]',
                    lane.key ? 'bg-l1-50 ring-l1-200' : 'bg-slate-50 ring-slate-200',
                  ].join(' ')}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[17px]">{lane.icon}</span>
                      <span className={`text-[12.5px] font-extrabold ${lane.key ? 'text-l1-700' : 'text-slate-700'}`}>
                        {lane.title}
                      </span>
                    </div>
                    {/* the track */}
                    <div className="relative h-8 rounded-full bg-white ring-1 ring-slate-200 mb-2.5 overflow-hidden">
                      <motion.div
                        className={[
                          'absolute inset-y-0 left-0 rounded-full',
                          lane.key
                            ? 'bg-gradient-to-r from-l1-200/40 to-l1-400/30'
                            : 'bg-gradient-to-r from-slate-200/50 to-slate-400/25',
                        ].join(' ')}
                        initial={false}
                        animate={{ width: lanePhase === 'idle' ? '0%' : '100%' }}
                        transition={{ duration: 2.4, ease: [0.45, 0, 0.55, 1] }} />
                      <motion.span
                        className="absolute top-1/2 -translate-y-1/2 text-[17px]"
                        initial={false}
                        animate={{ left: lanePhase === 'idle' ? '2%' : '84%' }}
                        transition={{ duration: 2.4, ease: [0.45, 0, 0.55, 1] }}>
                        🤖
                      </motion.span>
                      <span className="absolute top-1/2 -translate-y-1/2 right-1.5 text-[14px]">🏁</span>
                    </div>
                    {/* the stats */}
                    <div className="flex gap-2">
                      {([
                        { v: '✓ Done', k: 'task result', ok: true },
                        { v: String(steps || '—'), k: 'steps taken', ok: false },
                        lane.key
                          ? { v: '◈ provably ours', k: 'ownership', ok: true }
                          : { v: '✗ no proof', k: 'ownership', ok: false },
                      ]).map((s, i) => (
                        <motion.div key={i}
                          initial={false}
                          animate={{
                            opacity: lanePhase === 'done' ? 1 : 0.35,
                            scale: lanePhase === 'done' ? 1 : 0.96,
                          }}
                          transition={{ delay: lanePhase === 'done' ? 0.15 + i * 0.12 : 0, duration: 0.3 }}
                          className="flex-1 rounded-xl bg-white ring-1 ring-slate-100 px-2 py-1.5 text-center">
                          <div className={`text-[13px] font-extrabold ${s.ok ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {lanePhase === 'done' ? s.v : '·'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{s.k}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center mb-4">
                {ready ? (
                  <button onClick={runLanes} disabled={lanePhase === 'running'}
                    className="inline-flex items-center gap-2 rounded-full bg-l1-600 text-white text-[12px]
                               font-extrabold px-5 py-2 shadow-sm hover:bg-l1-700 transition-colors
                               disabled:opacity-50">
                    {lanePhase === 'done' ? '↺ Run them again' : '▶ Run both'}
                  </button>
                ) : (
                  <span className="text-[11.5px] text-slate-400">
                    ⏳ Finish the run above — then race the two versions here.
                  </span>
                )}
              </div>

              <AnimatePresence>
                {lanePhase === 'done' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800
                               px-4 py-2.5 text-[12.5px] font-bold text-center mb-4">
                    🏁 Same destination, same quality. Only the dice that pick each step are
                    different — and those dice are what prove it's ours ◈
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ================= ② the repeat test ================= */}
              <div className="border-t border-dashed border-slate-200 pt-4">
                <div className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400 mb-1.5">
                  ② The repeat test — 200 fresh draws, with and without the key
                </div>
                <p className="text-[11.5px] text-slate-500 leading-snug mb-3 max-w-[46rem]">
                  If the watermark got in the agent's way, facing decisions <b>like this one</b> over
                  and over would expose it — the answers would come out with different frequencies.
                  So let's take 200 fresh draws, with and without the key, and count.
                </p>
                <div className="flex gap-3 items-stretch">
                  {/* model's instincts */}
                  <div className="w-[280px] shrink-0 rounded-2xl bg-slate-50 ring-1 ring-slate-100 px-3.5 py-3">
                    <div className="text-[12px] font-extrabold text-slate-700 mb-2">
                      🧠 The choice on the table <span className="font-semibold text-slate-400">(a real step)</span>
                    </div>
                    {cands.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1.5 text-[11px]">
                        <span className="w-[7.5rem] truncate font-semibold text-slate-500" title={c.label}>
                          {['①', '②', '③'][i]} {c.label}
                        </span>
                        <div className="flex-1 h-3 rounded-full bg-slate-200/70 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-l1-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${(c.p / maxP) * 100}%` }}
                            transition={{ duration: 0.6, delay: i * 0.1 }} />
                        </div>
                        <span className="w-8 text-right font-bold text-slate-500">
                          {Math.round(c.p * 100)}%
                        </span>
                      </div>
                    ))}
                    <div className="text-[10.5px] text-slate-400 leading-snug mt-2">
                      How much the model <i>wants</i> each option. Whatever it wants, the watermark
                      must respect — it can only re-roll the dice, never rig them.
                    </div>
                  </div>
                  <div className="self-center text-l1-200 text-[17px] font-extrabold">→</div>

                  {/* the two histograms */}
                  <div className="flex-1 flex gap-3">
                    {([
                      { title: '🚫 Without the watermark', note: `${drawn} of ${DRAWS} draws`, counts: plain, key: false },
                      { title: '🔑 With the watermark', note: `${drawn} of ${DRAWS} draws`, counts: keyed, key: true },
                    ] as const).map((b) => (
                      <div key={b.title} className={[
                        'flex-1 rounded-2xl px-3.5 py-3 ring-[1.5px]',
                        b.key ? 'bg-l1-50/60 ring-l1-200' : 'bg-white ring-slate-200',
                      ].join(' ')}>
                        <div className="text-[12px] font-extrabold text-slate-700">{b.title}</div>
                        <div className="text-[10px] text-slate-400 mb-2">{b.note} — how often each option won</div>
                        <div className="flex items-end gap-2.5 h-[92px] px-1.5">
                          {b.counts.map((n, i) => (
                            <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
                              <motion.div
                                className={`w-full rounded-t-md ${b.key ? 'bg-l1-400' : 'bg-slate-300'}`}
                                initial={false}
                                animate={{ height: barH(n) }}
                                transition={{ duration: 0.12 }} />
                              <span className="text-[10px] font-bold text-slate-400">
                                {drawn ? `${n}×` : ''}
                              </span>
                              <span className="text-[10px] text-slate-300 -mt-0.5">{['①', '②', '③'][i]}</span>
                            </div>
                          ))}
                        </div>
                        {b.key && sampled && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="mt-1.5 text-center text-[11px] font-bold text-emerald-600">
                            ✓ Same shape — same habits
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center mt-3">
                  <button onClick={drawSamples} disabled={drawing}
                    className="inline-flex items-center gap-2 rounded-full bg-l1-600 text-white text-[12px]
                               font-extrabold px-5 py-2 shadow-sm hover:bg-l1-700 transition-colors
                               disabled:opacity-50">
                    {drawing ? `⏳ Draw ${drawn}/${DRAWS}…` : sampled ? `↺ Run 200 fresh draws again` : `▶ Run ${DRAWS} fresh draws`}
                  </button>
                  {drawing && lastPick && (
                    <div className="text-[10.5px] text-slate-400 mt-1.5 truncate max-w-[34rem] mx-auto">
                      draw #{drawn}: 🚫 picked “{lastPick[0]}” · 🔑 picked “{lastPick[1]}”
                    </div>
                  )}
                  {sampled && !drawing && (
                    <div className="text-[10.5px] text-slate-400 mt-1.5">
                      🔑 draws are dealt by the key — replay and they come out identical, every single time.
                    </div>
                  )}
                </div>
              </div>

              {/* takeaway */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-dashed border-slate-200">
                <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-500">
                  <div className="font-extrabold text-slate-700 text-[12px] mb-0.5">🎲 What changes</div>
                  <b>How</b> each step is picked — the key deals the lottery tickets, so we can
                  later prove this run is ours.
                </div>
                <div className="rounded-xl bg-l2-50 ring-1 ring-l2-100 px-3.5 py-2.5 text-[11.5px]
                                leading-relaxed text-l2-700">
                  <div className="font-extrabold text-[12px] mb-0.5">🎯 What doesn't</div>
                  <b>What</b> the agent is capable of — same instincts, same success rate. The only
                  price is a slightly longer log, never the work itself.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
