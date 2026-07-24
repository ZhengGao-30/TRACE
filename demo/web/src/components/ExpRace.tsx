import { motion } from 'framer-motion'
import type { RaceRow } from '../api'
import { useI18n } from '../i18n'

/**
 * Layer 1 (EXP / Gumbel-argmax) made visible.
 *
 *   r[b] = DRBG( SHA256("<window>::key1=<key1>"), nonce = b ).uniform()
 *   chosen = argmin_b  (-log r[b]) / p[b]
 *
 * So the LLM supplies p[b] and the secret key supplies r[b]; only both together
 * decide the action. Lower score wins -- shown as a race with the shortest bar first.
 */
export default function ExpRace({
  rows, window: win, phi, nCandidates,
}: { rows: RaceRow[]; window: string; phi: number | null; nCandidates: number }) {
  const { t } = useI18n()
  if (!rows?.length) return null
  const max = Math.max(...rows.map((r) => Math.min(r.score, 40)), 1)

  return (
    <div className="rounded-xl bg-l1-50/70 ring-1 ring-indigo-100 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="eyebrow text-l1-700 bg-l1-500/[0.08]">{t('raceTitle')}</span>
        <span className="text-[10px] text-slate-400">
          {t('raceCands', { n: nCandidates, k: rows.length })}
        </span>
      </div>

      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={r.cmd} className="flex items-center gap-2">
            <span className={`w-4 text-center text-[10px] ${r.win ? '' : 'text-slate-300'}`}>
              {r.win ? '🏆' : i + 1}
            </span>
            <span className={[
              'w-40 truncate text-[11px]',
              r.win ? 'font-semibold text-l1-700' : 'text-slate-500',
            ].join(' ')}>{r.cmd}</span>

            {/* p[b] : what the LLM wanted */}
            <div className="w-16 h-3 rounded bg-white ring-1 ring-slate-200 overflow-hidden">
              <motion.div className="h-full bg-slate-300"
                initial={{ width: 0 }} animate={{ width: `${Math.min(r.p * 100, 100)}%` }} />
            </div>
            <span className="w-9 text-[9px] text-slate-400 tabular-nums">
              {r.p.toFixed(3)}
            </span>

            {/* r[b] : what the key rolled */}
            <div className="relative w-14 h-3 rounded bg-white ring-1 ring-slate-200">
              <motion.span className="absolute top-1/2 -translate-y-1/2 w-1.5 h-2.5 rounded-sm bg-violet-400"
                initial={{ left: 0 }} animate={{ left: `${r.r * 100}%` }} />
            </div>
            <span className="w-9 text-[9px] text-violet-400 tabular-nums">
              {r.r.toFixed(3)}
            </span>

            {/* score : lower wins */}
            <div className="flex-1 h-3 rounded bg-white ring-1 ring-slate-200 overflow-hidden">
              <motion.div
                className={r.win ? 'h-full bg-l1-500' : 'h-full bg-indigo-200'}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(3, (Math.min(r.score, 40) / max) * 100)}%` }}
                transition={{ duration: 0.35 }}
              />
            </div>
            <span className={[
              'w-12 text-right text-[9px] tabular-nums',
              r.win ? 'text-l1-700 font-semibold' : 'text-slate-400',
            ].join(' ')}>{r.score < 100 ? r.score.toFixed(2) : '∞'}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-400">
        <span className="inline-block w-2 h-2 rounded-sm bg-slate-300" />{t('legendP')}
        <span className="inline-block w-2 h-2 rounded-sm bg-violet-400 ml-1" />{t('legendR')}
        <span className="inline-block w-2 h-2 rounded-sm bg-l1-500 ml-1" />{t('legendScore')}
      </div>

      <div className="mt-1.5 rounded-lg bg-white/70 px-2 py-1 mono text-slate-500 truncate">
        window = <span className="text-l1-700">{win === 'TWO_LAYER_WM_LAYER1_BOOTSTRAP' ? '⟨bootstrap⟩' : win}</span>
        {phi != null && (
          <> · φ = −log(1−r) = <span className="text-l1-700 font-semibold">{phi.toFixed(3)}</span></>
        )}
      </div>
    </div>
  )
}
