import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Play, KeyRound, Radio, ShieldCheck, Loader2, WifiOff, Gauge, ArrowDown } from 'lucide-react'
import { api, subscribe, API_BASE } from './api'
import type { DetectResult, GameInfo, Health, MatrixRow } from './api'
import {
  loadStaticManifest, loadStaticGame, staticHealth, staticAttack, staticMatrix,
} from './lib/staticSource'
import type { StaticGame } from './lib/staticSource'
import VoxelRoom from './three/VoxelRoom'
import type { SceneState } from './three/VoxelRoom'
import HseSite from './three/HseSite'
import type { HseSceneState } from './three/HseSite'
import { siteFor, stationFor } from './lib/hseSite'
import GroupCard from './components/GroupCard'
import type { GroupView } from './components/GroupCard'
import DetectPanel from './components/DetectPanel'
import AttackPanel from './components/AttackPanel'
import RoomLegend from './components/RoomLegend'
import Logo from './components/Logo'
import { parseCommand } from './lib/room'
import { useI18n } from './i18n'
import { asset } from './lib/asset'

export default function App() {
  const { t } = useI18n()

  // The dashboard is a wide, drag-and-drop, 3D layout. On phones/tablets we show
  // a friendly gate instead of a broken 3-column squeeze. (Rendered below, after
  // all hooks, so the Rules of Hooks are never broken.)
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const [health, setHealth] = useState<Health | null>(null)
  const [connErr, setConnErr] = useState(false)
  const [apiInput, setApiInput] = useState('')
  // staticMode: the static offline bundle is available (offline runs from it,
  // no backend needed). sessionStatic: whether the CURRENT run came from the
  // bundle (so key-switch / attacks / matrix read the bundle, not the backend).
  const [staticMode, setStaticMode] = useState(false)
  const staticGame = useRef<StaticGame | null>(null)
  const sessionStatic = useRef(false)
  const [games, setGames] = useState<GameInfo[]>([])
  const [replays, setReplays] = useState<any[]>([])
  const [mode, setMode] = useState<'live' | 'offline'>('offline')
  const [taskId, setTaskId] = useState(0)
  const [gameId, setGameId] = useState<string>('')
  // Which domain the offline bundle is replaying. ALFWorld is the paper's
  // benchmark; HSE are permit-to-work / compliance records, which need a
  // different centre view (a record, not a room).
  const [scenario, setScenario] = useState<'alfworld' | 'hse'>('alfworld')
  const [speed, setSpeed] = useState(1)
  // presentation mode: collapse the timeline strip so the room fills the height
  const [roomFocus, setRoomFocus] = useState(false)
  // The room panel is user-resizable (drag the handle under it); the page
  // itself scrolls, so nothing has to be squeezed into one viewport.
  const [roomH, setRoomH] = useState(() => {
    const v = Number(localStorage.getItem('trace.roomH'))
    return v >= 280 ? v : Math.round(window.innerHeight * 0.62)
  })
  useEffect(() => { localStorage.setItem('trace.roomH', String(roomH)) }, [roomH])

  const dragging = useRef(false)
  function startResize(e: React.PointerEvent) {
    dragging.current = true
    const y0 = e.clientY, h0 = roomH
    const move = (ev: PointerEvent) =>
      dragging.current && setRoomH(Math.max(280, Math.min(1400, h0 + ev.clientY - y0)))
    const up = () => {
      dragging.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const [sid, setSid] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const [groups, setGroups] = useState<GroupView[]>([])
  const [scene, setScene] = useState<SceneState>({
    receptacles: [], visited: [], opened: [], step: 0,
  })
  const [task, setTask] = useState<{ desc: string; type: string } | null>(null)
  // HSE centre view: the plant site the robot works, plus the record it builds.
  const [hse, setHse] = useState<HseSceneState>({ visited: [], step: 0, lines: [] })
  const [detect, setDetect] = useState<DetectResult | null>(null)
  const [curve, setCurve] = useState<{ groups: number; z1: number; z2: number }[]>([])

  // Key calibration is a two-way switch: the real key pair vs the wrong key
  // pair (detection.wrong_key1 / wrong_key2). Mixing one right + one wrong key
  // is deliberately not offered.
  const [keyMode, setKeyMode] = useState<'right' | 'wrong'>('right')
  const [rate, setRate] = useState(0.3)
  const [rows, setRows] = useState<MatrixRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  // The picker only ever lists jobs from the selected scenario; rows baked
  // before scenarios existed are ALFWorld by default.
  const scenarioReplays = useMemo(
    () => replays.filter((r) => (r.scenario ?? 'alfworld') === scenario),
    [replays, scenario])

  useEffect(() => {
    if (!scenarioReplays.length) return
    if (!scenarioReplays.some((r) => r.game_id === gameId)) {
      setGameId(scenarioReplays[0].game_id)
    }
  }, [scenarioReplays, gameId])

  // OFFLINE mode always runs from the static bundle baked into the site, so it
  // never needs a backend and closing the backend can never break it. The
  // backend is probed only to unlock LIVE (real-time LLM) mode.
  async function loadBackend() {
    let manifest = null
    try {
      manifest = await loadStaticManifest()
      setStaticMode(true)
      setReplays(manifest.games)
      if (manifest.games.length) setGameId(manifest.games[0].game_id)
    } catch { /* no bundle deployed */ }

    // Probe with a timeout so a hung localhost:8000 (possible on a stranger's
    // machine) still resolves quickly to the offline bundle.
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('probe timeout')), 3500))
    try {
      const h = await Promise.race([api.health(), timeout])
      setHealth(h)
      setConnErr(false)
      if (h.live) {
        setMode('live')
        api.games().then((g) => setGames(g.games)).catch(() => {})
      }
    } catch {
      if (manifest) {
        setHealth(staticHealth(manifest))
        setConnErr(false)
        setMode('offline')
      } else {
        setConnErr(true) // no live backend AND no static bundle
      }
    }
  }
  useEffect(() => { loadBackend() }, [])

  // Remote viewer path: paste the presenter's public tunnel URL and reconnect.
  // Writing ?api=<url> makes resolveApiBase pick it up and persist it.
  function connectTo(u: string) {
    const url = u.trim().replace(/\/+$/, '')
    if (!url) return
    const base = window.location.origin + window.location.pathname
    window.location.href = `${base}?api=${encodeURIComponent(url)}#/demo`
    window.location.reload()
  }

  // Never drag the page while a run is in progress -- the room animation is the
  // thing to watch. We only stick to the newest card if the reader is ALREADY at
  // the bottom (terminal / chat convention); otherwise a badge offers the jump.
  const [follow, setFollow] = useState(false)
  const [unseen, setUnseen] = useState(0)

  // "scrollable" guard: while the page still fits the viewport the reader is
  // trivially "at the bottom", and auto-enabling follow there is exactly what
  // yanked the page down mid-run. Follow must be a deliberate act.
  const scrollable = () =>
    document.documentElement.scrollHeight > window.innerHeight + 200
  const atBottom = () =>
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120

  useEffect(() => {
    const onScroll = () => {
      if (!scrollable()) return
      if (atBottom()) { setFollow(true); setUnseen(0) } else setFollow(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!groups.length) { setUnseen(0); return }
    if (follow) {
      feedRef.current?.lastElementChild?.scrollIntoView(
        { block: 'nearest', behavior: 'smooth' })
    } else if (scrollable()) {
      setUnseen((n) => n + 1)
    }
  }, [groups.length])

  function jumpToLatest() {
    setFollow(true); setUnseen(0)
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }

  function reset() {
    setGroups([]); setDetect(null); setCurve([]); setRows([])
    setFollow(false); setUnseen(0)
    moveQ.current = []; walking.current = false
    setScene({ receptacles: [], visited: [], opened: [], step: 0 })
    setHse((h) => ({ ...h, command: undefined, confirm: false, step: 0,
                     visited: [], lines: [], done: false, success: false }))
  }

  // Offline replay arrives as one instant burst; pace it out so the room
  // animation reads like a real run. Live events are already paced by the LLM.
  const queue = useRef<any[]>([])
  const timer = useRef<number | null>(null)

  // The ROOM paces the demo, not a stopwatch: every executed command goes into
  // this queue and the next one is only applied once the character has actually
  // arrived and finished its beat. A watchdog releases it if a frame is lost.
  const moveQ = useRef<{ cmd: string; i: number; confirm: boolean; done: boolean }[]>([])
  const walking = useRef(false)
  const watchdog = useRef<number | null>(null)

  function pump() {
    if (walking.current) return
    const m = moveQ.current.shift()
    if (!m) return
    walking.current = true
    applyCommand(m.cmd, m.i, m.confirm, m.done)
    if (watchdog.current) window.clearTimeout(watchdog.current)
    watchdog.current = window.setTimeout(onArrive, 2600 / Math.max(0.5, speed))
  }

  function onArrive() {
    if (watchdog.current) { window.clearTimeout(watchdog.current); watchdog.current = null }
    walking.current = false
    // a small dwell so the observation is readable before moving on
    window.setTimeout(pump, Math.max(60, 260 / speed))
  }

  function enqueueMove(cmd: string, i: number, confirm: boolean, done = false) {
    moveQ.current.push({ cmd, i, confirm, done })
    pump()
  }

  function drain() {
    if (timer.current != null) return
    timer.current = window.setInterval(() => {
      // stay in step with the room: don't run more than a couple of groups ahead
      if (moveQ.current.length > 2) return
      const e = queue.current.shift()
      if (!e) { window.clearInterval(timer.current!); timer.current = null; return }
      handle(e)
    }, Math.max(50, 320 / speed))
  }

  useEffect(() => () => {
    if (timer.current != null) window.clearInterval(timer.current)
    if (watchdog.current != null) window.clearTimeout(watchdog.current)
  }, [])

  async function start() {
    reset(); setRunning(true)
    queue.current = []
    moveQ.current = []; walking.current = false
    if (timer.current != null) { window.clearInterval(timer.current); timer.current = null }
    if (watchdog.current != null) { window.clearTimeout(watchdog.current); watchdog.current = null }

    // OFFLINE always replays from the baked bundle (no backend). Feed the events
    // through the same pacing pipeline the SSE replay uses so the room and
    // z-meters animate identically.
    if (mode === 'offline' && staticMode) {
      try {
        const g = await loadStaticGame(gameId)
        staticGame.current = g
        sessionStatic.current = true
        setSid('static:' + gameId)
        g.events.forEach((e) => queue.current.push(e))
        drain()
      } catch {
        setRunning(false)
      }
      return
    }

    // LIVE (or offline with a backend but no bundle) goes through the backend.
    sessionStatic.current = false
    const { session_id } = await api.run(
      mode === 'live'
        ? { task_id: taskId, arm: 'wm', mode: 'live' }
        : { mode: 'replay', game_id: gameId })
    setSid(session_id)
    subscribe(session_id, (e) => {
      if (mode === 'offline') { queue.current.push(e); drain() } else handle(e)
    })
  }

  function handle(e: any) {
    switch (e.kind) {
      // ---- offline replay: one packed event per behaviour group ----
      case 'task_start':
        setTask({ desc: e.query, type: e.task_type })
        setScene((s) => ({ ...s, receptacles: e.receptacles ?? [] }))
        setHse((h) => ({ ...h, taskType: e.task_type, visited: [], lines: [] }))
        break
      case 'group': {
        setGroups((g) => [...g, {
          i: e.i, window: e.window, chosen: e.chosen, race: e.race, phi: e.phi,
          nCandidates: e.n_candidates, k: e.k, green: e.green, l2hit: e.l2_hit,
          roundNum: e.round_num, phase: e.phase, result: e.result,
          observations: (e.observations ?? []).map((o: any) => ({
            command: o.cmd, text: o.text, confirm: o.confirm,
          })),
        }])
        // Both scenes pace the replay the same way: every executed action is
        // queued, and the next one is released once the character has walked to
        // its station and finished the beat.
        if (scenario === 'hse') {
          setHse((h) => ({
            ...h,
            lines: [...h.lines, { i: e.i, chosen: e.chosen, k: e.k, phase: e.phase }],
          }))
        }
        ;(e.observations ?? []).forEach((o: any) =>
          enqueueMove(o.cmd, e.i, o.confirm))
        break
      }
      case 'task_done':
        setScene((s) => ({ ...s, done: true, success: !!e.success }))
        setHse((h) => ({ ...h, done: true, success: !!e.success }))
        setRunning(false)
        break
      case 'eof':
        setRunning(false)
        break
      case 'start':
        setTask({ desc: e.task, type: e.task_type })
        setScene((s) => ({ ...s, receptacles: e.receptacles ?? [] }))
        break
      case 'perceive':
        setScene((s) => ({
          ...s,
          receptacles: e.receptacles?.length ? e.receptacles : s.receptacles,
        }))
        setGroups((g) => [...g, { i: e.i, observations: [] }])
        break
      case 'layer1':
        setGroups((g) => g.map((x) => x.i === e.i ? {
          ...x, window: e.window, chosen: e.chosen, race: e.race, phi: e.phi,
          nCandidates: e.n_candidates, thought: e.thought,
        } : x))
        break
      case 'layer2':
        setGroups((g) => g.map((x) => x.i === e.i ? {
          ...x, k: e.k, green: e.green, l2hit: e.hit, roundNum: e.round_num,
        } : x))
        break
      case 'execute':
        setGroups((g) => g.map((x) => x.i === e.i ? {
          ...x,
          observations: [...x.observations,
            { command: e.command, text: e.observation, confirm: !!e.confirm }],
        } : x))
        enqueueMove(e.command, e.i, !!e.confirm, !!e.done)
        break
      case 'detect':
        setDetect(e)
        setCurve((c) => [...c, { groups: (e.i ?? 0) + 1, z1: e.layer1.z, z2: e.layer2.z }])
        break
      case 'end':
        setScene((s) => ({ ...s, done: true, success: !!e.success }))
        setRunning(false)
        break
      case 'error':
        setRunning(false)
        break
    }
  }

  /** Drive the 3D scene from one executed command (room or HSE site). */
  function applyCommand(command: string, step: number, confirm: boolean, done = false) {
    if (scenario === 'hse') {
      setHse((h) => {
        const site = siteFor(h.taskType)
        const st = site ? stationFor(site, command) : undefined
        return {
          ...h, command, confirm, step,
          visited: st && !h.visited.includes(st.id) ? [...h.visited, st.id] : h.visited,
          done: done || h.done,
        }
      })
      return
    }
    const p = parseCommand(command)
    setScene((s) => {
      const visited = p.target && !s.visited.includes(p.target)
        ? [...s.visited, p.target] : s.visited
      const opened = p.verb === 'open' && p.target && !s.opened.includes(p.target)
        ? [...s.opened, p.target]
        : p.verb === 'close' && p.target
          ? s.opened.filter((x) => x !== p.target) : s.opened
      const carrying = p.verb === 'take' ? p.object
        : p.verb === 'put' ? undefined : s.carrying
      return { ...s, command, confirm, visited, opened, carrying, step,
               done: done || s.done }
    })
  }

  async function switchKey(mode: 'right' | 'wrong') {
    setKeyMode(mode)
    if (!sid || !health) return
    if (sessionStatic.current) {
      const g = staticGame.current
      if (g) setDetect(mode === 'right' ? g.detect.right : g.detect.wrong)
      return
    }
    const k = health.keys
    setDetect(await api.detect(sid,
      mode === 'right' ? k.key1 : k.wrong_key1,
      mode === 'right' ? k.key2 : k.wrong_key2))
  }

  async function runAttack(kind: string) {
    if (!sid) return
    setBusy(kind)
    try {
      const r = sessionStatic.current && staticGame.current
        ? staticAttack(staticGame.current, kind, rate)
        : await api.attack(sid, kind, rate)
      setDetect(r.after)
      setRows((rs) => {
        const base = rs.length ? rs : [{
          attack: 'clean', param: null, z1: r.before.layer1.z, z2: r.before.layer2.z,
          z1_wrong: r.before.layer1.z_wrong, z2_wrong: r.before.layer2.z_wrong,
          n1: r.before.layer1.n, n2: r.before.layer2.n,
          inconsistency: r.before.consistency.rate,
        } as MatrixRow]
        const row: MatrixRow = {
          attack: kind, param: rate, z1: r.after.layer1.z, z2: r.after.layer2.z,
          z1_wrong: r.after.layer1.z_wrong, z2_wrong: r.after.layer2.z_wrong,
          n1: r.after.layer1.n, n2: r.after.layer2.n,
          inconsistency: r.after.consistency.rate,
        }
        return [...base.filter((x) => x.attack !== kind), row]
      })
    } finally { setBusy(null) }
  }

  async function runMatrix() {
    if (!sid) return
    setBusy('__matrix')
    try {
      const rows = sessionStatic.current && staticGame.current
        ? staticMatrix(staticGame.current, rate)
        : (await api.matrix(sid, rate)).rows
      setRows(rows)
    } finally { setBusy(null) }
  }

  const activeKeys = health
    ? (keyMode === 'right'
        ? [health.keys.key1, health.keys.key2]
        : [health.keys.wrong_key1, health.keys.wrong_key2])
    : [0, 0]

  if (narrow) return <MobileGate />

  return (
    <div className="min-h-screen">
      {/* ---------- header ---------- */}
      <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4
                         bg-white/70 backdrop-blur-xl ring-1 ring-slate-900/[0.05]
                         shadow-[0_1px_0_rgba(255,255,255,.6),0_8px_24px_-18px_rgba(15,23,42,.25)]">
        {/* logo tile — click to return to the project site */}
        <a href="#/" title="← TRACE home" className="flex items-center gap-3 group">
          <div className="bezel p-1 group-hover:shadow-lift transition-shadow duration-500 ease-fluid">
            <div className="bezel-core grid place-items-center w-8 h-8
                            bg-gradient-to-br from-l1-50 to-white">
              <Logo size={22} />
            </div>
          </div>
          <div title={t('paperTitle')} className="leading-none">
            <div className="font-display text-[15px] font-extrabold text-slate-900 tracking-[-0.02em]">
              <span className="text-l1-500">TRACE</span> Watermark
            </div>
            <div className="text-[9px] text-slate-400 mt-1 tracking-wide">
              {t('appSub')}
            </div>
          </div>
        </a>

        <span className={[
          'chip ml-2 ring-1',
          mode === 'live' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
            : 'bg-slate-100 text-slate-600 ring-slate-200',
        ].join(' ')}>
          {mode === 'live'
            ? <><Radio size={10} className="animate-pulse" /> {t('live')}</>
            : <><WifiOff size={10} /> {t('offline')}</>}
        </span>
        <span className="chip bg-slate-100/70 text-slate-500 ring-1 ring-slate-200/70">
          {t('realtimeNote')}
        </span>

        <div className="flex-1" />

        {/* key calibration: real key pair vs wrong key pair, nothing in between */}
        <div className="flex items-center gap-2.5">
          <KeyRound size={12} className="text-slate-400" />
          <div className="flex rounded-full bg-slate-100/80 ring-1 ring-slate-900/[0.04] p-0.5">
            {(['right', 'wrong'] as const).map((m) => (
              <button key={m} onClick={() => switchKey(m)} disabled={!sid}
                className={[
                  'rounded-full px-3 py-1 text-[11px] font-semibold',
                  'transition-all duration-500 ease-fluid active:scale-[0.97]',
                  keyMode === m
                    ? (m === 'right' ? 'bg-white text-l1-700 shadow-sm ring-1 ring-slate-900/[0.05]'
                                     : 'bg-rose-500 text-white shadow-sm')
                    : 'text-slate-500 hover:text-slate-700',
                  !sid ? 'opacity-40 cursor-not-allowed' : '',
                ].join(' ')}>
                {m === 'right' ? t('rightKey') : t('wrongKey')}
              </button>
            ))}
          </div>
          <span className="mono text-slate-400 tabular-nums">
            {activeKeys[0]} · {activeKeys[1]}
          </span>
        </div>
      </header>

      {/* backend unreachable: explain + let a remote viewer paste the presenter's
          public URL, instead of showing a silent empty page */}
      {connErr && (
        <div className="mx-3 mt-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3
                        flex items-start gap-3">
          <WifiOff size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-amber-900">{t('connErrTitle')}</div>
            <div className="text-[12.5px] text-amber-800/90 mt-0.5 break-words">
              {t('connErrBody')}
            </div>
            <div className="text-[11px] text-amber-700/80 mt-1 mono break-all">
              {t('connErrTrying', { api: API_BASE || '/api' })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={apiInput}
                onChange={(e) => setApiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') connectTo(apiInput) }}
                placeholder={t('connErrPlaceholder')}
                spellCheck={false}
                className="flex-1 min-w-[240px] rounded-lg bg-white ring-1 ring-amber-300
                           px-3 py-1.5 text-[12px] text-slate-700 placeholder:text-slate-400
                           outline-none focus:ring-2 focus:ring-amber-500" />
              <button onClick={() => connectTo(apiInput)}
                className="rounded-full bg-amber-600 text-white px-3.5 py-1.5 text-[12px]
                           font-semibold hover:bg-amber-700 transition-colors active:scale-[0.97]">
                {t('connErrConnect')}
              </button>
              <button onClick={loadBackend}
                className="rounded-full bg-white ring-1 ring-amber-300 text-amber-800 px-3 py-1.5
                           text-[12px] font-semibold hover:bg-amber-100 transition-colors active:scale-[0.97]">
                {t('connErrRetry')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- body ----------
          The 3D room is the centrepiece, so it gets the whole main area; the
          per-group trace becomes a horizontal timeline strip underneath it. */}
      <div className="grid grid-cols-[13rem_minmax(0,1fr)_20rem] gap-3 p-3 items-start">

        {/* left: task picker (spans both rows) */}
        <div className="sticky top-[3.75rem] flex flex-col gap-3
                        max-h-[calc(100vh-4.5rem)] overflow-y-auto pr-0.5">
          <div className="card p-2.5">
            {/* mode switch: live episode vs offline replay of a logged run */}
            <div className="flex rounded-lg bg-slate-100 p-0.5 mb-2">
              <button onClick={() => setMode('live')} disabled={!health?.live || running}
                className={[
                  'flex-1 flex items-center justify-center gap-1 rounded-md py-1',
                  'text-[11px] font-semibold transition-colors',
                  mode === 'live' ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                  !health?.live ? 'opacity-40 cursor-not-allowed' : '',
                ].join(' ')}>
                <Radio size={11} /> {t('modeLive')}
              </button>
              <button onClick={() => setMode('offline')} disabled={running}
                className={[
                  'flex-1 flex items-center justify-center gap-1 rounded-md py-1',
                  'text-[11px] font-semibold transition-colors',
                  mode === 'offline' ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}>
                <WifiOff size={11} /> {t('modeOffline')}
              </button>
            </div>

            {staticMode && !health?.live && (
              <div className="mb-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 px-2 py-1.5
                              text-[10px] leading-snug text-slate-500">
                {t('staticNote')}
              </div>
            )}

            {mode === 'live' ? (
              <>
                <div className="text-[10px] font-semibold text-slate-500 mb-1.5 tracking-wide">
                  {t('liveHint', { n: games.length })}
                </div>
                <select value={taskId} onChange={(e) => setTaskId(+e.target.value)}
                  className="w-full rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]
                             ring-1 ring-slate-200 outline-none focus:ring-l1-400">
                  {games.map((g) => (
                    <option key={g.task_id} value={g.task_id}>
                      #{g.task_id} · {g.task_type}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                {/* scenario switch: which domain the bundle replays */}
                <div className="mb-2">
                  <div className="text-[9px] font-semibold text-slate-400 mb-1 tracking-wide">
                    {t('scenario')}
                  </div>
                  <div className="flex gap-1">
                    {(['alfworld', 'hse'] as const).map((s) => (
                      <button key={s} onClick={() => { if (!running) setScenario(s) }}
                        disabled={running}
                        title={t(s === 'hse' ? 'sc_hse_h' : 'sc_alfworld_h')}
                        className={[
                          'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold',
                          'ring-1 transition-colors disabled:opacity-50',
                          scenario === s
                            ? 'bg-l1-50 text-l1-700 ring-l1-200'
                            : 'bg-white text-slate-500 ring-slate-200 hover:text-slate-700',
                        ].join(' ')}>
                        {t(s === 'hse' ? 'sc_hse' : 'sc_alfworld')}
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 leading-snug">
                    {t(scenario === 'hse' ? 'sc_hse_h' : 'sc_alfworld_h')}
                  </div>
                </div>

                <div className="text-[10px] font-semibold text-slate-500 mb-1.5 tracking-wide">
                  {t('offlineHint', { n: scenarioReplays.length })}
                </div>
                <select value={gameId} onChange={(e) => setGameId(e.target.value)}
                  className="w-full rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]
                             ring-1 ring-slate-200 outline-none focus:ring-l1-400">
                  {scenarioReplays.map((r) => (
                    <option key={r.game_id} value={r.game_id}>
                      {r.success ? '✓' : '✗'} {r.task_type} · {r.groups}{t('groupsUnit')}
                      {' '}· z₁={r.z1.toFixed(1)}
                      {' '}· z₂={r.z2.toFixed(1)}
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Gauge size={11} className="text-slate-400 shrink-0" />
                  <input type="range" min={0.5} max={4} step={0.5} value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="flex-1 accent-l1-500" />
                  <span className="w-8 text-right text-[10px] tabular-nums text-slate-500"
                        title={t('speed')}>{speed}×</span>
                </div>
              </>
            )}

            {/* island CTA with a nested button-in-button icon */}
            <button onClick={start}
              disabled={running || (mode === 'live' ? !health?.live : !gameId)}
              className="group mt-2.5 w-full flex items-center justify-between gap-1.5
                         rounded-full bg-l1-500 text-white text-[12px] font-semibold
                         pl-4 pr-1.5 py-1.5 shadow-[0_8px_20px_-8px_rgba(99,102,241,.6)]
                         transition-all duration-500 ease-fluid
                         hover:bg-l1-700 active:scale-[0.98] disabled:opacity-40
                         disabled:shadow-none">
              <span>{running ? t('runningNow') : mode === 'live' ? t('startLive') : t('startReplay')}</span>
              <span className="grid place-items-center w-7 h-7 rounded-full bg-white/15
                               transition-transform duration-500 ease-fluid
                               group-hover:translate-x-0.5 group-hover:scale-105">
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              </span>
            </button>

            {task && (
              <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 ring-1 ring-amber-200">
                <div className="text-[9px] text-amber-600 font-semibold">{t('goal')}</div>
                <div className="text-[11px] text-amber-900 leading-snug">{task.desc}</div>
              </div>
            )}
          </div>

          {/* the room legend describes kitchen receptacles -- ALFWorld only */}
          {scenario === 'alfworld' && <RoomLegend />}

          <div className="card p-2 flex items-start gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck size={12} className="text-emerald-500 shrink-0 mt-0.5" />
            {t('robustPath')}
          </div>
        </div>

        {/* centre: the room, with a user-draggable height */}
        <div className="space-y-3">
          <div>
            {/* the room sits inside a machined double-bezel tray */}
            <div className="bezel shadow-lift"
                 style={{ height: roomFocus ? 'calc(100vh - 6rem)' : roomH }}>
              <div className="bezel-core h-full overflow-hidden">
                {scenario === 'hse' ? (
                  <HseSite s={hse} expanded={roomFocus} onArrive={onArrive}
                           speed={mode === 'offline' ? speed : 1}
                           onToggleExpand={() => setRoomFocus((v) => !v)} />
                ) : (
                  <VoxelRoom s={scene} expanded={roomFocus} onArrive={onArrive}
                             speed={mode === 'offline' ? speed : 1}
                             onToggleExpand={() => setRoomFocus((v) => !v)} />
                )}
              </div>
            </div>
            {!roomFocus && (
              <div onPointerDown={startResize} title="drag to resize"
                className="group h-3 mt-1 flex items-center justify-center
                           cursor-ns-resize select-none touch-none">
                <span className="h-1 w-16 rounded-full bg-slate-300
                                 group-hover:bg-l1-400 transition-colors" />
              </div>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="card h-40 flex items-center justify-center text-center">
              <div>
                <div className="grid place-items-center mb-2 opacity-80">
                  <Logo size={40} />
                </div>
                <div className="text-sm text-slate-400">{t('emptyTitle')}</div>
                <div className="text-[11px] text-slate-300 mt-1">
                  {mode === 'live' ? t('emptySubLive') : t('emptySubOffline')}
                </div>
              </div>
            </div>
          ) : (
            <div ref={feedRef}
                 className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(23rem,1fr))]">
              <AnimatePresence initial={false}>
                {groups.map((g) => (
                  <GroupCard key={g.i} g={g}
                             active={running && g.i === groups.length - 1} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* right: detection + attacks, pinned while the page scrolls */}
        <div className="sticky top-[3.75rem] space-y-2
                        max-h-[calc(100vh-4.5rem)] overflow-y-auto pr-1">
          <DetectPanel d={detect} curve={curve} />
          {/* LLM-backed attacks need the relay -- off in offline mode */}
          <AttackPanel attacks={health?.attacks ?? []} rate={rate} setRate={setRate}
            onAttack={runAttack} onMatrix={runMatrix} rows={rows} busy={busy}
            tau={health?.tau ?? 2} live={mode === 'live' && !!health?.live} />
        </div>
      </div>

      {/* jump-to-newest badge: appears only when the reader has scrolled away */}
      <AnimatePresence>
        {unseen > 0 && !follow && (
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }} onClick={jumpToLatest}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center
                       gap-1.5 rounded-full bg-slate-900/90 backdrop-blur px-3.5 py-2
                       text-[12px] font-semibold text-white shadow-lg
                       hover:bg-slate-900">
            <ArrowDown size={13} />
            {t('newGroups', { n: unseen })}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Shown instead of the dashboard on phones/tablets. */
function MobileGate() {
  const { t } = useI18n()
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center text-center
                    px-6 py-10 bg-canvas">
      <motion.img src={asset("paper/mascot.png")} alt="TRACE mascot"
        className="w-40 drop-shadow-[0_16px_28px_rgba(99,102,241,0.25)]"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />

      <div className="mt-6 font-display text-[15px] font-extrabold text-slate-900">
        <span className="text-l1-500">TRACE</span> Watermark
      </div>
      <h1 className="mt-4 font-display font-bold text-[22px] leading-snug text-slate-900 max-w-sm">
        {t('mobileTitle')}
      </h1>
      <p className="mt-3 text-[14px] leading-[1.7] text-slate-600 max-w-sm">
        {t('mobileBody')}
      </p>
      <a href="#/"
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-l1-500 text-white
                   px-5 py-2.5 text-[14px] font-semibold shadow-[0_10px_24px_-10px_rgba(99,102,241,.7)]
                   active:scale-[0.98] transition-transform">
        {t('mobileBack')}
      </a>
    </div>
  )
}
