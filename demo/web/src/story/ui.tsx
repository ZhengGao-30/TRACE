import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'

/** Shared shell for the two story pages, matching the project deck's language. */

export function PageShell({ title, subtitle, children, right }: {
  title: string; subtitle: string; children: ReactNode; right?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50/60 px-4 py-6">
      <div className="max-w-[1500px] mx-auto">
        <div className="relative rounded-2xl bg-white ring-1 ring-slate-900/[0.05]
                        shadow-sm px-6 pt-7 pb-5 text-center">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5
                            ring-1 ring-slate-900/[0.06] shadow-sm">
              <ShieldCheck size={14} className="text-l1-600" />
              <span className="text-[14px] font-bold tracking-wide text-slate-800">TRACE</span>
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[36px] font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-1.5 text-[16px] text-slate-500">{subtitle}</p>
          {right && <div className="mt-3 flex justify-center">{right}</div>}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}

/** A numbered question the page then answers with exactly one visual. */
export function Ask({ n, q, a, tone = 'indigo', children }: {
  n: number; q: string; a: string
  tone?: 'indigo' | 'rose' | 'emerald' | 'amber'
  children: ReactNode
}) {
  const c = { indigo: 'text-l1-700', rose: 'text-rose-600',
              emerald: 'text-emerald-700', amber: 'text-amber-700' }[tone]
  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-2.5">
        <span className="grid place-items-center w-6 h-6 rounded-full bg-slate-900
                         text-white text-[12.5px] font-bold shrink-0">{n}</span>
        <h2 className="text-[19px] font-extrabold tracking-tight text-slate-900">{q}</h2>
        <span className={`text-[16px] font-extrabold ${c}`}>{a}</span>
      </div>
      {children}
    </section>
  )
}

export function Panel({ n, tone, title, children, badge }: {
  n: number; tone: 'indigo' | 'rose' | 'emerald' | 'amber'
  title: string; children: ReactNode; badge?: ReactNode
}) {
  const c = {
    indigo: 'bg-l1-600', rose: 'bg-rose-500',
    emerald: 'bg-emerald-500', amber: 'bg-amber-500',
  }[tone]
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-900/[0.06] shadow-sm p-4 min-w-0">
      <div className="flex items-center gap-3.5 mb-3.5">
        <span className={`grid place-items-center w-7 h-7 rounded-full ${c}
                          text-white text-[16px] font-bold shrink-0`}>{n}</span>
        <h2 className="text-[19px] font-bold text-slate-800 truncate">{title}</h2>
        {badge && <span className="ml-auto shrink-0">{badge}</span>}
      </div>
      {children}
    </div>
  )
}

export function StatusPill({ kind, label }: {
  kind: 'ok' | 'deleted' | 'rewritten' | 'muted'; label: string
}) {
  const c = {
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    deleted: 'bg-rose-50 text-rose-600 ring-rose-200',
    rewritten: 'bg-amber-50 text-amber-700 ring-amber-200',
    muted: 'bg-slate-50 text-slate-400 ring-slate-200',
  }[kind]
  const dot = {
    ok: '✓', deleted: '✕', rewritten: '↻', muted: '·',
  }[kind]
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2
                      text-[12.5px] font-semibold ring-1 whitespace-nowrap ${c}`}>
      <span className="text-[12.5px]">{dot}</span>{label}
    </span>
  )
}

/** One row of a trajectory: icon rail, index, label, status. */
export function StepRow({ idx, icon, label, sub, status, state, showRail }: {
  idx: number; icon: ReactNode; label: string; sub?: string
  status: ReactNode; state: 'ok' | 'deleted' | 'rewritten'
  showRail: boolean
}) {
  const dead = state === 'deleted'
  return (
    <div className="relative flex items-center gap-3.5 py-1.5">
      {showRail && (
        <span className="absolute left-[15px] top-0 bottom-0 w-px bg-slate-200 -z-0" />
      )}
      <span className={[
        'relative z-10 grid place-items-center w-[31px] h-[31px] rounded-lg shrink-0 ring-1',
        dead ? 'bg-rose-50/60 ring-rose-100 text-rose-300'
          : state === 'rewritten' ? 'bg-amber-50 ring-amber-200 text-amber-600'
            : 'bg-l1-50 ring-l1-100 text-l1-600',
      ].join(' ')}>
        {icon}
      </span>
      <span className={[
        'w-6 text-center text-[14px] font-semibold tabular-nums shrink-0',
        dead ? 'text-slate-300' : 'text-slate-400',
      ].join(' ')}>{idx}</span>
      <div className="min-w-0 flex-1">
        <div className={[
          'text-[14px] leading-tight truncate',
          dead ? 'text-slate-300 line-through' : 'text-slate-700',
        ].join(' ')}>{label}</div>
        {sub && (
          <div className={[
            'text-[12.5px] leading-tight truncate mt-[1px]',
            dead ? 'text-slate-300' : 'text-slate-400',
          ].join(' ')}>{sub}</div>
        )}
      </div>
      <span className="shrink-0">{status}</span>
    </div>
  )
}

/**
 * One fingerprint's verdict.
 *
 * Earlier versions led with the z-score and wrapped charts around it. A z-score
 * is not something a first-time viewer can feel, and no amount of decoration
 * fixes that -- the question they actually have is "can you still tell who wrote
 * this?", which has a yes/no answer. So the answer leads, in plain words, and
 * the statistic is small print underneath.
 */
export function FingerprintCard({ tone, label, what, readable, verdictWord,
                                  reason, z, zClean, tau }: {
  tone: 'l1' | 'l2'
  /** short name a non-specialist can hold onto */
  label: string
  /** what this fingerprint is made of, in plain words */
  what: string
  readable: boolean
  /** the word for the broken state, e.g. "SMUDGED" */
  verdictWord: string
  /** why it survived or why it did not */
  reason: string
  z: number; zClean: number; tau: number
}) {
  const accent = tone === 'l1' ? 'text-l1-700' : 'text-l2-700'
  return (
    <div className={[
      'rounded-xl p-3.5 ring-1',
      readable ? 'bg-emerald-50/70 ring-emerald-200' : 'bg-rose-50/60 ring-rose-200',
    ].join(' ')}>
      <div className="flex items-start gap-3">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className={[
            'grid place-items-center w-11 h-11 rounded-full shrink-0 text-white',
            'text-[24px] font-bold leading-none',
            readable ? 'bg-emerald-500' : 'bg-rose-500',
          ].join(' ')}>
          {readable ? '✓' : '✕'}
        </motion.span>
        <div className="min-w-0 flex-1">
          <div className={[
            'text-[19px] font-extrabold tracking-tight leading-none',
            readable ? 'text-emerald-700' : 'text-rose-600',
          ].join(' ')}>
            {readable ? 'STILL READABLE' : verdictWord}
          </div>
          <div className={`text-[14px] font-semibold mt-1 ${accent}`}>{label}</div>
          <div className="text-[14px] text-slate-500 leading-snug mt-0.5">{what}</div>
        </div>
      </div>
      <div className="mt-2.5 pt-2.5 border-t border-slate-900/[0.06]">
        <div className="text-[14px] leading-snug text-slate-600">{reason}</div>
        <div className="mono text-[12.5px] text-slate-400 tabular-nums mt-1.5">
          score {zClean.toFixed(1)} → {z.toFixed(1)} · needs {tau.toFixed(1)} to read
        </div>
      </div>
    </div>
  )
}

export function Banner({ tone, title, sub }: {
  tone: 'indigo' | 'emerald' | 'slate'; title: string; sub: string
}) {
  const ring = {
    indigo: 'ring-l1-200 bg-l1-50/50', emerald: 'ring-emerald-200 bg-emerald-50/50',
    slate: 'ring-slate-200 bg-white',
  }[tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className={`rounded-2xl ring-1 shadow-sm px-6 py-5 flex items-center gap-4 ${ring}`}>
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-white
                       ring-1 ring-slate-900/[0.06] shrink-0">
        <ShieldCheck size={20} className="text-l1-600" />
      </span>
      <div className="min-w-0">
        <div className="text-[24px] sm:text-[30px] font-extrabold tracking-tight text-slate-900 leading-tight">
          {title}
        </div>
        <div className="text-[14px] text-slate-500 mt-1">{sub}</div>
      </div>
    </motion.div>
  )
}
