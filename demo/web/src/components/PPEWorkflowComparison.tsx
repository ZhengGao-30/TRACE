import { useEffect, useRef, useState } from 'react'
import { BarChart3, Camera, Check, ChevronRight, Dices, Play, RotateCcw, ShieldCheck } from 'lucide-react'
import { DecisionInspector, trajectorySource } from './PairedWorkflowStrip'
import type { PairedTrajectoryStep, PairedWorkflowData } from './PairedWorkflowStrip'
import { PPE_PHASES, ppeActionMethodLabel } from '../lib/ppeInspection'
import { inspectionLabel, matchedRequirement, requirementKey } from '../lib/ppePlayback'
import type { ActionPlayback, PlaybackArm, PairedPlaybackState } from '../lib/ppePlayback'
import PPEWatermarkStory from './PPEWatermarkStory'

interface Props {
  pair: PairedWorkflowData
  current: number
  completedIndex: number
  running: boolean
  fullReplayComplete?: boolean
  playback: ActionPlayback | null
  watched: PairedPlaybackState['watched']
  onPlay: (source: PlaybackArm, index: number) => void
  onSelectCheck?: (key: string) => void
}

function ArmWorkflow({ source, steps, selected, next, playback, revealed, onSelect, onPlay, onDetails }: {
  source: PlaybackArm; steps: PairedTrajectoryStep[]; selected?: PairedTrajectoryStep; playback: ActionPlayback | null;
  next?: PairedTrajectoryStep;
  revealed: (step: PairedTrajectoryStep) => boolean; onSelect: (step: PairedTrajectoryStep) => void;
  onPlay: () => void; onDetails: () => void;
}) {
  const trace = source === 'trace'
  const strip = useRef<HTMLDivElement>(null)
  const active = playback?.source === source && playback.index === selected?.i
  const playing = active && ['restoring', 'playing'].includes(playback.status)
  const done = !!selected && revealed(selected)
  useEffect(() => {
    const item = strip.current?.querySelector<HTMLElement>('[aria-current="step"]')
    if (item && strip.current) strip.current.scrollLeft = item.offsetLeft - strip.current.offsetLeft - 12
  }, [selected?.i])
  return <section aria-label={`${trace ? 'With' : 'Without'} watermark workflow`} data-comparison-box={source} className={`rounded-xl border p-3 ${trace ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
    <div className="flex flex-wrap items-center gap-2">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${trace ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white'}`}>{trace ? 2 : 1}</span>
      <h3 className={`flex items-center gap-1.5 text-sm font-bold ${trace ? 'text-indigo-700' : 'text-slate-700'}`}>
        {trace ? <ShieldCheck size={15} /> : <Dices size={15} />}{trace ? 'With watermark' : 'Without watermark'}
      </h3>
      <span className="text-xs text-slate-400">{selected ? `Step ${selected.i + 1} / ${steps.length}` : 'No matching action'}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={onDetails} disabled={!done} aria-label={`How the ${trace ? 'watermarked' : 'unwatermarked'} action was chosen`}
          title={done ? 'View probabilities and selection' : 'Play this action to reveal its decision'} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-indigo-600 disabled:opacity-35"><BarChart3 size={16} /></button>
        <button type="button" disabled={!selected} onClick={onPlay} aria-label={`Play ${trace ? 'with' : 'without'} watermark step ${selected ? selected.i + 1 : ''}`}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 ${trace ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 hover:bg-slate-800'}`}>
          {playing ? <RotateCcw size={14} /> : <Play size={14} />}{playing ? 'Replay step' : active && playback.status === 'complete' ? 'Play again' : 'Play this step'}
        </button>
        <button type="button" onClick={() => next && onSelect(next)} disabled={!next} aria-label={`Next ${trace ? 'watermarked' : 'unwatermarked'} action`}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-indigo-600 disabled:opacity-30"><ChevronRight size={16} /></button>
      </div>
    </div>
    <div ref={strip} className="relative mt-2 flex items-stretch gap-2 overflow-x-auto pb-1" aria-label={`${trace ? 'Watermarked' : 'Unwatermarked'} recorded workflow`}>
      {steps.map((step, index) => <div key={step.i} className="flex shrink-0 items-center gap-2">
        {index > 0 && <ChevronRight size={12} className="text-slate-300" aria-hidden="true" />}
        <button type="button" onClick={() => onSelect(step)} aria-current={step.i === selected?.i ? 'step' : undefined}
          className={`flex w-48 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${step.i === selected?.i
            ? trace ? 'border-indigo-400 bg-white text-indigo-700' : 'border-slate-500 bg-white text-slate-800'
            : 'border-slate-200 bg-white/70 text-slate-500 hover:border-indigo-300'}`}>
          <span className="text-xs tabular-nums text-slate-400">{step.i + 1}</span>
          <span className="min-w-0">
            <span className="block leading-5">{inspectionLabel(step, revealed(step))}</span>
            {!/^record_ppe_/.test(step.action) && <span className="mt-1 block text-[11px] leading-4 text-slate-400">{ppeActionMethodLabel(step.action)}</span>}
          </span>
          {revealed(step) && <Check size={12} className="ml-auto shrink-0 text-emerald-600" />}
        </button>
      </div>)}
      {!steps.length && <p className="py-2 text-sm text-slate-400">No recorded action in this stage.</p>}
    </div>
  </section>
}

export default function PPEWorkflowComparison({ pair, current, completedIndex, running, fullReplayComplete = false, playback, watched, onPlay, onSelectCheck }: Props) {
  const [phaseId, setPhaseId] = useState(PPE_PHASES[0].id)
  const [key, setKey] = useState(() => requirementKey(pair.standard.steps[0]))
  const [details, setDetails] = useState<PlaybackArm | null>(null)
  const [following, setFollowing] = useState(true)
  const lastPlaybackToken = useRef<string | null>(null)
  const fullComplete = fullReplayComplete && !running && completedIndex === pair.trace.steps.length - 1
  const selected = matchedRequirement(pair, key)
  const phase = PPE_PHASES.find(item => item.id === phaseId) ?? PPE_PHASES[0]
  const revealed = (source: PlaybackArm, step?: PairedTrajectoryStep) => !!step && (
    watched[source].includes(step.i) || fullComplete || source === 'trace' && step.i <= completedIndex
  )
  const inspected = details ? selected[details] : undefined

  useEffect(() => { onSelectCheck?.(key) }, [key, onSelectCheck])

  useEffect(() => {
    if (!playback || playback.token === lastPlaybackToken.current) return
    lastPlaybackToken.current = playback.token
    const step = pair[playback.source].steps.find(step => step.i === playback.index)
    if (step) { setPhaseId(step.stage_id ?? PPE_PHASES[0].id); setKey(requirementKey(step)); setDetails(null) }
  }, [playback, pair])

  useEffect(() => {
    if (playback || !running || !following) return
    const step = pair.trace.steps.find(step => step.i === current)
    if (step) { setPhaseId(step.stage_id ?? PPE_PHASES[0].id); setKey(requirementKey(step)); setDetails(null) }
  }, [current, running, following, pair, !!playback])

  function select(step: PairedTrajectoryStep) {
    setFollowing(false)
    setKey(requirementKey(step)); setPhaseId(step.stage_id ?? phaseId); setDetails(null)
  }
  function selectPhase(id: string) {
    const step = pair.standard.steps.find(step => step.stage_id === id) ?? pair.trace.steps.find(step => step.stage_id === id)
    if (step) select(step)
  }

  return <section id="ppe-workflow-comparison" aria-label="Compare inspection workflows" className="scroll-mt-20 rounded-[1.4rem] border border-slate-200 bg-white/90 p-3.5 shadow-[0_16px_50px_-38px_rgba(15,23,42,.35)]">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="text-base font-bold text-slate-800">Compare the inspection</h2>
      <p className="text-xs text-slate-500">Two recorded runs · one shared 3D scene</p>
      {running && !following && <button type="button" onClick={() => setFollowing(true)} className="ml-auto rounded-full border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-600">Follow replay</button>}
      {playback && <span role="status" className="ml-auto text-xs font-medium text-indigo-600">{playback.source === 'trace' ? 'With watermark' : 'Without watermark'} · step {playback.index + 1} · {playback.status === 'restoring' ? 'restoring' : playback.status === 'playing' ? 'playing' : playback.status === 'error' ? 'stopped; retry this action' : 'complete'}</span>}
    </div>
    <nav aria-label="Shared inspection stages" className="mb-3 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
      {PPE_PHASES.map((item, index) => <button type="button" key={item.id} onClick={() => selectPhase(item.id)} aria-current={phaseId === item.id ? 'step' : undefined}
        className={`flex min-w-max flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold ${phaseId === item.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white'}`}>
        <span className="text-slate-400">{index + 1}</span>{item.title}
      </button>)}
    </nav>
    <div className="space-y-2.5">
      {(['standard', 'trace'] as const).map(source => <div key={source}>
        <ArmWorkflow source={source} steps={pair[source].steps} selected={selected[source]}
          next={selected[source] ? pair[source].steps[pair[source].steps.findIndex(step => step.i === selected[source]!.i) + 1] : undefined}
          playback={playback} revealed={step => revealed(source, step)} onSelect={step => { select(step); if (revealed(source, step)) setDetails(source) }}
          onPlay={() => selected[source] && onPlay(source, selected[source]!.i)}
          onDetails={() => setDetails(previous => previous === source ? null : source)} />
        {details === source && inspected && revealed(source, inspected) && <DecisionInspector source={source} step={inspected} phaseTitle={phase.title} onClose={() => setDetails(null)} />}
      </div>)}
      <div className="flex flex-col gap-2.5">
        <section data-comparison-box="difference" className="rounded-2xl border border-indigo-100 bg-white p-3.5">
          <PPEWatermarkStory pair={pair} selected={selected} revealed={revealed} onSelect={select} />
        </section>
        <section data-comparison-box="photo" className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-3.5">
          <div className="flex flex-wrap items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">4</span><h3 className="text-sm font-bold text-slate-700">Photo watermark</h3><span className="text-xs font-medium text-slate-400">Digital Asset Watermark · not connected</span><Camera size={16} className="ml-auto text-slate-400" /></div>
          <p className="mt-2 text-sm text-slate-500">Reserved for image watermarking. This record contains simulated observations, not captured image files.</p>
        </section>
      </div>
    </div>
    <details className="mt-3 text-xs leading-5 text-slate-400"><summary className="cursor-pointer">About these records · {trajectorySource(pair).label} · PPE-4B.2</summary>
      <p className="mt-1">Synthetic pre-entry PPE inspection. Action probabilities are normalized model-elicited weights over legal actions, not token probabilities. Single-step playback loads an existing record; it does not run the model again or add to the full TRACE detection log.</p>
    </details>
  </section>
}
