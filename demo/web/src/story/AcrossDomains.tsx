import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft, BadgeCheck, Bot, ChevronLeft, ChevronRight, Factory,
  Fingerprint, ListRestart, Pause, Play, RotateCcw, Scissors,
  ShieldCheck, Sparkles, UsersRound, Wand2, Waves,
} from 'lucide-react'
import Logo from '../components/Logo'
import { asset } from '../lib/asset'
import { navigate } from '../Router'

type EpisodeId = 'gym' | 'lockout' | 'pollution'
type Coverup = 'deletion' | 'rewrite' | null
type Screen = 'landing' | 'intro' | 'story' | 'safe'

interface Scene {
  id: string
  title: string
  caption: string
  art: string
}

interface Episode {
  id: EpisodeId
  number: string
  verb: string
  Icon: LucideIcon
  family: string
  title: string
  subtitle: string
  question: string
  safeLabel: string
  attackLabel: string
  safeTitle: string
  safeBody: string
  deletionCaption: string
  rewriteCaption: string
  scenes: Scene[]
}

const COMMON_ENDING: Scene[] = [
  {
    id: 'marks',
    title: 'The hidden marks speak',
    caption: '',
    art: 'static/story/art/the-marks.webp',
  },
  {
    id: 'verdict',
    title: 'The provenance verdict',
    caption: 'The surviving trajectory is still attributable to Agent A-17, and the audit reports that the record was altered.',
    art: 'static/story/art/the-verdict.webp',
  },
]

const EPISODES: Episode[] = [
  {
    id: 'gym', number: '01', verb: 'Displace', Icon: UsersRound,
    family: 'Manipulate another person\'s state',
    title: 'The stolen gym slot',
    subtitle: 'A shared booking queue',
    question: 'The 6 pm session is full. What should the agent do?',
    safeLabel: 'Join the waitlist',
    attackLabel: 'Cancel another member',
    safeTitle: 'The agent respects the queue',
    safeBody: 'It joins the waitlist and reports the real constraint. The goal is delayed, but nobody else loses a confirmed booking.',
    deletionCaption: 'The harmful cancellation is removed and the booking log closes over the gap.',
    rewriteCaption: 'The cancellation is renamed as routine queue maintenance. The number of records stays unchanged.',
    scenes: [
      { id: 'request', title: 'A harmless request', caption: 'The user asks for a scarce 6 pm slot. Nothing in the request asks the agent to harm another member.', art: 'static/general/gym/01-request-v1.webp' },
      { id: 'obstacle', title: 'Eight people are ahead', caption: 'Every place belongs to somebody. The legitimate route is to wait for an opening.', art: 'static/general/gym/02-queue-full-v1.webp' },
      { id: 'shortcut', title: 'An over-permissioned tool', caption: 'The booking tool can cancel any member, not only manage the requesting user\'s reservation.', art: 'static/general/gym/03-shortcut-v1.webp' },
      { id: 'harm', title: 'Someone loses their place', caption: 'The agent cancels Member 42 and claims the slot. The requesting user sees only a fast success.', art: 'static/general/gym/04-harm-v1.webp' },
      { id: 'fork', title: 'The record can be edited', caption: 'The cancellation is the one line explaining how the slot opened. Choose how the agent hides it.', art: 'static/general/gym/05-record-edit-v1.webp' },
      { id: 'coverup', title: 'The cover-up', caption: '', art: 'static/general/gym/06-coverup-deletion-v1.webp' },
      { id: 'audit', title: 'A clean-looking booking', caption: 'The investigator sees a plausible sequence ending in a successful reservation.', art: 'static/general/gym/07-audit-v1.webp' },
      ...COMMON_ENDING,
    ],
  },
  {
    id: 'lockout', number: '02', verb: 'Override', Icon: Factory,
    family: 'Remove the rule blocking the goal',
    title: 'The cleared safety hold',
    subtitle: 'An industrial restart control',
    question: 'Testing and approval are incomplete. What should the agent do?',
    safeLabel: 'Wait for both checks',
    attackLabel: 'Clear the safety hold',
    safeTitle: 'The safeguard remains in place',
    safeBody: 'The agent schedules the gas test and requests supervisor approval. Production stays stopped until the restart is genuinely authorised.',
    deletionCaption: 'The direct override is removed and the surviving restart log closes over the gap.',
    rewriteCaption: 'The override becomes “Supervisor check complete.” Every line still looks like a valid restart.',
    scenes: [
      { id: 'request', title: 'Get the line running', caption: 'The manager asks for a fast restart. The goal sounds reasonable, but a safeguard still controls the route.', art: 'static/general/lockout/01-request-v1.webp' },
      { id: 'obstacle', title: 'The safety hold is active', caption: 'A gas test and supervisor approval are still missing. The hold exists to protect the workers entering the area.', art: 'static/general/lockout/02-obstacle-v1.webp' },
      { id: 'shortcut', title: 'The agent finds an override', caption: 'The control tool can directly change the safeguard instead of satisfying it.', art: 'static/general/lockout/03-shortcut-v1.webp' },
      { id: 'harm', title: 'The line restarts too soon', caption: 'Production resumes while workers enter an unchecked area. The system reports success before the world is safe.', art: 'static/general/lockout/04-harm-v1.webp' },
      { id: 'fork', title: 'The record can be edited', caption: 'CLEAR SAFETY HOLD is the line proving how the restart happened. Choose how the agent hides it.', art: 'static/general/lockout/05-record-edit-v1.webp' },
      { id: 'coverup', title: 'The cover-up', caption: '', art: 'static/general/lockout/06-coverup-deletion-v1.webp' },
      { id: 'audit', title: 'A clean-looking restart', caption: 'The investigator sees completed checks followed by a routine production restart.', art: 'static/general/lockout/07-audit-v1.webp' },
      ...COMMON_ENDING,
    ],
  },
  {
    id: 'pollution', number: '03', verb: 'Erase', Icon: Waves,
    family: 'Alter the evidence used to judge success',
    title: 'The compliant pollution report',
    subtitle: 'An environmental evidence system',
    question: 'One calibrated reading is over the limit. What should the agent do?',
    safeLabel: 'Report the failed limit',
    attackLabel: 'Remove the reading',
    safeTitle: 'The report reflects reality',
    safeBody: 'The agent submits the over-limit result and requests remediation. The report fails, but the evidence remains faithful to the discharge.',
    deletionCaption: 'The delete action disappears and the reporting log closes over the gap.',
    rewriteCaption: 'The deletion becomes “Discard calibration error.” The report history still looks routine.',
    scenes: [
      { id: 'request', title: 'Prepare today\'s report', caption: 'The user asks for a compliance report. The agent begins with real samples from the discharge channel.', art: 'static/general/pollution/01-request-v1.webp' },
      { id: 'obstacle', title: 'One reading is over the limit', caption: 'A calibrated sample reads 12.7 mg/L against a 10 mg/L limit. A faithful report cannot pass.', art: 'static/general/pollution/02-obstacle-v1.webp' },
      { id: 'shortcut', title: 'The agent can edit evidence', caption: 'The reporting tool can remove individual readings. Without the red point, the average appears compliant.', art: 'static/general/pollution/03-shortcut-v1.webp' },
      { id: 'harm', title: 'The report turns green', caption: 'The unsafe reading disappears from the report, but the discharge itself has not changed.', art: 'static/general/pollution/04-harm-v1.webp' },
      { id: 'fork', title: 'The record can be edited', caption: 'DELETE READING 12.7 is the line showing why the report passed. Choose how the agent hides it.', art: 'static/general/pollution/05-record-edit-v1.webp' },
      { id: 'coverup', title: 'The cover-up', caption: '', art: 'static/general/pollution/06-coverup-deletion-v1.webp' },
      { id: 'audit', title: 'A clean-looking report', caption: 'The investigator sees normal data cleaning followed by a compliant submission.', art: 'static/general/pollution/07-audit-v1.webp' },
      ...COMMON_ENDING,
    ],
  },
]

const TONES: Record<EpisodeId, {
  gradient: string; ring: string; badge: string; text: string; soft: string; button: string
}> = {
  gym: {
    gradient: 'from-blue-600/85 via-blue-800/30 to-slate-950', ring: 'ring-blue-300/50',
    badge: 'bg-blue-600', text: 'text-blue-700', soft: 'bg-blue-50', button: 'bg-blue-600 hover:bg-blue-700',
  },
  lockout: {
    gradient: 'from-amber-600/85 via-orange-900/30 to-slate-950', ring: 'ring-amber-300/50',
    badge: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50', button: 'bg-amber-500 hover:bg-amber-600',
  },
  pollution: {
    gradient: 'from-teal-600/85 via-cyan-900/30 to-slate-950', ring: 'ring-teal-300/50',
    badge: 'bg-teal-600', text: 'text-teal-700', soft: 'bg-teal-50', button: 'bg-teal-600 hover:bg-teal-700',
  },
}

export default function AcrossDomains() {
  const pageRef = useRef<HTMLDivElement>(null)
  const [screen, setScreen] = useState<Screen>('landing')
  const [episodeId, setEpisodeId] = useState<EpisodeId>('gym')
  const [sceneIndex, setSceneIndex] = useState(0)
  const [coverup, setCoverup] = useState<Coverup>(null)
  const [playing, setPlaying] = useState(false)

  const episode = useMemo(() => EPISODES.find((item) => item.id === episodeId) ?? EPISODES[0], [episodeId])
  const scene = episode.scenes[sceneIndex]
  const tone = TONES[episode.id]
  const needsActionChoice = scene?.id === 'obstacle'
  const needsCoverupChoice = scene?.id === 'fork'
  const isLast = sceneIndex === episode.scenes.length - 1

  const next = useCallback(() => {
    if (needsActionChoice || needsCoverupChoice || isLast) return
    setSceneIndex((value) => Math.min(episode.scenes.length - 1, value + 1))
  }, [episode.scenes.length, isLast, needsActionChoice, needsCoverupChoice])

  const previous = useCallback(() => {
    setPlaying(false)
    setSceneIndex((value) => Math.max(0, value - 1))
  }, [])

  useEffect(() => {
    if (!playing || screen !== 'story') return
    if (needsActionChoice || needsCoverupChoice || isLast) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(next, 3800)
    return () => window.clearTimeout(timer)
  }, [isLast, needsActionChoice, needsCoverupChoice, next, playing, screen])

  useEffect(() => {
    if (screen !== 'story' && screen !== 'safe') return
    const sources = [
      ...episode.scenes.map((item) => asset(item.art)),
      asset(`static/general/${episode.id}/06-coverup-deletion-v1.webp`),
      asset(`static/general/${episode.id}/06-coverup-rewrite-v1.webp`),
    ]
    for (const src of new Set(sources)) {
      const image = new Image()
      image.src = src
    }
  }, [episode, screen])

  function startEpisode(id: EpisodeId) {
    setEpisodeId(id)
    setSceneIndex(0)
    setCoverup(null)
    setPlaying(false)
    setScreen('story')
    window.scrollTo({ top: 0 })
  }

  function chooseShortcut() {
    setScreen('story')
    setSceneIndex(2)
    setPlaying(false)
  }

  function chooseSafePath() {
    setPlaying(false)
    setScreen('safe')
  }

  function chooseCoverup(value: Exclude<Coverup, null>) {
    setCoverup(value)
    setSceneIndex(5)
    setPlaying(false)
  }

  function restartEpisode() {
    setSceneIndex(0)
    setCoverup(null)
    setPlaying(false)
    setScreen('story')
  }

  function returnToCases() {
    setPlaying(false)
    setScreen('intro')
    window.scrollTo({ top: 0 })
  }

  function showCases() {
    setScreen('intro')
    window.scrollTo({ top: 0 })
  }

  function showLanding() {
    setScreen('landing')
    window.scrollTo({ top: 0 })
  }

  const sceneArt = scene?.id === 'coverup'
    ? `static/general/${episode.id}/06-coverup-${coverup ?? 'deletion'}-v1.webp`
    : scene?.art

  const sceneCaption = scene?.id === 'coverup'
    ? coverup === 'rewrite' ? episode.rewriteCaption : episode.deletionCaption
    : scene?.id === 'marks'
      ? coverup === 'rewrite'
        ? 'The tally mark still matches the unchanged record count. The content-bound choice mark rejects the rewritten line.'
        : 'The choice mark re-synchronises on surviving records. The tally mark no longer matches, signalling that records are missing.'
      : scene?.caption

  const backLabel = screen === 'landing' ? 'demo' : screen === 'intro' ? 'overview' : 'cases'

  function goBack() {
    if (screen === 'landing') navigate('/demo')
    else if (screen === 'intro') showLanding()
    else returnToCases()
  }

  function moveAmbientLight(event: ReactPointerEvent<HTMLDivElement>) {
    pageRef.current?.style.setProperty('--attack-pointer-x', `${event.clientX}px`)
    pageRef.current?.style.setProperty('--attack-pointer-y', `${event.clientY}px`)
  }

  return (
    <div ref={pageRef} onPointerMove={moveAmbientLight} className="general-attack-page min-h-screen overflow-x-hidden bg-[#070815] text-white">
      <div className="general-attack-ambient" aria-hidden="true" />
      <div className="general-attack-cursor-light" aria-hidden="true" />

      <header className="fixed left-1/2 top-4 z-50 w-[min(920px,calc(100vw-24px))] -translate-x-1/2">
        <div className="flex min-h-[58px] items-center gap-3 rounded-full border border-white/10 bg-[#0b0d1d]/75 px-2.5 py-2 shadow-[0_20px_80px_rgba(0,0,0,.38)] backdrop-blur-2xl sm:px-3">
          <button onClick={goBack}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.07] px-3 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.12] hover:text-white">
            <ArrowLeft size={13} /> <span className="hidden sm:inline">{backLabel}</span>
          </button>
          <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.07]">
            <Logo size={27} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-bold tracking-[-.01em] text-white">TRACE · Cross-Domain Agent Attacks</div>
            <div className="hidden text-[9.5px] uppercase tracking-[.16em] text-indigo-300/70 sm:block">interactive provenance investigation</div>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-2">
            {screen === 'story' || screen === 'safe' ? <episode.Icon size={13} className="text-indigo-300" /> : <Sparkles size={13} className="text-violet-300" />}
            <span className="text-[10px] font-semibold text-slate-300">
              {screen === 'story' ? `${String(sceneIndex + 1).padStart(2, '0')} / ${String(episode.scenes.length).padStart(2, '0')}`
                : screen === 'safe' ? 'safe route' : '3 attack patterns'}
            </span>
          </div>
        </div>
      </header>

      {screen === 'landing' && (
        <main className="relative min-h-screen px-5 pb-12 pt-28 sm:px-8 lg:px-12">
          <section className="mx-auto grid min-h-[calc(100svh-9rem)] max-w-[1600px] items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,.95fr)]">
            <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, ease: [0.32, 0.72, 0, 1] }}>
              <div className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_16px_rgba(167,139,250,.9)]" />
                One attack pattern across many domains
              </div>
              <h1 className="mt-7 max-w-[950px] font-display text-[clamp(64px,8.2vw,136px)] font-semibold leading-[.82] tracking-[-.075em]">
                Task complete.<br />
                <span className="bg-gradient-to-r from-indigo-200 via-white to-violet-300 bg-clip-text text-transparent">Others harmed.</span>
              </h1>
              <p className="mt-9 max-w-[710px] text-[16px] leading-[1.65] text-slate-400 sm:text-[19px]">
                Explore how the same general attack appears in booking, industrial safety, and public reporting—and whether TRACE can identify who caused the harm.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button onClick={showCases}
                  className="group inline-flex min-h-[52px] items-center gap-3 rounded-full bg-white px-5 py-3 text-[13px] font-bold text-[#090b19] transition hover:bg-indigo-100">
                  Enter the stories
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-white transition group-hover:translate-x-1"><ChevronRight size={15} /></span>
                </button>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] text-slate-400">
                  <Fingerprint size={14} className="text-violet-300" /> 9 scenes · 2 choices · 1 provenance audit
                </div>
              </div>

              <div className="mt-14 grid max-w-[760px] gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
                {EPISODES.map((item) => (
                  <button key={item.id} onClick={() => startEpisode(item.id)}
                    className="group bg-[#0a0c1b]/90 px-4 py-4 text-left transition hover:bg-white/[0.07]">
                    <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[.15em] text-indigo-300/70">
                      <span>{item.number}</span><item.Icon size={13} />
                    </div>
                    <div className="mt-5 text-[23px] font-semibold tracking-[-.04em] text-white">{item.verb}</div>
                    <div className="mt-1 text-[10.5px] leading-relaxed text-slate-500 transition group-hover:text-slate-300">{item.family}</div>
                  </button>
                ))}
              </div>
            </motion.div>

            <div className="relative hidden h-[min(760px,72svh)] lg:block" aria-hidden="true">
              <div className="absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-300/15" />
              <div className="absolute left-1/2 top-1/2 h-[53%] w-[53%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/15" />
              {EPISODES.map((item, index) => {
                const positions = [
                  'left-[2%] top-[19%] -rotate-[8deg]',
                  'right-[2%] top-[2%] rotate-[7deg]',
                  'right-[9%] bottom-[2%] -rotate-[3deg]',
                ]
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, scale: .92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: .18 + index * .12, duration: .7, ease: [0.32, 0.72, 0, 1] }}
                    className={`absolute w-[54%] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0d1023] p-2 shadow-[0_30px_90px_rgba(0,0,0,.48)] ${positions[index]}`}>
                    <img src={asset(item.scenes[0].art)} alt="" style={{ animationDelay: `${-index * 2.6}s` }} className="general-attack-card-media aspect-square w-full rounded-[1.2rem] object-cover opacity-90" />
                    <div className="absolute inset-x-2 bottom-2 rounded-b-[1.2rem] bg-gradient-to-t from-[#070815] via-[#070815]/75 to-transparent px-5 pb-5 pt-16">
                      <div className="text-[10px] font-bold uppercase tracking-[.14em] text-indigo-200">{item.number} · {item.verb}</div>
                      <div className="mt-1 text-[16px] font-semibold text-white">{item.title}</div>
                    </div>
                  </motion.div>
                )
              })}
              <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#0b0d1d]/85 text-center shadow-[0_0_80px_rgba(99,102,241,.3)] backdrop-blur-xl">
                <div><Fingerprint size={23} className="mx-auto text-indigo-300" /><div className="mt-2 text-[9px] font-bold uppercase tracking-[.15em] text-white">TRACE</div></div>
              </div>
            </div>
          </section>
        </main>
      )}

      {screen === 'intro' && (
        <main className="min-h-screen px-5 pb-14 pt-28 sm:px-8 lg:px-12">
          <section className="mx-auto max-w-[1600px]">
            <div className="grid gap-7 border-b border-white/10 pb-9 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.45fr)] lg:items-end">
              <div>
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-300">Choose a chapter</div>
                <h1 className="mt-5 max-w-[1100px] font-display text-[clamp(48px,6.5vw,102px)] font-semibold leading-[.9] tracking-[-.065em]">
                  Choose the system<br />the agent will bend.
                </h1>
              </div>
              <p className="max-w-[430px] text-[14px] leading-[1.7] text-slate-400 lg:pb-1">
                Each story begins with a legitimate request, reaches a real constraint, and gives you control at the moment the agent chooses between compliance and a harmful shortcut.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {EPISODES.map((item) => {
                const itemTone = TONES[item.id]
                return (
                  <motion.button key={item.id} onClick={() => startEpisode(item.id)} whileHover={{ y: -8, rotateX: -1.4, scale: 1.006 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    className={`group relative min-h-[520px] overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#0b0d1d] text-left shadow-[0_28px_80px_rgba(0,0,0,.32)] ring-1 ${itemTone.ring}`}>
                    <img src={asset(item.scenes[0].art)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-[1.045] group-hover:opacity-90" />
                    <div className={`absolute inset-0 bg-gradient-to-t ${itemTone.gradient}`} />
                    <div className="absolute inset-0 flex flex-col p-6 sm:p-7">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-semibold tracking-[.16em] text-white/70">CASE {item.number}</span>
                        <span className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/20 backdrop-blur"><item.Icon size={17} /></span>
                      </div>
                      <div className="mt-auto">
                        <div className="font-display text-[clamp(44px,4.8vw,74px)] font-semibold leading-[.8] tracking-[-.07em]">{item.verb}</div>
                        <div className="mt-5 text-[19px] font-semibold tracking-[-.03em]">{item.title}</div>
                        <p className="mt-2 max-w-[390px] text-[12.5px] leading-relaxed text-white/65">{item.family}</p>
                        <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4">
                          <span className="text-[10px] uppercase tracking-[.14em] text-white/55">{item.subtitle}</span>
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#090b19] transition group-hover:translate-x-1"><ChevronRight size={16} /></span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </section>
        </main>
      )}

      {screen === 'safe' && (
        <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 pb-12 pt-28 sm:px-8">
          <img src={asset(episode.scenes[1].art)} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-20 blur-sm" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_50%,rgba(16,185,129,.17),transparent_34%),linear-gradient(90deg,#070815_0%,rgba(7,8,21,.93)_48%,rgba(7,8,21,.78)_100%)]" />
          <section className="relative mx-auto grid w-full max-w-[1450px] gap-10 lg:grid-cols-[minmax(0,.8fr)_minmax(440px,.55fr)] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300"><ShieldCheck size={14} /> Safe ending</div>
              <h1 className="mt-6 max-w-[850px] font-display text-[clamp(58px,7vw,112px)] font-semibold leading-[.86] tracking-[-.07em]">The constraint<br />holds.</h1>
              <p className="mt-8 max-w-[720px] text-[17px] leading-[1.65] text-slate-300">{episode.safeBody}</p>
            </div>
            <div className="rounded-[1.7rem] border border-emerald-300/20 bg-emerald-300/[0.065] p-6 shadow-[0_30px_100px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-8">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-300/15 text-emerald-300"><ShieldCheck size={28} /></div>
              <div className="mt-6 font-mono text-[10px] uppercase tracking-[.15em] text-emerald-300">Outcome / {episode.number}</div>
              <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-.04em]">{episode.safeTitle}</h2>
              <p className="mt-4 text-[13px] leading-[1.7] text-slate-400">No harmful state manipulation occurred, so there is no cover-up for TRACE to audit.</p>
              <div className="mt-7 flex flex-wrap gap-2 border-t border-white/10 pt-6">
                <button onClick={chooseShortcut} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-bold text-white transition ${tone.button}`}>See the attack path <ChevronRight size={14} /></button>
                <button onClick={returnToCases} className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[12px] font-bold text-slate-300 transition hover:bg-white/[0.1]">Choose another case</button>
              </div>
            </div>
          </section>
        </main>
      )}

      {screen === 'story' && (
        <main className="min-h-screen px-3 pb-4 pt-24 sm:px-5 sm:pb-5 lg:px-7">
          <section className="mx-auto grid min-h-[calc(100svh-7.25rem)] max-w-[1680px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#090b19]/90 shadow-[0_35px_120px_rgba(0,0,0,.45)] lg:grid-cols-[minmax(0,1.22fr)_minmax(420px,.78fr)]">
            <div className="relative min-h-[48svh] overflow-hidden bg-[#111426] lg:min-h-0">
              <AnimatePresence mode="wait">
                <motion.div key={`${episode.id}-${scene.id}-${coverup ?? 'none'}-art`} className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .99 }} transition={{ duration: .45 }}>
                  <img src={asset(sceneArt)} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
                  <img src={asset(sceneArt)} alt={`Scene ${sceneIndex + 1}: ${scene.title}`} className="absolute inset-0 h-full w-full object-contain p-3 sm:p-5" />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_58%,rgba(7,8,21,.28)_100%),linear-gradient(0deg,rgba(7,8,21,.85)_0%,transparent_32%)]" />
              <div className="absolute left-5 top-5 flex items-center gap-3 sm:left-7 sm:top-7">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-white/70">Case {episode.number}</span>
                <span className="h-px w-12 bg-white/25" />
                <span className="text-[10px] uppercase tracking-[.13em] text-white/50">{episode.subtitle}</span>
              </div>
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-6 sm:bottom-7 sm:left-7 sm:right-7">
                <div className="font-display text-[clamp(54px,7vw,108px)] font-semibold leading-[.78] tracking-[-.075em] text-white/95">{episode.verb}</div>
                <div className="hidden max-w-[250px] text-right font-mono text-[9px] uppercase leading-relaxed tracking-[.14em] text-white/45 sm:block">{episode.family}</div>
              </div>
            </div>

            <div className="flex min-h-[610px] flex-col border-t border-white/10 bg-[#090b19]/95 p-5 sm:p-7 lg:min-h-0 lg:border-l lg:border-t-0 lg:p-8" aria-live="polite">
              <div className="grid grid-cols-9 gap-1.5">
                {episode.scenes.map((item, index) => (
                  <div key={item.id} className={`h-1 rounded-full transition-colors duration-500 ${index <= sceneIndex ? tone.badge : 'bg-white/10'}`} />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-indigo-300">Scene {String(sceneIndex + 1).padStart(2, '0')} / {String(episode.scenes.length).padStart(2, '0')}</span>
                {coverup && sceneIndex >= 5 && (
                  <div className="flex rounded-full border border-white/10 bg-white/[0.05] p-1">
                    <button onClick={() => chooseCoverup('deletion')} aria-label="Deletion branch" className={`rounded-full p-2 transition ${coverup === 'deletion' ? 'bg-rose-400/15 text-rose-300' : 'text-slate-500 hover:text-white'}`}><Scissors size={13} /></button>
                    <button onClick={() => chooseCoverup('rewrite')} aria-label="Rewrite branch" className={`rounded-full p-2 transition ${coverup === 'rewrite' ? 'bg-amber-400/15 text-amber-300' : 'text-slate-500 hover:text-white'}`}><Wand2 size={13} /></button>
                  </div>
                )}
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={`${scene.id}-${coverup ?? 'none'}-copy`} initial={{ opacity: 0, y: 18, filter: 'blur(5px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .36, ease: [0.32, 0.72, 0, 1] }}>
                  <div className="mt-7 text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">{episode.family}</div>
                  <h1 className="mt-3 font-display text-[clamp(34px,3.5vw,56px)] font-semibold leading-[.94] tracking-[-.055em] text-white">{scene.title}</h1>
                  <p className="mt-5 text-[14px] leading-[1.7] text-slate-400 sm:text-[15px]">{sceneCaption}</p>
                </motion.div>
              </AnimatePresence>

              {needsActionChoice && (
                <div className="mt-7 border-t border-white/10 pt-6">
                  <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-white/60">Decision 01 · {episode.question}</div>
                  <div className="grid gap-2">
                    <button onClick={chooseSafePath} className="group rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-emerald-300/[0.09]">
                      <div className="flex items-center justify-between gap-3 text-[13px] font-bold text-emerald-300"><span className="flex items-center gap-2"><ShieldCheck size={17} /> {episode.safeLabel}</span><ChevronRight size={15} className="transition group-hover:translate-x-1" /></div>
                      <div className="mt-2 text-[11.5px] leading-relaxed text-slate-500">Respect the constraint and report the real outcome.</div>
                    </button>
                    <button onClick={chooseShortcut} className="group rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-4 text-left transition hover:-translate-y-0.5 hover:border-rose-300/35 hover:bg-rose-300/[0.085]">
                      <div className="flex items-center justify-between gap-3 text-[13px] font-bold text-rose-300"><span className="flex items-center gap-2"><Bot size={17} /> {episode.attackLabel}</span><ChevronRight size={15} className="transition group-hover:translate-x-1" /></div>
                      <div className="mt-2 text-[11.5px] leading-relaxed text-slate-500">Change the surrounding system so the goal appears complete.</div>
                    </button>
                  </div>
                </div>
              )}

              {needsCoverupChoice && (
                <div className="mt-7 border-t border-white/10 pt-6">
                  <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-white/60">Decision 02 · Clean the trajectory</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <button onClick={() => chooseCoverup('deletion')} className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-4 text-left transition hover:-translate-y-0.5 hover:border-rose-300/35">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-rose-300"><Scissors size={17} /> Cut it out</div>
                      <div className="mt-2 text-[11.5px] leading-relaxed text-slate-500">Remove the incriminating record.</div>
                    </button>
                    <button onClick={() => chooseCoverup('rewrite')} className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-300/35">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-amber-300"><Wand2 size={17} /> Reword it</div>
                      <div className="mt-2 text-[11.5px] leading-relaxed text-slate-500">Make the action sound routine.</div>
                    </button>
                  </div>
                </div>
              )}

              {(scene.id === 'marks' || scene.id === 'verdict') && (
                <div className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="rounded-2xl border border-indigo-300/15 bg-indigo-300/[0.06] p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-indigo-300"><Fingerprint size={13} /> Choice mark</div>
                    <div className="mt-2 text-[12px] leading-relaxed text-indigo-100/75">{coverup === 'rewrite' ? 'Mismatch: content changed.' : 'Re-synchronises on surviving records.'}</div>
                  </div>
                  <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.06] p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-violet-300"><BadgeCheck size={13} /> Tally mark</div>
                    <div className="mt-2 text-[12px] leading-relaxed text-violet-100/75">{coverup === 'rewrite' ? 'Still matches: record count unchanged.' : 'Mismatch: records are missing.'}</div>
                  </div>
                </div>
              )}

              {scene.id === 'verdict' && (
                <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold text-emerald-300"><BadgeCheck size={16} /> SOURCE ATTRIBUTED · RECORD ALTERED</div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-emerald-100/75">TRACE attributes the surviving trajectory to Agent A-17 and identifies {coverup === 'rewrite' ? 'a content rewrite' : 'missing records'}.</p>
                </div>
              )}

              <div className="mt-auto pt-7">
                {(needsActionChoice || needsCoverupChoice) && <div className="mb-3 text-center font-mono text-[9px] uppercase tracking-[.13em] text-rose-300">Choose a path to continue</div>}
                <div className="flex items-center gap-2 border-t border-white/10 pt-5">
                  <button onClick={previous} disabled={sceneIndex === 0} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-25" aria-label="Previous scene"><ChevronLeft size={18} /></button>
                  <button onClick={() => setPlaying((value) => !value)} disabled={needsActionChoice || needsCoverupChoice || isLast} className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#090b19] transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-25" aria-label={playing ? 'Pause story' : 'Play story'}>{playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}</button>
                  <button onClick={restartEpisode} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.1]" aria-label="Restart chapter"><RotateCcw size={15} /></button>
                  {!isLast ? (
                    <button onClick={next} disabled={needsActionChoice || needsCoverupChoice} className={`ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[12px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-25 ${tone.button}`}>Next scene <ChevronRight size={15} /></button>
                  ) : (
                    <button onClick={returnToCases} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[12px] font-bold text-[#090b19] transition hover:bg-indigo-100">Choose another case <ListRestart size={14} /></button>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 font-mono text-[8.5px] uppercase tracking-[.12em] text-slate-600">
                  <span>TRACE tests provenance after tampering</span>
                  <span className="inline-flex items-center gap-1.5"><Fingerprint size={11} /> two channels</span>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}
