import { motion } from 'framer-motion'
import ExpRace from './ExpRace'
import type { RaceRow } from '../api'
import { useI18n } from '../i18n'

export interface GroupView {
  i: number
  window?: string
  chosen?: string
  race?: RaceRow[]
  phi?: number | null
  nCandidates?: number
  k?: number
  green?: number[]
  l2hit?: boolean
  roundNum?: number
  observations: { command: string; text: string; confirm: boolean }[]
  thought?: string
  /** HSE only: which permit phase this decision belongs to, and its outcome. */
  phase?: string
  result?: string
}

export default function GroupCard({ g, active, compact = false }:
  { g: GroupView; active: boolean; compact?: boolean }) {
  const { t } = useI18n()
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      className={[
        'card p-2.5 space-y-1.5',
        compact ? 'w-[21rem] shrink-0 h-full overflow-y-auto overflow-x-hidden' : '',
        active ? 'ring-2 ring-l1-400 animate-pulseRing' : 'hover:shadow-lift transition-shadow duration-500 ease-fluid',
      ].join(' ')}
    >
      {/* header: group index + Layer-2 badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{t('group')} · {g.i}</span>
          {g.chosen && (
            <span className="mono text-slate-700 truncate max-w-[11rem]">{g.chosen}</span>
          )}
        </div>
        {g.k != null && (
          <div className="flex items-center gap-1">
            <span className={[
              'chip',
              g.k === 2 ? 'bg-l2-50 text-l2-700 ring-1 ring-violet-200'
                : 'bg-slate-100 text-slate-500',
            ].join(' ')}>
              k = {g.k}
            </span>
            <span className={[
              'chip',
              g.l2hit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600',
            ].join(' ')}>
              Gᶜ = {'{'}{(g.green ?? []).join(',')}{'}'} {g.l2hit ? '✓' : '✗'}
            </span>
          </div>
        )}
      </div>

      {g.thought && (
        <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] leading-relaxed
                        text-slate-600 italic line-clamp-3">
          {g.thought}
        </div>
      )}

      {g.race && g.race.length > 0 && (
        <ExpRace rows={compact ? g.race.slice(0, 5) : g.race}
                 window={g.window ?? ''} phi={g.phi ?? null}
                 nCandidates={g.nCandidates ?? g.race.length} />
      )}

      {/* executed observations; the second one is the Layer-2 confirm */}
      <div className="space-y-1">
        {(compact ? g.observations.slice(0, 2) : g.observations).map((o, idx) => (
          <div key={idx}
            className={[
              'rounded-lg px-2.5 py-1.5 text-[11px]',
              o.confirm
                ? 'border border-dashed border-l2-400 bg-l2-50/60'
                : 'bg-slate-50',
            ].join(' ')}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={[
                'chip',
                o.confirm ? 'bg-l2-100 text-l2-700' : 'bg-slate-200 text-slate-500',
              ].join(' ')}>
                {o.confirm ? t('confirmStep') : t('executed')}
              </span>
              <span className="mono text-slate-600 truncate">{o.command}</span>
            </div>
            <div className={compact ? 'text-slate-500 line-clamp-1' : 'text-slate-500 line-clamp-2'}>{o.text}</div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
