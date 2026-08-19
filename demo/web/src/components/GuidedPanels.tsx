import { motion } from 'framer-motion'
import { Loader2, ShieldCheck, Lock } from 'lucide-react'
import type { DetectResult } from '../api'

/**
 * Guided-view right column and status banner: plain-language versions of the
 * detection gauges and the attack panel. All technical detail (z-scores,
 * candidate tables, key calibration) stays in the collapsible expert section.
 */

// ---------------------------------------------------------------------------
// status banner
// ---------------------------------------------------------------------------

export function GuidedBanner({
  idle, running, finished, detected, z1, z2, tau, attacked,
}: {
  idle: boolean; running: boolean; finished: boolean; detected: boolean
  z1: number; z2: number; tau: number; attacked: boolean
}) {
  // evidence bar: how far the stronger channel has climbed (soft max at 12)
  const pct = Math.max(0, Math.min(1, Math.max(z1, z2) / 12))

  if (idle) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 px-5 py-3.5 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center text-slate-400 text-lg">◈</div>
        <div>
          <div className="text-[15px] font-extrabold text-slate-700">Ready when you are</div>
          <div className="text-[12px] text-slate-400 mt-0.5">
            Press <b>Start replay</b> — watch the agent work while TRACE hides its mark in every choice.
          </div>
        </div>
      </div>
    )
  }

  if (running || !finished) {
    const strong = z1 > tau || z2 > tau
    return (
      <div className="rounded-2xl bg-gradient-to-r from-l1-50 to-l2-50 ring-[1.5px] ring-l1-200
                      px-5 py-3.5 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-full bg-l1-500 grid place-items-center text-white text-lg shrink-0">
          ◈
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-extrabold text-l1-700">Watermark embedding in progress</div>
          <div className="text-[12px] text-l1-600/80 mt-0.5">
            Every finished step adds evidence.&nbsp;
            <span className="text-slate-400">→ When the run finishes, this banner turns green: “Watermark detected ✓”.</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] font-bold tracking-wider text-l1-500 uppercase">Evidence so far</div>
          <div className="w-36 h-2 mt-1 rounded-full bg-l1-100 overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-l1-400 to-l1-500"
              animate={{ width: `${pct * 100}%` }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }} />
          </div>
          <div className="text-[11px] font-bold text-l1-700 mt-1">
            {strong ? 'Strong · already past the line' : 'Accumulating…'}
          </div>
        </div>
      </div>
    )
  }

  if (detected) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-green-50 ring-[1.5px] ring-emerald-300
                      px-5 py-3.5 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-full bg-emerald-500 grid place-items-center text-white text-lg shrink-0">✓</div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-extrabold text-emerald-800">This record carries our watermark</div>
          <div className="text-[12px] text-emerald-700/90 mt-0.5">
            {attacked
              ? '…even after the log was attacked. With the wrong key, the same check finds nothing.'
              : 'Verified with the correct keys. With a wrong key, the same check finds nothing.'}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] font-bold tracking-wider text-emerald-600 uppercase">Confidence</div>
          <div className="w-36 h-2 mt-1 rounded-full bg-emerald-100 overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
              animate={{ width: `${pct * 100}%` }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }} />
          </div>
          <div className="text-[11px] font-bold text-emerald-700 mt-1">
            {pct > 0.5 ? 'High' : pct > 0.25 ? 'Moderate' : 'Low'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-amber-50 ring-[1.5px] ring-amber-300 px-5 py-3.5 flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-full bg-amber-400 grid place-items-center text-white text-lg shrink-0">✗</div>
      <div>
        <div className="text-[15px] font-extrabold text-amber-800">No watermark verifies in this record</div>
        <div className="text-[12px] text-amber-700/90 mt-0.5">
          Neither channel is past its pass line — this log does not carry our mark (or the wrong key was used).
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// plain-language detection meters
// ---------------------------------------------------------------------------

function Meter({
  name, sub, z, zWrong, tau, tone, running, notePast, noteBuilding,
}: {
  name: string; sub: string; z: number; zWrong: number; tau: number
  tone: 'l1' | 'l2'; running: boolean; notePast: string; noteBuilding: string
}) {
  const hit = z > tau
  const fill = Math.max(0, Math.min(1, z / 12))
  const line = Math.max(0.04, Math.min(0.96, tau / 12))
  const bar = tone === 'l1' ? 'bg-gradient-to-r from-l1-400 to-l1-500' : 'bg-gradient-to-r from-l2-400 to-l2-500'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[12.5px] font-bold text-slate-800">
          {name} <span className="font-normal text-slate-400 text-[11px]">— {sub}</span>
        </div>
        <span className={[
          'text-[10px] font-extrabold px-2 py-0.5 rounded-full',
          hit ? 'bg-emerald-100 text-emerald-700'
            : running ? 'bg-l1-100 text-l1-700'
            : 'bg-slate-100 text-slate-400',
        ].join(' ')}>
          {hit ? '✓ PRESENT' : running ? '◌ BUILDING…' : '○ NOT FOUND'}
        </span>
      </div>
      <div className="relative h-3.5 mt-4 rounded-full bg-slate-100 ring-1 ring-slate-200">
        <motion.div className={`absolute inset-y-0 left-0 rounded-full ${bar}`}
          animate={{ width: `${fill * 100}%` }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }} />
        {/* pass line */}
        <div className="absolute -top-1 -bottom-1 w-[2.5px] rounded bg-rose-500" style={{ left: `${line * 100}%` }}>
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[8.5px] font-bold text-rose-500 whitespace-nowrap">
            pass line
          </span>
        </div>
      </div>
      <div className="mt-1.5 text-[10.5px] text-slate-400">
        {hit ? notePast : running ? noteBuilding : 'Not past the pass line.'}
        {zWrong !== 0 && hit && (
          <span className="text-slate-300"> · wrong key: nothing</span>
        )}
      </div>
    </div>
  )
}

export function GuidedDetect({ d, tau, running }: { d: DetectResult | null; tau: number; running: boolean }) {
  return (
    <div className="card p-4">
      <h3 className="text-[13.5px] font-extrabold text-slate-800">Two independent checks</h3>
      <p className="text-[11px] text-slate-400 leading-snug mt-0.5 mb-4">
        TRACE hides the mark twice, in two different ways. Either one alone is enough to prove origin.
      </p>
      {!d?.layer1 || !d?.layer2 ? (
        <div className="text-[11.5px] text-slate-300 py-3 text-center">
          The checks appear here once the agent starts making decisions.
        </div>
      ) : (
        <div className="space-y-4">
          <Meter name="Choice pattern" sub="how the agent picks actions"
                 z={d.layer1.z} zWrong={d.layer1.z_wrong ?? 0} tau={tau} tone="l1" running={running}
                 notePast="Past the pass line — the choices carry the mark."
                 noteBuilding="Builds up as the agent makes choices." />
          <Meter name="Count pattern" sub="the rhythm of the log's skeleton"
                 z={d.layer2.z} zWrong={d.layer2.z_wrong ?? 0} tau={tau} tone="l2" running={running}
                 notePast="Past the pass line — the log's shape carries the mark."
                 noteBuilding="Accumulates more slowly — it crosses the line as later phases complete." />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// attack challenge card
// ---------------------------------------------------------------------------

const GUIDED_ATTACKS: { kind: string; label: string; needsLLM: boolean }[] = [
  { kind: 'deletion', label: 'Delete part of the log', needsLLM: false },
  { kind: 'strip_redundant', label: 'Surgically strip records', needsLLM: false },
  { kind: 'semantic_rewrite', label: 'Rewrite the wording', needsLLM: true },
]

export function GuidedAttack({
  rate, setRate, busy, locked, live, onAttack, attacked, detected,
}: {
  rate: number; setRate: (v: number) => void; busy: string | null
  locked: boolean; live: boolean; onAttack: (kind: string) => void
  attacked: boolean; detected: boolean
}) {
  return (
    <div className="card p-4 ring-rose-200/70 bg-gradient-to-b from-white to-rose-50/40">
      <h3 className="text-[13.5px] font-extrabold text-rose-700">Try to break it yourself</h3>
      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
        {locked
          ? 'When the run finishes, attack the log — the way someone covering their tracks would — and see if the mark survives.'
          : 'Attack the log the way someone covering their tracks would, then see if the mark survives.'}
      </p>

      <div className="flex items-center gap-2.5 mt-3 mb-2.5">
        <input type="range" min={0} max={0.9} step={0.05} value={rate} disabled={locked}
               onChange={(e) => setRate(parseFloat(e.target.value))}
               className="flex-1 accent-rose-500 disabled:opacity-40" />
        <span className="w-10 text-right text-[13px] font-extrabold text-rose-600 tabular-nums">
          {(rate * 100).toFixed(0)}%
        </span>
      </div>

      {locked ? (
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 ring-1 ring-dashed ring-slate-200 px-3 py-2
                        text-[11.5px] font-semibold text-slate-400">
          <Lock size={12} /> Unlocks when the run finishes — then try to break the mark.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-1.5">
            {GUIDED_ATTACKS.map((a) => {
              const disabled = !!busy || (a.needsLLM && !live)
              return (
                <button key={a.kind} disabled={disabled} onClick={() => onAttack(a.kind)}
                  className={[
                    'rounded-xl px-3 py-1.5 text-[11.5px] font-semibold text-left transition-all',
                    'duration-500 ease-fluid active:scale-[0.98] flex items-center gap-2',
                    disabled ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                      : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100',
                  ].join(' ')}>
                  {busy === a.kind && <Loader2 size={11} className="animate-spin" />}
                  {a.label}
                  {a.needsLLM && !live && <span className="ml-auto text-[9px]">needs live mode</span>}
                </button>
              )
            })}
          </div>
          {attacked && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={[
                'mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold',
                detected ? 'bg-emerald-50 ring-1 ring-emerald-300 text-emerald-800'
                         : 'bg-rose-50 ring-1 ring-rose-300 text-rose-700',
              ].join(' ')}>
              {detected
                ? <><ShieldCheck size={15} /> Still detected. The mark survives.</>
                : <>⚠️ This attack broke through — both checks fell below the line.</>}
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
