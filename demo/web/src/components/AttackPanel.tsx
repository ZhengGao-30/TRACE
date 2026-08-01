import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import type { MatrixRow } from '../api'
import { useI18n } from '../i18n'

const ATTACKS = ['deletion', 'strip_redundant', 'semantic_rewrite',
                 'llm_substitute', 'combined'] as const

function Cell({ z, tau }: { z: number; tau: number }) {
  const alive = z > tau
  return (
    <div className={[
      'flex items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold tabular-nums',
      alive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
        : 'bg-rose-50 text-rose-600 ring-1 ring-rose-200',
    ].join(' ')}>
      {alive ? '✓' : '✗'} {z.toFixed(2)}
    </div>
  )
}

export default function AttackPanel({
  attacks, rate, setRate, onAttack, onMatrix, rows, busy, tau, live,
}: {
  attacks: string[]; rate: number; setRate: (v: number) => void
  onAttack: (kind: string) => void; onMatrix: () => void
  rows: MatrixRow[]; busy: string | null; tau: number; live: boolean
}) {
  const { t } = useI18n()
  const [hover, setHover] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <div className="card p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="eyebrow">{t('attackStrength')}</span>
          <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
            {(rate * 100).toFixed(0)}%
          </span>
        </div>
        <input type="range" min={0} max={0.9} step={0.05} value={rate}
               onChange={(e) => setRate(parseFloat(e.target.value))}
               className="w-full accent-rose-500" />

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {ATTACKS.map((k) => {
            const needsLLM = ['semantic_rewrite', 'llm_substitute', 'combined'].includes(k)
            const disabled = needsLLM && !live
            return (
              <button key={k} disabled={disabled || !!busy}
                onClick={() => onAttack(k)}
                onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}
                className={[
                  'relative rounded-xl px-2 py-1.5 text-[11px] font-medium text-left',
                  'transition-all duration-500 ease-fluid active:scale-[0.97]',
                  disabled ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                    : busy === k ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-700',
                ].join(' ')}>
                <span className="flex items-center gap-1">
                  {busy === k && <Loader2 size={11} className="animate-spin" />}
                  {t(`atk_${k}` as any)}
                  {needsLLM && <span className="text-[8px] opacity-60">LLM</span>}
                </span>
              </button>
            )
          })}
        </div>
        {hover && (
          <div className="mt-1.5 text-[10px] text-slate-400">{t(`atk_${hover}_h` as any)}</div>
        )}
        <button onClick={onMatrix} disabled={!!busy}
          className="mt-2 w-full rounded-full bg-slate-900 text-white text-[11px] font-semibold
                     py-2 transition-all duration-500 ease-fluid hover:bg-slate-800
                     active:scale-[0.98] disabled:opacity-50">
          {busy === '__matrix' ? t('runningMatrix') : t('runMatrix')}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="card p-2.5">
          <div className="eyebrow mb-2">{t('matrixTitle')}</div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 items-center">
            <span />
            <span className="text-[9px] text-l1-700 font-semibold text-center px-1">{t('colSel')}</span>
            <span className="text-[9px] text-l2-700 font-semibold text-center px-1">{t('colTally')}</span>
            <span className="text-[9px] text-slate-400 text-center px-1">{t('colAudit')}</span>
            {rows.map((r) => (
              <motion.div key={r.attack} className="contents"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <span className="text-[10px] text-slate-600 truncate pr-1">
                  {t(`atk_${r.attack}` as any)}
                </span>
                <Cell z={r.z1} tau={tau} />
                <Cell z={r.z2} tau={tau} />
                <span className={[
                  'text-[10px] text-center tabular-nums',
                  r.inconsistency > 0.05 ? 'text-amber-600 font-semibold' : 'text-slate-400',
                ].join(' ')}>
                  {(r.inconsistency * 100).toFixed(0)}%
                </span>
              </motion.div>
            ))}
          </div>
          <div className="mt-2 text-[9px] text-slate-400 leading-relaxed">
            {t('matrixNote')}
          </div>
        </div>
      )}
    </div>
  )
}
