import { motion } from 'framer-motion'
import { ResponsiveContainer, LineChart, Line, YAxis, XAxis, ReferenceLine, Tooltip } from 'recharts'
import type { DetectResult } from '../api'
import { useI18n } from '../i18n'

function Gauge({
  label, sub, z, zWrong, tau, tone, delta,
}: { label: string; sub: string; z: number; zWrong: number; tau: number
     tone: 'l1' | 'l2'; delta?: number | null }) {
  const { t } = useI18n()
  const hit = z > tau
  const c = tone === 'l1'
    ? { fg: 'text-l1-700', bar: 'bg-l1-500', bg: 'bg-l1-50', ring: 'ring-indigo-100' }
    : { fg: 'text-l2-700', bar: 'bg-l2-500', bg: 'bg-l2-50', ring: 'ring-violet-100' }
  // z is unbounded; map to a 0..1 fill with a soft knee at 20
  const fill = Math.max(0, Math.min(1, z / 20))
  const fillW = Math.max(0, Math.min(1, Math.abs(zWrong) / 20))

  return (
    <div className={`rounded-xl ${c.bg} ring-1 ${c.ring} p-2.5`}>
      <div className="flex items-baseline justify-between">
        <div>
          <div className={`text-[10px] font-semibold tracking-wide ${c.fg}`}>{label}</div>
          <div className="text-[9px] text-slate-400">{sub}</div>
        </div>
        <div className="text-right">
          <motion.div
            key={z.toFixed(3)}
            initial={{ scale: 1.18, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className={`text-2xl font-bold tabular-nums leading-none ${c.fg}`}
          >
            {z.toFixed(2)}
          </motion.div>

          {/* What the step just added. The big number above is a LEVEL (no sign);
              this is the increment, so it is the one place a '+' belongs. */}
          {delta != null && Math.abs(delta) > 1e-9 && (
            <motion.div
              key={`d${z.toFixed(3)}`}
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="mt-0.5 flex items-center justify-end gap-1">
              <span className="text-[8px] uppercase tracking-wide text-slate-400">
                {t('thisStep')}
              </span>
              <span className={[
                'mono text-[10px] font-semibold tabular-nums rounded px-1',
                delta > 0 ? (tone === 'l1' ? 'bg-l1-100 text-l1-700'
                                           : 'bg-l2-100 text-l2-700')
                          : 'bg-slate-100 text-slate-400',
              ].join(' ')}>
                {delta > 0 ? '+' : ''}{delta.toFixed(2)}
              </span>
            </motion.div>
          )}

          <span className={[
            'chip mt-1',
            hit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500',
          ].join(' ')}>
            {hit ? `● ${t('detected')}` : `○ ${t('notDetected')}`}
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-12 text-[9px] text-slate-500">{t('rightKey')}</span>
          <div className="flex-1 h-2 rounded-full bg-white ring-1 ring-slate-200 overflow-hidden">
            <motion.div className={`h-full ${c.bar}`}
              animate={{ width: `${fill * 100}%` }} transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-12 text-[9px] text-slate-400">{t('wrongKey')}</span>
          <div className="flex-1 h-2 rounded-full bg-white ring-1 ring-slate-200 overflow-hidden">
            <motion.div className="h-full bg-rose-300"
              animate={{ width: `${fillW * 100}%` }} transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }} />
          </div>
          <span className="w-10 text-right text-[9px] tabular-nums text-rose-400">
            {zWrong.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function DetectPanel({
  d, curve,
}: { d: DetectResult | null; curve: { groups: number; z1: number; z2: number }[] }) {
  const { t } = useI18n()
  if (!d?.layer1 || !d?.layer2) {
    return (
      <div className="card p-3 text-xs text-slate-400">{t('waiting')}</div>
    )
  }
  // defensive: a missing field must not blank the whole dashboard
  const tau = d.tau ?? 2
  const cons = d.consistency ?? { total: 0, mismatch: 0, rate: 0 }
  // Per-step gain, read off the curve the replay is already accumulating. Makes
  // it legible that each completed step ADDS evidence, rather than the number
  // just churning.
  const prev = curve.length > 1 ? curve[curve.length - 2] : null
  const last = curve.length > 0 ? curve[curve.length - 1] : null
  const dz1 = prev && last ? last.z1 - prev.z1 : null
  const dz2 = prev && last ? last.z2 - prev.z2 : null
  return (
    <div className="space-y-2">
      <Gauge label={`z₁ · ${t('selChannel')}`} sub={`${t('selSub')} · n=${d.layer1.n}`}
             z={d.layer1.z} zWrong={d.layer1.z_wrong ?? 0} tau={tau} tone="l1"
             delta={dz1} />
      <Gauge label={`z₂ · ${t('tallyChannel')}`} sub={`${t('tallySub')} · n=${d.layer2.n}`}
             z={d.layer2.z} zWrong={d.layer2.z_wrong ?? 0} tau={tau} tone="l2"
             delta={dz2} />

      {curve.length > 1 && (
        <div className="card p-2">
          <div className="eyebrow mb-1.5">{t('evidence')}</div>
          <div className="h-24">
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <XAxis dataKey="groups" tick={{ fontSize: 9, fill: '#94a3b8' }}
                       axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }}
                       axisLine={false} tickLine={false} />
                <ReferenceLine y={tau} stroke="#f43f5e" strokeDasharray="3 3"
                               label={{ value: 'τ', fontSize: 9, fill: '#f43f5e' }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="z1" stroke="#6366f1" strokeWidth={2}
                      dot={false} name="z₁" />
                <Line type="monotone" dataKey="z2" stroke="#8b5cf6" strokeWidth={2}
                      dot={false} name="z₂" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card p-2 flex items-center justify-between text-[10px]">
        <span className="text-slate-500">{t('audit')}</span>
        <span className={[
          'chip',
          cons.rate > 0.05 ? 'bg-amber-100 text-amber-700'
            : 'bg-emerald-100 text-emerald-700',
        ].join(' ')}>
          {t('auditRate')} {(cons.rate * 100).toFixed(1)}%
          <span className="opacity-60 ml-1">
            ({cons.mismatch}/{cons.total})
          </span>
        </span>
      </div>
    </div>
  )
}
