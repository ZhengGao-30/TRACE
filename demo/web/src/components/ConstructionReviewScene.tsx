import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, FileText, Focus, Maximize2, Minimize2, MousePointer2, Pause, Play, RotateCcw, ScanEye, View } from 'lucide-react'
import type { GroupView } from './GroupCard'
import type { PairedWorkflowData } from './PairedWorkflowStrip'
import ConstructionScene from '../three/ConstructionScene'
import type { ConstructionCameraMode } from '../three/ConstructionScene'
import { EVIDENCE_STATIONS, evidenceStation, gateShiftSceneResults, isEntryReplayComplete, isShiftReplayComplete, recordedWorldEvents, reviewActionMode, reviewResumePose, shiftWorldFrame, siteEventAt, stationForReview } from '../lib/constructionScene'
import type { EvidenceStationId, ShiftSceneStep } from '../lib/constructionScene'

interface ReviewGroup extends GroupView {
  stage_id?: string
  label?: string
  evidence_ids?: string[]
  event_kind?: string
  station_id?: string
}

interface ConstructionReviewSceneProps {
  pair: PairedWorkflowData | null

  groups: ReviewGroup[]
  running?: boolean
  caseId?: string
  speed?: number
  replayEpoch?: number
  onActionComplete?: (stepIndex: number) => void
}

function resultOf(group?: ReviewGroup) {
  return group?.result?.trim()
    || group?.observations.find((observation) => !observation.confirm && observation.text.trim())?.text.trim()
    || ''
}

function sourceLabel(id: string) {
  return id.replace(/^E\d+-/, '').replace(/[-_]/g, ' ')
}

export default function ConstructionReviewScene({ pair, groups, running = false, caseId, speed = 1, replayEpoch = 0, onActionComplete }: ConstructionReviewSceneProps) {
  const reducedMotion = !!useReducedMotion()
  const id = caseId ?? pair?.case_id ?? pair?.game_id ?? ''
  const pairMatchesCase = !caseId || caseId === pair?.case_id || caseId === pair?.game_id
  const shift = pairMatchesCase && pair?.task_type === 'construction_ppe_shift'
  const variant = pair?.visual_variant === 'timber-yard' || id.includes('CS02') ? 'timber-yard' : 'scaffold'
  const [mode, setMode] = useState<'evidence' | 'reconstruction'>('evidence')
  const [previewStation, setPreviewStation] = useState<EvidenceStationId>('entry')
  const [previewAction, setPreviewAction] = useState(0)
  const [cameraMode, setCameraMode] = useState<ConstructionCameraMode>('overview')
  const [cameraRevision, setCameraRevision] = useState(0)
  const [eventPosition, setEventPosition] = useState(0)
  const [eventPlaying, setEventPlaying] = useState(false)
  const [arrivedToken, setArrivedToken] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const eventPositionRef = useRef(0)

  const executedGroups = pairMatchesCase && (shift || pair?.task_type === 'construction_ppe_entry_check') ? groups : []
  const current = executedGroups[executedGroups.length - 1]
  const command = current?.chosen ?? current?.observations.find((observation) => !observation.confirm)?.command
  const pairedStep = pairMatchesCase ? pair?.trace.steps.find((step) => step.i === current?.i && step.action === command) : undefined
  const sceneStep = pairedStep as ShiftSceneStep | undefined
  const injected = shift && (current?.event_kind ?? sceneStep?.event_kind) === 'injected_action'
  const tabletAction = reviewActionMode(command, injected) === 'tablet'
  const hasRun = !!current
  const actionToken = current ? `${shift ? 'shift' : 'entry'}:${id}:${replayEpoch}:${current.i}:${command ?? ''}` : `preview:${id}:${previewAction}`
  const actionTokenRef = useRef(actionToken)
  actionTokenRef.current = actionToken
  const completedGroups = shift ? gateShiftSceneResults(executedGroups, arrivedToken === actionToken) : executedGroups
  const resultGroup = completedGroups[completedGroups.length - 1]
  const actualStation = stationForReview(command, current?.station_id ?? sceneStep?.station_id)
  const selectedStation = hasRun ? actualStation : evidenceStation(previewStation)
  const liveWorld = shiftWorldFrame(shift ? pair?.trace.steps as ShiftSceneStep[] ?? [] : [], completedGroups)
  const events = shift ? liveWorld.events : pairMatchesCase && pair?.task_type === 'construction_ppe_entry_check' ? recordedWorldEvents(pair.trace.report) : []
  const replayComplete = shift ? isShiftReplayComplete(running, pair?.trace.steps ?? [], completedGroups)
    : isEntryReplayComplete(pair?.task_type, running, pair?.trace.steps ?? [], executedGroups)
  const canReplayEvents = replayComplete && events.length > 0
  const showEvents = mode === 'reconstruction' && canReplayEvents
  const sceneMode = showEvents ? 'reconstruction' : hasRun ? 'review' : 'preview'
  const eventFrame = showEvents ? siteEventAt(events, eventPosition) : undefined
  const actualResult = resultOf(resultGroup)
  const hasResult = !!actualResult
  const actionLabel = current?.label ?? pairedStep?.label ?? command?.replace(/_/g, ' ')
  const sourceIds = hasResult ? current?.evidence_ids ?? pairedStep?.evidence_ids ?? [] : []
  const readSources = new Set(completedGroups.filter((group) => !!resultOf(group)).flatMap((group) => group.evidence_ids ?? []))
  const stageTitle = pair?.stages?.find((stage) => stage.id === (current?.stage_id ?? current?.phase ?? pairedStep?.stage_id))?.title
  const inertRecorded = current?.observations.some((observation) => observation.confirm)

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    expandButtonRef.current?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setExpanded(false)
        return
      }
      if (event.key !== 'Tab') return
      const controls = [...(sectionRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => element.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first || !last) return
      if (event.shiftKey && (document.activeElement === first || !sectionRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !sectionRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [expanded])

  useEffect(() => {
    setMode('evidence'); setEventPlaying(false); setEventPosition(0)
    eventPositionRef.current = 0
    setPreviewStation('entry'); setPreviewAction(0)
    setCameraMode('overview'); setCameraRevision((value) => value + 1)
  }, [id])

  useEffect(() => {
    if (!hasRun) setArrivedToken(null)
  }, [id, hasRun])



  useEffect(() => {
    if (!hasRun) return
    setMode('evidence')
    setEventPlaying(false)
  }, [actionToken, hasRun])

  useEffect(() => {
    if (!running) return
    setMode('evidence'); setEventPlaying(false)
    setCameraMode('follow')
  }, [running])

  useEffect(() => {
    if (!eventPlaying || !canReplayEvents) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const delta = Math.min(.1, (now - previous) / 1000)
      previous = now

      eventPositionRef.current = Math.min(1, eventPositionRef.current + delta / (events.length * 3))
      setEventPosition(eventPositionRef.current)
      if (eventPositionRef.current >= 1) setEventPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [eventPlaying, canReplayEvents, events.length])

  const onCameraInteract = useCallback(() => setCameraMode('free'), [])
  const completeAction = useCallback((token: string) => {
    if (current && token === actionTokenRef.current && sceneMode === 'review') {
      setArrivedToken(token)
      onActionComplete?.(current.i)
    }
  }, [current?.i, onActionComplete, sceneMode])

  function chooseView(next: 'overview' | 'follow' | 'detail') {
    setCameraMode(next); setCameraRevision((value) => value + 1)
  }

  function chooseStation(station: EvidenceStationId) {
    if (hasRun || running) return
    setMode('evidence'); setEventPlaying(false)
    setPreviewStation(station); setPreviewAction((value) => value + 1)
  }

  function seekEvent(index: number) {
    if (!canReplayEvents) return
    setMode('reconstruction'); setEventPlaying(false)

    const position = index >= events.length - 1 ? 1 : (index + .999999) / events.length
    eventPositionRef.current = position; setEventPosition(position)
    chooseView('detail')
  }

  function playEvent() {
    if (!canReplayEvents) return
    if (mode === 'reconstruction' && eventPlaying) { setEventPlaying(false); return }
    setMode('reconstruction')
    if (mode !== 'reconstruction' || eventPositionRef.current >= 1) {
      eventPositionRef.current = 0; setEventPosition(0); chooseView('detail')
    }
    setEventPlaying(true)
  }



  return <section ref={sectionRef} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}
    aria-label={expanded ? 'Expanded construction scene' : undefined}
    className={`flex flex-col bg-white ${expanded ? 'fixed inset-0 z-[100] h-[100dvh] min-h-0 overflow-y-auto overscroll-contain' : 'h-full min-h-[500px] overflow-hidden rounded-[1.15rem]'}`}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-500"><ScanEye size={17} /></span>
        <div><h2 className="text-[13px] font-bold text-slate-800">{shift ? 'Construction safety shift' : variant === 'scaffold' ? 'Scaffold entry check' : 'Timber-yard entry check'}</h2>
          <p className="mt-0.5 text-[10px] text-slate-400">{shift ? 'On-duty robot + evolving site · simulated shift' : 'Recorded decisions → site events · synthetic case'}</p></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-full bg-slate-100 p-1 text-[10px] font-semibold">
          <button type="button" onClick={() => { setMode('evidence'); setEventPlaying(false); chooseView(hasRun ? 'follow' : 'overview') }}
            className={`rounded-full px-3 py-1.5 transition-colors ${!showEvents ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}>
            {hasRun ? shift ? 'Live shift' : 'Agent checks' : 'Explore scene'}
          </button>
          <button type="button" disabled={!canReplayEvents} onClick={() => seekEvent(0)}
            title={canReplayEvents ? 'Review the recorded site event timeline' : shift ? 'Site events appear during the shift; finish to review the full timeline' : 'Finish the recorded agent replay to unlock site events'}
            className={`rounded-full px-3 py-1.5 transition-colors disabled:opacity-35 ${showEvents ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}>
            {shift ? 'Event history' : 'Site events'}
          </button>
        </div>
        <button ref={expandButtonRef} type="button" onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? 'Exit expanded scene' : 'Expand scene'} aria-expanded={expanded}
          title={expanded ? 'Exit expanded scene (Esc)' : 'Expand scene'}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
          {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
    </div>

    <div className={`grid flex-1 grid-cols-[minmax(0,1fr)_minmax(230px,27%)] max-[800px]:grid-cols-1 ${expanded ? 'min-h-[420px] shrink-0 max-[800px]:min-h-fit' : 'min-h-0 max-[800px]:overflow-y-auto'}`}>
      <div className="flex min-h-0 flex-col border-r border-slate-100 max-[800px]:min-h-[400px] max-[800px]:border-r-0">
        <div className="relative min-h-[290px] flex-1 overflow-hidden bg-[#eeece6]">
          <ConstructionScene key={id || variant} variant={variant} mode={sceneMode}
            stationId={selectedStation?.id} command={hasRun ? command : undefined} actionToken={actionToken}
            replayEpoch={replayEpoch}
            initialRobotPose={reviewResumePose(pairMatchesCase ? pair?.trace.steps ?? [] : [], completedGroups)}
            shift={shift} liveWorld={shift ? liveWorld : undefined} injectedAction={injected}
            worldEvent={eventFrame?.event} previousWorldEvent={eventFrame?.previous}
            eventProgress={reducedMotion ? 1 : eventFrame?.progress}
            cameraMode={cameraMode} cameraRevision={cameraRevision} speed={speed} reducedMotion={reducedMotion}
            onStationSelect={chooseStation} onCameraInteract={onCameraInteract} onActionComplete={completeAction} />

          <div className="pointer-events-none absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold backdrop-blur-sm ${sceneMode === 'preview' ? 'border-amber-200 bg-amber-50/95 text-amber-700' : 'border-white/80 bg-white/85 text-slate-600'}`}>
              {showEvents ? shift ? 'Recorded world events · simulated shift' : 'With watermark · recorded site events'
                : hasRun ? shift ? injected ? 'Injected controller action · no watermark' : 'On-duty agent · recorded main action' : 'With watermark · entry checks at the time' : 'Scene preview · no agent run'}
            </span>
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/90 bg-white/85 p-1 shadow-sm backdrop-blur-sm">
              {(showEvents || shift && liveWorld.state?.contact) && <button type="button" onClick={() => chooseView('detail')} title="Focus on the worker’s recorded location"
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${cameraMode === 'detail' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}><Focus size={11} />Detail</button>}
              <button type="button" onClick={() => chooseView('overview')} title="Return to the overview"
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${cameraMode === 'overview' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}><View size={11} />Overview</button>
              {(!showEvents || shift) && <button type="button" onClick={() => chooseView('follow')} title="Follow the on-duty robot"
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${cameraMode === 'follow' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}><Focus size={11} />Follow</button>}
            </div>
          </div>
          <span className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-[9px] text-slate-500 backdrop-blur-sm"><MousePointer2 size={10} />Drag to look around · scroll to zoom</span>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          {showEvents ? <>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[9px] font-semibold text-slate-400">LOGGED EVENT {(eventFrame?.index ?? 0) + 1} / {events.length}</span>
              <button type="button" disabled={!canReplayEvents} onClick={playEvent} className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40">
                {eventPlaying ? <Pause size={11} /> : eventPosition >= 1 ? <RotateCcw size={11} /> : <Play size={11} />}
                {eventPlaying ? 'Pause' : eventPosition >= 1 ? 'Replay site events' : 'Play site events'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">{events.map((item, index) => <button type="button" key={item.id} onClick={() => seekEvent(index)} disabled={!canReplayEvents}
              className={`rounded-lg px-2 py-2 text-left text-[10px] font-semibold transition-colors ${eventFrame?.index === index ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
              <span className="mr-1.5 text-[8px] opacity-50">{index + 1}</span>{item.title}
            </button>)}</div>
          </> : <>
            <div className="mb-2 flex items-center justify-between gap-2 text-[9px]">
              <span className="font-semibold text-slate-500">{hasRun ? tabletAction ? 'Handheld tablet · working in place' : shift ? `On duty · worker ${liveWorld.state?.worker_state ?? 'waiting'}` : 'Current check · worker waiting at entry' : 'Choose a station to preview the robot'}</span>
              <button type="button" disabled={!canReplayEvents} onClick={playEvent} className="flex items-center gap-1 text-indigo-500 disabled:opacity-35"><Play size={10} />Replay site events</button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">{EVIDENCE_STATIONS.map((station) => <button type="button" key={station.id} disabled={hasRun || running} onClick={() => chooseStation(station.id)}
              className={`rounded-lg px-1 py-2 text-[10px] font-semibold transition-colors ${!tabletAction && selectedStation?.id === station.id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'bg-slate-50 text-slate-400 enabled:hover:bg-slate-100'}`}>
              {shift && station.id === 'report' ? 'Report' : station.shortLabel}
            </button>)}</div>
          </>}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col bg-[#fafbfe] max-[800px]:min-h-[250px]">
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wide text-indigo-600">{showEvents ? shift ? 'RECORDED EVENT HISTORY' : 'AFTER THE DECISION' : hasRun ? shift ? injected ? 'FAULT CONTROLLER' : 'ON-DUTY SAFETY AGENT' : 'ENTRY-CHECKING AGENT' : 'SCENE PREVIEW'}</span>
            {running && <span className="flex items-center gap-1.5 text-[9px] text-slate-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />Replaying</span>}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{showEvents ? 'Only this run’s recorded world events are shown. These are not agent actions.' : hasRun ? shift ? injected ? 'A scripted gate fault is executed by the test controller. The on-duty robot remains at its post.' : 'The same robot checks admission, patrols the work area and responds to observations during its shift.' : 'Replay what the agent observed and decided before entry. No future incident is shown to the agent.' : 'Explore the model only. No decision or incident outcome is assumed.'}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
          {showEvents && eventFrame ? <div>
            <p className="text-[9px] font-medium text-amber-600">Event {eventFrame.index + 1} / {events.length} · {eventFrame.event.timestamp}</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-800">{eventFrame.event.title}</h3>
            <p className="mt-4 text-[12px] leading-[1.8] text-slate-600">{eventFrame.event.description}</p>
            <div className="mt-5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[10px] leading-relaxed text-slate-600">
              Recorded worker state: <span className="font-semibold">{eventFrame.event.worker_state}</span><br />
              Recorded timber state: <span className="font-semibold">{eventFrame.event.timber_state}</span>
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-slate-400">Watermark detection supports log-source attribution. Checking the decision against the observations and rules is a separate step.</p>
          </div> : current ? <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${id}-${current.i}-${hasResult}`} initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .2 }}>
              <p className="text-[9px] text-slate-400">Step {current.i + 1}{pair?.trace.steps.length ? ` / ${pair.trace.steps.length}` : ''}{stageTitle ? ` · ${stageTitle}` : ''}</p>
              <h3 className="mt-2 text-[17px] font-semibold leading-snug tracking-tight text-slate-800">{actionLabel ?? 'Performing the next check'}</h3>
              {tabletAction && <p className="mt-2 text-[10px] text-indigo-500">On the handheld tablet · no trip to a records desk.</p>}
              {injected && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-700">Controlled fault · excluded from agent watermark attribution.</p>}
              {hasResult ? <div className="mt-4 border-l-2 border-indigo-200 pl-3.5"><p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-400">Recorded result</p><p className="whitespace-pre-line text-[11px] leading-[1.8] text-slate-600">{actualResult}</p></div>
                : <p className="mt-4 text-[11px] leading-relaxed text-slate-400">{shift && arrivedToken !== actionToken ? injected ? 'The controller transaction is in progress.' : 'The on-duty robot is carrying out this action. Its recorded result appears on completion.' : 'The recorded source result has not arrived yet.'}</p>}
              {shift && liveWorld.state && <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[10px] leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-700">World state · {liveWorld.state.timestamp}</p>
                <p>Worker: <span className="font-semibold">{liveWorld.state.worker_state}</span> · Timber: <span className="font-semibold">{liveWorld.state.timber_state}</span></p>
                {liveWorld.state.contact && <p className="text-amber-700">Simulated serious foot injury · non-graphic depiction.</p>}
                <p className="border-t border-slate-100 pt-2 text-indigo-600">{liveWorld.incidentObserved
                  ? `Agent learned of injury at ${liveWorld.observedAt}`
                  : liveWorld.state.contact ? 'Agent knowledge: injury not yet discovered.' : 'Agent knowledge follows the observations received so far.'}</p>
                {!!liveWorld.events.length && <p className="text-[9px] text-slate-400">Latest world event: {liveWorld.events[liveWorld.events.length - 1].title} · {liveWorld.events[liveWorld.events.length - 1].timestamp}</p>}
              </div>}
              {!!sourceIds.length && <div className="mt-5 space-y-2"><p className="text-[9px] font-semibold text-slate-400">Sources in this step</p>{sourceIds.map((source) => <div key={source} className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
                <FileText size={14} className="mt-0.5 shrink-0 text-indigo-400" /><div className="min-w-0"><p className="text-[10px] font-medium capitalize text-slate-600">{sourceLabel(source)}</p><p className="mt-1 break-all font-mono text-[8px] text-slate-400">{source}</p></div><Check size={11} className="ml-auto mt-0.5 shrink-0 text-emerald-500" />
              </div>)}</div>}
              {inertRecorded && <p className="mt-4 rounded-lg bg-violet-50 px-3 py-2 text-[10px] leading-relaxed text-violet-600">Read-only record appended · no new visit or business check.</p>}
              {canReplayEvents && <button type="button" onClick={playEvent} className="mt-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-indigo-600"><Play size={12} />Replay site events</button>}
            </motion.div>
          </AnimatePresence> : <div>
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-semibold text-amber-700">No agent run</span>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-800">{shift && selectedStation?.id === 'report' ? 'Shift records and reports' : selectedStation?.title ?? 'Explore the site'}</h3>
            <p className="mt-4 text-[12px] leading-[1.8] text-slate-600">{shift && selectedStation?.id === 'timber'
              ? 'The on-duty robot visits this work area during its patrol. Site activity appears as each main action advances the recorded clock.'
              : shift && selectedStation?.id === 'report' ? 'Explore the reporting point. During replay, the robot records assessments and submits reports on its handheld tablet without leaving its current position.' : selectedStation?.preview}</p>
            <p className="mt-4 text-[10px] leading-relaxed text-slate-400">Click the ground labels or the station buttons to see the robot move and inspect. Actual source results appear only during a recorded agent replay.</p>
            <p className="mt-5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[10px] leading-relaxed text-slate-500">{shift ? 'Site activity will advance with recorded main actions during the shift. The worker stays at the checkpoint during preview.' : 'Site events unlock after a recorded entry-check run finishes. The worker stays at the checkpoint during preview.'}</p>
          </div>}
        </div>
        <div className="shrink-0 border-t border-slate-100 px-5 py-3 text-[9px] leading-relaxed text-slate-400">
          {hasRun && !showEvents && <div className="mb-1 font-medium text-slate-500">{readSources.size} source records opened</div>}
          {showEvents ? '3D illustrates logged states, not camera footage. Playback duration is illustrative.' : hasRun ? shift ? 'Simulated site state advances with main actions. Read-only L2 records do not advance time or move the robot.' : 'Checks and decisions come from this run’s log. Site events play separately afterward.' : 'Preview has no action probabilities, entry decision or success outcome.'}
        </div>
      </aside>
    </div>
  </section>
}
