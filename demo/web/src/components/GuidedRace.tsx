import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { GroupView } from './GroupCard'
import { humanize } from '../lib/guidedSteps'













const TOP_N = 5

export default function GuidedRace({
  g, prevLabel, scenario, open, onToggle,
}: {
  g: GroupView | null
  prevLabel: string | null
  scenario: string
  open: boolean
  onToggle: () => void
}) {
  const [keyedPreview, setKeyed] = useState(true)
  const construction = scenario === 'hse'
  const keyed = construction || keyedPreview

  const race = g?.race ?? []
  const minScore = race.length ? Math.min(...race.map((r) => r.score || 1e-9)) : 1
  const maxP = race.length ? Math.max(...race.map((r) => r.p)) : 1




  const sampled = useMemo(() => {
    if (construction || !race.length) return null
    const tot = race.reduce((s, r) => s + r.p, 0) || 1
    let u = Math.random() * tot
    for (const r of race) { u -= r.p; if (u <= 0) return r.cmd }
    return race[race.length - 1].cmd
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.i, race.length, construction])



  const rows = useMemo(() => {
    if (keyed) return race.slice(0, TOP_N)
    const sorted = [...race].sort((a, b) => b.p - a.p)
    const top = sorted.slice(0, TOP_N)
    if (sampled && !top.some((r) => r.cmd === sampled)) {
      const hit = sorted.find((r) => r.cmd === sampled)
      if (hit) { top[TOP_N - 1] = hit; top.sort((a, b) => b.p - a.p) }
    }
    return top
  }, [keyed, race, sampled])

  return (
    <div>
      {                       }
      <button onClick={onToggle}
        className={[
          'w-full card px-4 py-2.5 flex items-center gap-2.5 text-left transition-all duration-500 ease-fluid',
          open ? 'ring-2 ring-l1-400' : 'hover:shadow-lift',
        ].join(' ')}>
        <span className="text-[15px]">🎬</span>
        <span className="text-[12.5px] font-bold text-slate-700">
          How is each step chosen? — the keyed lottery, minus the math
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
              {!g || !race.length ? (
                <div className="text-[12px] text-slate-400 text-center py-4">
                  {g?.event_kind === 'injected_action' ? 'This is an injected controller action, not a policy decision. There is no probability draw or watermark score; this row is excluded from detection.'
                    : construction ? 'Replay a recorded policy action to inspect its candidate weights and keyed scores. The workflow above holds both recorded trajectories.' : 'Start a run — once the agent faces its first decision, the race appears here. 🏁'}
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2.5 mb-1">
                    <span className="rounded-lg bg-l1-50 text-l1-700 text-[11px] font-extrabold px-2 py-1">
                      STEP {g.i + 1}
                    </span>
                    <h3 className="text-[15px] font-extrabold text-slate-800">
                      How was this step chosen?
                    </h3>
                  </div>
                  <p className="text-[12px] text-slate-500 mb-3.5">
                    {g.policy_source === 'scenario_policy' && 'Authored scenario weights, not LLM probabilities. '}
                    {construction && race.length === 1 ? 'Only one action is legal here. Layer 1 cannot change this decision.' : 'The key gives each legal candidate a ticket; the lowest −ln(r) / p score wins.'}
                  </p>

                  {                                   }
                  <div className="flex items-stretch gap-0 mb-4">
                    {[
                      { ic: '🧾', t1: '① Candidates line up', t2: `${construction ? 'The environment allows only unfinished checks with satisfied prerequisites' : 'The agent lists every reasonable next action'} — ${g.nCandidates ?? race.length} here.`, key: false },
                      { ic: '🔑', t1: '② The key deals the tickets', t2: 'The same key, context and candidate produce the same ticket. The policy weights p are unchanged.', key: true },
                      { ic: '🏆', t1: '③ The winning ticket runs', t2: 'Divide −ln(r) by the candidate weight p. Execute the candidate with the lowest score.', key: false },
                    ].map((s, i) => (
                      <div key={i} className="contents">
                        {i > 0 && <div className="self-center px-2 text-l1-200 text-[17px] font-extrabold">→</div>}
                        <div className={[
                          'flex-1 rounded-2xl px-3.5 py-2.5 flex gap-2.5 items-center',
                          s.key ? 'bg-l1-50 ring-1 ring-l1-100' : 'bg-slate-50 ring-1 ring-slate-100',
                        ].join(' ')}>
                          <span className="text-[21px] shrink-0">{s.ic}</span>
                          <div>
                            <div className={`text-[12px] font-extrabold ${s.key ? 'text-l1-700' : 'text-slate-800'}`}>{s.t1}</div>
                            <div className="text-[10.5px] text-slate-500 leading-snug mt-0.5">{s.t2}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {             }
                  <div className="flex items-center gap-2 text-[11.5px] bg-slate-50 ring-1 ring-slate-100
                                  rounded-xl px-3.5 py-2 mb-3 flex-wrap">
                    {prevLabel && (
                      <>
                        <span className="text-emerald-600 font-semibold">✓ Just did: {prevLabel}</span>
                        <span className="text-slate-300">→</span>
                      </>
                    )}
                    <span className="font-bold text-slate-700">🤔 What next?</span>
                  </div>

                  {                         }
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="flex rounded-full bg-slate-100 p-0.5">
                      <button onClick={() => setKeyed(true)}
                        className={[
                          'rounded-full px-3 py-1 text-[11px] font-bold transition-all',
                          keyed ? 'bg-white text-l1-700 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                        ].join(' ')}>
                        🔑 with the watermark
                      </button>
                      {!construction && <button onClick={() => setKeyed(false)}
                        className={[
                          'rounded-full px-3 py-1 text-[11px] font-bold transition-all',
                          !keyed ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                        ].join(' ')}>
                        🚫 without it
                      </button>}
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                      {keyed ? construction ? 'Recorded keyed draw' : '🎟️ tickets dealt by the key' : 'Illustrative resample · not a recorded baseline step'}
                    </span>
                  </div>

                  {              }
                  <div className="space-y-2">
                    {rows.map((r, idx) => {
                      const win = keyed ? r.win : r.cmd === sampled
                      const bar = keyed
                        ? Math.max(0.06, Math.min(1, minScore / (r.score || 1e-9)))
                        : Math.max(0.06, maxP ? r.p / maxP : 0)
                      const label = humanize(r.cmd, scenario).label
                      return (
                        <div key={`${keyed}-${idx}`} className={[
                          'flex items-center gap-3 px-3 py-1.5 rounded-xl',
                          win
                            ? keyed ? 'bg-l1-50 ring-[1.5px] ring-l1-200' : 'bg-slate-100 ring-[1.5px] ring-slate-300'
                            : 'bg-slate-50/60 ring-1 ring-slate-100',
                        ].join(' ')}>
                          <span className={[
                            'w-[17rem] shrink-0 text-[12.5px] flex items-center gap-1.5 truncate',
                            win ? 'font-bold text-slate-800' : 'text-slate-400',
                          ].join(' ')} title={label}>
                            {win && keyed && (
                              <span className="w-5 h-5 rounded-full border-2 border-l1-500 text-l1-600
                                               text-[9px] font-extrabold grid place-items-center shrink-0">◈</span>
                            )}
                            {label}
                          </span>
                          {                     }
                          {keyed ? (
                            <span className={[
                              'shrink-0 w-[4.6rem] text-center mono text-[10.5px] px-1.5 py-0.5 rounded-md',
                              'border border-dashed bg-white',
                              win ? 'border-l1-400 text-l1-700 font-bold' : 'border-slate-300 text-slate-400',
                            ].join(' ')}>
                              🎟️ {r.r.toFixed(2)}
                            </span>
                          ) : (
                            <span className="shrink-0 w-[4.6rem] text-center text-[10.5px] text-slate-300">—</span>
                          )}
                          <div className="flex-1 h-3.5 rounded-full bg-slate-100 overflow-hidden">
                            <motion.div
                              key={`${keyed}-${g.i}-${idx}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${bar * 100}%` }}
                              transition={{ duration: 0.7, delay: idx * 0.08, ease: [0.32, 0.72, 0, 1] }}
                              className={[
                                'h-full rounded-full',
                                win
                                  ? keyed ? 'bg-gradient-to-r from-l1-400 to-l1-500' : 'bg-slate-400'
                                  : 'bg-slate-200',
                              ].join(' ')} />
                          </div>
                          <span className={[
                            'shrink-0 text-[10.5px] font-extrabold w-[5.5rem] text-right',
                            win ? (keyed ? 'text-l1-700' : 'text-slate-500') : 'text-slate-300',
                          ].join(' ')}>
                            {win ? (keyed ? '🏆 picked' : '🎲 sampled') : idx === 1 ? 'close one' : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="text-center text-[10.5px] text-slate-400 mt-3">
                    {(g.nCandidates ?? race.length) > TOP_N &&
                      `${g.nCandidates ?? race.length} candidates in total · showing the top ${TOP_N} · `}
                    full numbers live in Technical details below
                  </div>

                  {              }
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-dashed border-slate-200">
                    <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-500">
                      <div className="font-extrabold text-slate-700 text-[12px] mb-0.5">👀 To an outsider</div>
                      {construction ? 'The environment keeps both runs in the same logical stages. Compare their actual actions and final reports in the workflow above.' : 'Just a reasonable choice — the tickets look like ordinary luck, and the work goes on.'}
                    </div>
                    <div className="rounded-xl bg-l2-50 ring-1 ring-l2-100 px-3.5 py-2.5 text-[11.5px]
                                    leading-relaxed text-l2-700">
                      <div className="font-extrabold text-[12px] mb-0.5">🔑 To the key holder</div>
                      Recompute the keyed pattern from the recorded actions. Detection provides statistical evidence of origin, not proof that the report is factually correct.
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
