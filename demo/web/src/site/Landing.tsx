import { useState, useRef } from 'react'
import { motion, useSpring, useMotionValue } from 'framer-motion'
import type { ReactNode } from 'react'
import {
  ArrowRight, ArrowUpRight, FileText, PlayCircle, Check,
  HardHat, ClipboardList, Wind, ShieldCheck, Wrench, Cpu, ExternalLink, AlertTriangle,
  Menu, X,
} from 'lucide-react'
import { navigate } from '../Router'
import Logo from '../components/Logo'
import { SITE, BIBTEX } from './content'
import { asset } from '../lib/asset'

const EASE = [0.32, 0.72, 0, 1] as const

function Reveal({ children, delay = 0, className = '' }:
  { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={className}>
      {children}
    </motion.div>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-l1-500/[0.08]
                    px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-l1-700">
      <span className="w-1 h-1 rounded-full bg-l1-500" />{children}
    </div>
  )
}

function Section({ id, children, className = '' }:
  { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 px-5 sm:px-8 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

/** A card that pops on hover: the general interactivity layer. */
function Pop({ children, className = '', delay = 0 }:
  { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <motion.div
        whileHover={{ y: -4, scale: 1.015 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        className={`h-full ${className}`}>
        {children}
      </motion.div>
    </Reveal>
  )
}

function Head({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <>
      <Reveal><Eyebrow>{eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="mt-4 font-display font-extrabold tracking-[-0.02em] text-slate-900
                       text-[28px] sm:text-[36px] leading-tight max-w-3xl">{title}</h2>
      </Reveal>
      {lede && <Reveal delay={0.1}>
        <p className="mt-4 text-[16px] leading-[1.7] text-slate-600 max-w-3xl">{lede}</p>
      </Reveal>}
    </>
  )
}

const DOMAIN_ICONS = [ClipboardList, ShieldCheck, Wind, HardHat, Wrench, Cpu]

export default function Landing() {
  // Copy is English-only; L() stays so the call sites below read unchanged.
  const L = (s: string) => s
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const nav = [
    ['#hse', SITE.nav.hse], ['#scenarios', SITE.nav.scenarios],
    ['#how', SITE.nav.how], ['#guarantees', SITE.nav.guarantees],
    ['#results', SITE.nav.results], ['#team', SITE.nav.team],
  ] as const

  return (
    <div className="min-h-screen font-sans text-slate-800 overflow-x-hidden">
      {/* ---------------- nav ---------------- */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 ring-1 ring-slate-900/[0.05]">
        <div className="mx-auto max-w-6xl h-14 px-5 sm:px-8 flex items-center gap-3">
          <a href="#/" className="flex items-center gap-2.5 shrink-0">
            <div className="bezel p-1"><div className="bezel-core grid place-items-center
                 w-8 h-8 bg-gradient-to-br from-l1-50 to-white"><Logo size={22} /></div></div>
            <span className="font-display font-extrabold text-[15px] tracking-[-0.02em] text-l1-500">TRACE</span>
          </a>
          <nav className="hidden md:flex items-center gap-1 ml-4 text-[13px] text-slate-500">
            {nav.map(([href, label]) => (
              <a key={href} href={href}
                 className="px-3 py-1.5 rounded-full hover:text-slate-900 hover:bg-slate-900/[0.04] transition-colors">
                {L(label)}</a>
            ))}
          </nav>
          <div className="flex-1" />
          <button onClick={() => navigate('/demo')}
            className="group flex items-center gap-1.5 rounded-full bg-l1-500 text-white
                       pl-3.5 pr-1.5 py-1.5 text-[12px] font-semibold
                       shadow-[0_8px_20px_-8px_rgba(99,102,241,.6)] hover:bg-l1-700
                       active:scale-[0.98] transition-all duration-500 ease-fluid">
            <span className="hidden xs:inline sm:inline">{L(SITE.nav.demo)}</span>
            <span className="grid place-items-center w-6 h-6 rounded-full bg-white/15
                             group-hover:translate-x-0.5 transition-transform duration-500 ease-fluid">
              <ArrowRight size={12} />
            </span>
          </button>
          {/* mobile menu toggle */}
          <button onClick={() => setMenuOpen((v) => !v)} aria-label={L(SITE.nav.hse)}
            className="md:hidden grid place-items-center w-9 h-9 rounded-full
                       bg-slate-100/80 ring-1 ring-slate-900/[0.04] text-slate-600">
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* mobile dropdown */}
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-slate-900/[0.06] bg-white/95 backdrop-blur-xl
                       px-5 py-3 flex flex-col gap-1">
            {nav.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}
                 className="px-3 py-2.5 rounded-xl text-[14px] font-medium text-slate-600
                            hover:bg-slate-900/[0.04]">{L(label)}</a>
            ))}
          </motion.nav>
        )}
      </header>

      {/* ---------------- hero ---------------- */}
      <Section className="pt-14 sm:pt-20 pb-16">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <Reveal><Eyebrow>{L(SITE.hero.eyebrow)}</Eyebrow></Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-5 font-display font-extrabold tracking-[-0.03em] text-slate-900
                             text-[36px] sm:text-[50px] leading-[1.06]">
                {L(SITE.hero.title1)}<br />
                <span className="bg-gradient-to-r from-l1-500 via-l2-500 to-l1-400
                                 bg-clip-text text-transparent">
                  {L(SITE.hero.title2)}
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 text-[16px] sm:text-[17px] leading-[1.7] text-slate-600 max-w-2xl">
                {L(SITE.hero.lede)}
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button onClick={() => navigate('/demo')}
                  className="group flex items-center gap-2 rounded-full bg-l1-500 text-white
                             pl-5 pr-2 py-2.5 text-[14px] font-semibold
                             shadow-[0_12px_28px_-10px_rgba(99,102,241,.7)] hover:bg-l1-700
                             active:scale-[0.98] transition-all duration-500 ease-fluid">
                  <PlayCircle size={17} />{L(SITE.hero.ctaDemo)}
                  <span className="grid place-items-center w-7 h-7 rounded-full bg-white/15
                                   group-hover:translate-x-0.5 transition-transform duration-500 ease-fluid">
                    <ArrowRight size={14} />
                  </span>
                </button>
                <a href="https://arxiv.org/abs/2607.08400" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-full bg-white ring-1 ring-slate-900/[0.08]
                             px-5 py-2.5 text-[14px] font-semibold text-slate-700 hover:shadow-lift
                             active:scale-[0.98] transition-all duration-500 ease-fluid">
                  <FileText size={16} />{L(SITE.hero.ctaPaper)}
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.2}><p className="mt-7 text-[13px] text-slate-400">{L(SITE.hero.tagline)}</p></Reveal>
          </div>
          <Reveal delay={0.1}><HeroMascot /></Reveal>
        </div>
      </Section>

      {/* ---------------- why HSE (domains) ---------------- */}
      <Section id="hse" className="py-16">
        <Head eyebrow={L(SITE.domains.eyebrow)} title={L(SITE.domains.title)} lede={L(SITE.domains.lede)} />
        <div className="mt-9 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SITE.domains.items.map((d, i) => {
            const Icon = DOMAIN_ICONS[i]
            return (
              <Pop key={i} delay={0.04 * i}>
                <div className="card p-4 flex items-center gap-3 h-full">
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-l1-500/[0.1] text-l1-700 shrink-0">
                    <Icon size={17} />
                  </span>
                  <span className="text-[14px] font-semibold text-slate-800">{L(d)}</span>
                </div>
              </Pop>
            )
          })}
        </div>
        <Reveal><p className="mt-6 text-[13px] text-slate-400 max-w-3xl">{L(SITE.domains.audience)}</p></Reveal>
      </Section>

      {/* ---------------- problem (agent -> decision) ---------------- */}
      <Section className="py-16">
        <Head eyebrow={L(SITE.problem.eyebrow)} title={L(SITE.problem.title)} lede={L(SITE.problem.lede)} />
        <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SITE.problem.rows.map((r, i) => (
            <Reveal key={i} delay={0.04 * i}>
              <motion.div
                whileHover="hover"
                className="group relative h-44 rounded-2xl overflow-hidden ring-1
                           ring-slate-900/[0.06] shadow-card cursor-default">
                <motion.img src={asset(`paper/agents/${r.img}.jpg`)} alt={L(r.a)}
                  variants={{ hover: { scale: 1.07 } }}
                  transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                  className="absolute inset-0 w-full h-full object-cover" />
                {/* legibility gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85
                                via-slate-950/25 to-slate-950/10" />
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <div className="font-display font-bold text-[16px] text-white
                                  drop-shadow-sm">{L(r.a)}</div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 self-start rounded-full
                                  bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[11px]
                                  font-semibold text-white ring-1 ring-white/20">
                    <ArrowRight size={11} />{L(r.d)}
                  </div>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------- scenarios (two channels + infographics) ---------------- */}
      <Section id="scenarios" className="py-16">
        <Head eyebrow={L(SITE.scenarios.eyebrow)} title={L(SITE.scenarios.title)} lede={L(SITE.scenarios.lede)} />
        <ChannelBlock s={SITE.scenarios.sel} tone="l1" L={L}
          img={asset("paper/scenario1_selection.png")} />
        <ChannelBlock s={SITE.scenarios.tally} tone="l2" flip L={L}
          img={asset("paper/scenario2_tally.png")} />
      </Section>

      {/* ---------------- why it's hard (insight) ---------------- */}
      <Section id="how" className="py-16">
        <Head eyebrow={L(SITE.insight.eyebrow)} title={L(SITE.insight.title)} lede={L(SITE.insight.lede)} />
        <div className="mt-9 grid md:grid-cols-2 gap-4">
          {SITE.insight.cols.map((c, i) => (
            <Reveal key={i} delay={0.06 * i}>
              <div className={`h-full rounded-2xl p-6 ring-1 ${i === 0
                ? 'bg-rose-50/60 ring-rose-200/60' : 'bg-amber-50/60 ring-amber-200/60'}`}>
                <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${i === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                  {L(c.tag)}
                </div>
                <p className="mt-3 text-[14.5px] leading-[1.65] text-slate-700">{L(c.body)}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1}>
          <div className="mt-4 bezel shadow-card">
            <div className="bezel-core p-6 sm:p-7">
              <p className="text-[15.5px] leading-[1.7] text-slate-700 font-medium max-w-3xl">
                {L(SITE.insight.resolve)}
              </p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* pipeline */}
      <Section className="pb-16">
        <div className="mt-14">
          <Head eyebrow={L(SITE.pipeline.eyebrow)} title={L(SITE.pipeline.title)} />
          <div className="mt-9 grid md:grid-cols-3 gap-4">
            {SITE.pipeline.steps.map((s, i) => (
              <Pop key={i} delay={0.06 * i}>
                <div className="h-full card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid place-items-center w-9 h-9 rounded-xl bg-l1-500 text-white
                                     font-display font-bold text-[15px]">{s.n}</span>
                    <span className="font-display font-bold text-[18px] text-slate-900">{L(s.k)}</span>
                  </div>
                  <p className="mt-3 text-[14px] leading-[1.65] text-slate-600">{L(s.body)}</p>
                </div>
              </Pop>
            ))}
          </div>
          <Reveal><p className="mt-5 text-[13px] text-slate-400 max-w-3xl">{L(SITE.pipeline.note)}</p></Reveal>
        </div>
      </Section>

      {/* ---------------- guarantees ---------------- */}
      <Section id="guarantees" className="py-16">
        <Head eyebrow={L(SITE.guarantees.eyebrow)} title={L(SITE.guarantees.title)} />
        <div className="mt-9 grid sm:grid-cols-2 gap-4">
          {SITE.guarantees.cards.map((c, i) => (
            <Pop key={i} delay={0.05 * i}>
              <div className="h-full card p-6">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  <div className="font-display font-bold text-[18px] text-slate-900">{L(c.title)}</div>
                </div>
                <p className="mt-2.5 text-[14px] leading-[1.65] text-slate-600">{L(c.body)}</p>
              </div>
            </Pop>
          ))}
        </div>
      </Section>

      {/* ---------------- results ---------------- */}
      <Section id="results" className="py-16">
        <Head eyebrow={L(SITE.results.eyebrow)} title={L(SITE.results.title)} lede={L(SITE.results.lede)} />
        <div className="mt-9 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SITE.results.stats.map((s, i) => (
            <Pop key={i} delay={0.05 * i}>
              <div className="card p-5 h-full">
                <div className="font-display font-extrabold text-[30px] leading-none
                                bg-gradient-to-br from-l1-500 to-l2-500 bg-clip-text text-transparent">
                  {s.v}
                </div>
                <div className="mt-2.5 text-[12.5px] leading-[1.5] text-slate-500">{L(s.k)}</div>
              </div>
            </Pop>
          ))}
        </div>
        <div className="mt-9 grid lg:grid-cols-2 gap-5 items-stretch">
          <ResultFigure title={L(SITE.results.utilityTitle)} img={asset("paper/results_sr.png")}
            caption={L(SITE.results.utilityCaption)} />
          <Reveal delay={0.08}>
            <div className="h-full flex flex-col">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-l1-700 mb-2.5">
                {L(SITE.results.robustTitle)}
              </div>
              <div className="bezel shadow-card">
                <div className="bezel-core p-3 grid place-items-center overflow-x-auto">
                  <img src={asset("paper/robustness.png")} alt="robustness" className="w-full rounded-lg" loading="lazy" />
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-[1.55] text-slate-400">
                {L(SITE.results.robustCaption)}
              </p>
              {/* takeaways fill the column to match the tall SR table */}
              <div className="mt-4 space-y-2.5 flex-1">
                {SITE.results.takeaways.map((tk, i) => (
                  <div key={i} className="flex items-start gap-3 card p-3.5">
                    <span className="mt-0.5 grid place-items-center w-6 h-6 rounded-lg
                                     bg-l1-500/[0.1] text-l1-700 shrink-0">
                      <ShieldCheck size={13} />
                    </span>
                    <div>
                      <span className="text-[13px] font-bold text-slate-800">{L(tk.k)}</span>
                      <span className="text-[13px] text-slate-500">: {L(tk.v)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ---------------- CTA ---------------- */}
      <Section className="py-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 text-white
                          px-7 sm:px-12 py-12 shadow-lift">
            <div className="absolute -right-16 -top-20 w-80 h-80 rounded-full bg-l1-500/30 blur-3xl" />
            <div className="absolute -left-20 -bottom-24 w-80 h-80 rounded-full bg-l2-500/25 blur-3xl" />
            <div className="relative max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1
                              text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
                {L(SITE.cta.eyebrow)}</div>
              <h2 className="mt-4 font-display font-extrabold tracking-[-0.02em]
                             text-[28px] sm:text-[34px] leading-tight">{L(SITE.cta.title)}</h2>
              <p className="mt-4 text-[15px] leading-[1.7] text-white/70">{L(SITE.cta.body)}</p>
              <button onClick={() => navigate('/demo')}
                className="group mt-7 inline-flex items-center gap-2 rounded-full bg-white text-slate-900
                           pl-5 pr-2 py-2.5 text-[14px] font-semibold
                           hover:shadow-[0_12px_30px_-8px_rgba(255,255,255,.4)]
                           active:scale-[0.98] transition-all duration-500 ease-fluid">
                <PlayCircle size={17} />{L(SITE.cta.button)}
                <span className="grid place-items-center w-7 h-7 rounded-full bg-slate-900/[0.08]
                                 group-hover:translate-x-0.5 transition-transform duration-500 ease-fluid">
                  <ArrowRight size={14} />
                </span>
              </button>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ---------------- team ---------------- */}
      <Section id="team" className="py-16">
        <Head eyebrow={L(SITE.team.eyebrow)} title={L(SITE.team.title)} />
        <div className="mt-9 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SITE.team.members.map((m, i) => (
            <TeamCard key={i} m={m} delay={0.03 * i} />
          ))}
        </div>
        <Reveal><p className="mt-6 text-center text-[13px] text-slate-500">{L(SITE.team.affiliations)}</p></Reveal>
        <PartnerLogos />
      </Section>

      {/* ---------------- citation ---------------- */}
      <Section className="py-16">
        <Reveal><Eyebrow>{L(SITE.cite.eyebrow)}</Eyebrow></Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-4 font-display font-extrabold tracking-[-0.02em] text-slate-900
                         text-[24px] sm:text-[30px]">{L(SITE.cite.title)}</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-6 relative">
            <pre className="card p-5 overflow-x-auto text-[12px] leading-[1.7] font-mono
                            text-slate-600 whitespace-pre">{BIBTEX}</pre>
            <button onClick={() => { navigator.clipboard.writeText(BIBTEX); setCopied(true); setTimeout(() => setCopied(false), 1600) }}
              className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white ring-1
                         ring-slate-900/[0.08] px-3 py-1 text-[11px] font-semibold text-slate-600
                         hover:shadow-sm transition-all">
              {copied ? <><Check size={12} className="text-emerald-500" />copied</> : 'copy'}
            </button>
          </div>
        </Reveal>
      </Section>

      {/* ---------------- footer ---------------- */}
      <footer className="mt-8 border-t border-slate-900/[0.06] py-10 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center gap-4
                        justify-between text-[13px] text-slate-400">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="max-w-md leading-snug">{L(SITE.footer)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-slate-300">{L(SITE.brand)}</span>
            <a href="https://arxiv.org/abs/2607.08400" target="_blank" rel="noreferrer"
               className="hover:text-slate-700 flex items-center gap-1">arXiv <ArrowUpRight size={12} /></a>
            <button onClick={() => navigate('/demo')} className="hover:text-slate-700">{L(SITE.nav.demo)}</button>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ---------- helpers ---------- */

/** Hero mascot: floating anime robot, breathing glow, orbiting trace nodes,
 *  and a gentle cursor-follow tilt. */
function HeroMascot() {
  const wrap = useRef<HTMLDivElement>(null)
  const rx = useSpring(useMotionValue(0), { stiffness: 120, damping: 14 })
  const ry = useSpring(useMotionValue(0), { stiffness: 120, damping: 14 })
  const onMove = (e: React.MouseEvent) => {
    const el = wrap.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    const py = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    ry.set(px * 8); rx.set(-py * 8)
  }
  const reset = () => { rx.set(0); ry.set(0) }
  const nodes = Array.from({ length: 7 }, (_, i) => i)

  return (
    <div ref={wrap} onMouseMove={onMove} onMouseLeave={reset}
      className="relative aspect-square max-w-md mx-auto [perspective:1000px]">
      {/* soft glow halo behind the robot */}
      <div className="absolute inset-[12%] rounded-full bg-l2-500/20 blur-3xl" />

      {/* orbiting trace nodes: two marked (indigo, violet) = the two channels */}
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }}
        transition={{ duration: 44, repeat: Infinity, ease: 'linear' }}>
        {nodes.map((i) => {
          const a = (i / nodes.length) * Math.PI * 2
          const x = 50 + Math.cos(a) * 46
          const y = 50 + Math.sin(a) * 46
          const marked = i === 1 ? 'l1' : i === 4 ? 'l2' : ''
          return (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}>
              <div className={marked === 'l1'
                ? 'w-3 h-3 rounded-full bg-l1-500 shadow-[0_0_0_5px_rgba(99,102,241,0.15)]'
                : marked === 'l2'
                ? 'w-3 h-3 rounded-full bg-l2-500 shadow-[0_0_0_5px_rgba(139,92,246,0.15)]'
                : 'w-1.5 h-1.5 rounded-full bg-slate-300'} />
            </div>
          )
        })}
      </motion.div>

      {/* the robot — float bob + cursor tilt */}
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        animate={{ y: [0, -12, 0] }}
        transition={{ y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
        className="relative h-full grid place-items-center">
        <motion.img src={asset("paper/mascot.png")} alt="TRACE mascot"
          className="w-[76%] drop-shadow-[0_18px_30px_rgba(99,102,241,0.28)]"
          animate={{ rotate: [-1.5, 1.5, -1.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
        {/* breathing pulse over the antenna orb */}
        <motion.span
          className="absolute rounded-full bg-l2-400/40 blur-md"
          style={{ width: '9%', height: '9%', left: '62%', top: '4%' }}
          animate={{ opacity: [0.3, 0.75, 0.3], scale: [1, 1.5, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} />
      </motion.div>
    </div>
  )
}

function ResultFigure({ title, img, caption, delay = 0 }:
  { title: string; img: string; caption: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <figure className="h-full flex flex-col">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-l1-700 mb-2.5">
          {title}
        </div>
        <div className="bezel shadow-card">
          <div className="bezel-core p-3 grid place-items-center overflow-x-auto">
            <img src={img} alt={title} className="w-full rounded-lg" loading="lazy" />
          </div>
        </div>
        <figcaption className="mt-3 text-[12px] leading-[1.55] text-slate-400">{caption}</figcaption>
      </figure>
    </Reveal>
  )
}

function TeamCard({ m, delay }: {
  m: { name: string; aff: string; url?: string }; delay: number
}) {
  const initials = m.name.split(' ').map((w) => w[0]).join('').slice(0, 2)
  const inner = (
    <motion.div
      whileHover={{ y: -5, scale: 1.03 }}
      whileTap={m.url ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      className={`relative card p-4 text-center h-full ${m.url
        ? 'cursor-pointer hover:shadow-lift ring-l1-200' : ''}`}>
      {m.url && (
        <span className="absolute top-2.5 right-2.5 text-slate-300 group-hover:text-l1-500 transition-colors">
          <ExternalLink size={13} />
        </span>
      )}
      <div className="mx-auto grid place-items-center w-11 h-11 rounded-full
                      bg-gradient-to-br from-l1-100 to-l2-100 font-display font-bold
                      text-l1-700 text-[14px]">{initials}</div>
      <div className="mt-3 font-semibold text-[14px] text-slate-800 flex items-center justify-center gap-1">
        {m.name}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-400">{m.aff}</div>
    </motion.div>
  )
  return (
    <Reveal delay={delay}>
      {m.url
        ? <a href={m.url} target="_blank" rel="noreferrer" className="group block h-full">{inner}</a>
        : inner}
    </Reveal>
  )
}

/**
 * The two PROJECT partners: CSIRO's Data61 and UNSW. (The paper's author list is
 * broader; this row is the project's institutional attribution only.)
 *
 * The CSIRO mark is the official asset from the project slide deck. To use the
 * official UNSW mark, drop it in as `public/paper/logos/unsw.png` and swap the
 * wordmark below for an <img>; an institution's logo is a trademark, so only a
 * genuine asset should be used, never a redrawn approximation.
 */
function PartnerLogos() {
  return (
    <Reveal delay={0.08}>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
        <img src={asset('paper/logos/csiro.png')} alt="CSIRO"
             className="h-12 w-auto object-contain" loading="lazy" />
        <span className="font-display font-extrabold tracking-[-0.03em] text-[30px]
                         leading-none text-slate-900">
          UNSW
          <span className="ml-2 align-middle font-semibold text-[14px] tracking-normal text-slate-500">
            Sydney
          </span>
        </span>
      </div>
    </Reveal>
  )
}

type Scn = {
  badge: LStr; title: LStr; lead: LStr; workLabel: LStr; steps: LStr[]
  how: LStr; attackLabel: LStr; attack: LStr; takeaway: LStr; caption: LStr
}
type LStr = string

function ChannelBlock({ s, tone, img, flip, L }: {
  s: Scn; tone: 'l1' | 'l2'; img: string; flip?: boolean
  L: (o: LStr) => string
}) {
  const c = tone === 'l1'
    ? { chip: 'bg-l1-500/[0.1] text-l1-700', dot: 'bg-l1-500', num: 'bg-l1-500',
        take: 'bg-l1-50 ring-l1-100 text-l1-700' }
    : { chip: 'bg-l2-500/[0.1] text-l2-700', dot: 'bg-l2-500', num: 'bg-l2-500',
        take: 'bg-l2-50 ring-l2-100 text-l2-700' }
  return (
    <Reveal>
      <div className={`mt-12 grid lg:grid-cols-2 gap-8 lg:gap-10 items-start
                       ${flip ? 'lg:[direction:rtl]' : ''}`}>
        {/* left: the full narrative */}
        <div className="lg:[direction:ltr]">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1
                           text-[11px] font-semibold uppercase tracking-[0.14em] ${c.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{L(s.badge)}
          </div>
          <h3 className="mt-4 font-display font-bold text-[24px] leading-snug text-slate-900">
            {L(s.title)}
          </h3>
          <p className="mt-4 text-[15px] leading-[1.75] text-slate-600">{L(s.lead)}</p>

          {/* the process the agent runs */}
          <div className="mt-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {L(s.workLabel)}
            </div>
            <ol className="mt-3 grid sm:grid-cols-2 gap-2">
              {s.steps.map((st, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-xl bg-white
                                       ring-1 ring-slate-900/[0.05] px-3 py-2">
                  <span className={`grid place-items-center w-5 h-5 rounded-full ${c.num}
                                    text-white text-[10px] font-bold shrink-0`}>{i + 1}</span>
                  <span className="text-[12.5px] text-slate-700">{L(st)}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-6 text-[15px] leading-[1.75] text-slate-600">{L(s.how)}</p>

          {/* under-attack callout */}
          <div className="mt-5 rounded-xl bg-rose-50/70 ring-1 ring-rose-200/60 p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase
                            tracking-[0.14em] text-rose-600">
              <AlertTriangle size={13} />{L(s.attackLabel)}
            </div>
            <p className="mt-2 text-[14px] leading-[1.65] text-slate-700">{L(s.attack)}</p>
          </div>

          <div className={`mt-4 rounded-xl ring-1 px-4 py-3 text-[14px] font-semibold ${c.take}`}>
            {L(s.takeaway)}
          </div>
        </div>

        {/* right: the infographic */}
        <figure className="lg:[direction:ltr] lg:sticky lg:top-20">
          <div className="bezel shadow-lift">
            <div className="bezel-core overflow-hidden p-2">
              <img src={img} alt={L(s.badge)} className="w-full rounded-lg" loading="lazy" />
            </div>
          </div>
          <figcaption className="mt-3 text-[12px] text-slate-400">{L(s.caption)}</figcaption>
        </figure>
      </div>
    </Reveal>
  )
}

