import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import type { PairedTrajectoryStep, PairedWorkflowData } from './PairedWorkflowStrip'
import { inspectionLabel } from '../lib/ppePlayback'
import type { ActionPlayback, PlaybackArm } from '../lib/ppePlayback'
import { ppeActionMethodLabel } from '../lib/ppeInspection'
import { PPE_ACTION_CATEGORIES, ppeActionCategory, ppePathDifferences } from '../lib/ppePaths'
import PPEChoiceComparison from './PPEChoiceComparison'
import './PPEActionPaths.css'

export interface PPEActionPathsProps {
  pair: PairedWorkflowData
  selected: { standard?: PairedTrajectoryStep; trace?: PairedTrajectoryStep }
  playback: ActionPlayback | null
  current: number
  completedIndex: number
  running: boolean
  revealed: (source: PlaybackArm, step?: PairedTrajectoryStep) => boolean
  onSelect: (source: PlaybackArm, step: PairedTrajectoryStep) => void
}

type Point = [number, number]
type Preview = { key: string; progress: number; playing: boolean }
const ARMS: PlaybackArm[] = ['standard', 'trace']
const armName = (source: PlaybackArm) => source === 'trace' ? 'With watermark' : 'Without watermark'

function controls(a: Point, b: Point, vertical: boolean): [Point, Point] {
  return vertical
    ? [[a[0], (a[1] + b[1]) / 2], [b[0], (a[1] + b[1]) / 2]]
    : [[(a[0] + b[0]) / 2, a[1]], [(a[0] + b[0]) / 2, b[1]]]
}

function route(points: Point[], vertical: boolean) {
  return points.reduce((path, point, index) => {
    if (!index) return `M${point.join(',')}`
    const [a, b] = controls(points[index - 1], point, vertical)
    return `${path} C${a.join(',')} ${b.join(',')} ${point.join(',')}`
  }, '')
}

function cursor(points: Point[], progress: number, vertical: boolean): Point {
  const bounded = Math.max(0, Math.min(progress, points.length - 1))
  const index = Math.min(Math.floor(bounded), points.length - 2)
  const u = bounded - index, v = 1 - u
  const a = points[index], b = points[index + 1]
  const [c, d] = controls(a, b, vertical)
  return [0, 1].map(axis => v ** 3 * a[axis] + 3 * v * v * u * c[axis]
    + 3 * v * u * u * d[axis] + u ** 3 * b[axis]) as Point
}

export default function PPEActionPaths({ pair, selected, playback, current, completedIndex, running, revealed, onSelect }: PPEActionPathsProps) {
  const reducedMotion = !!useReducedMotion()
  const graph = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const [preview, setPreview] = useState<Preview | null>(null)
  const titleId = useId(), descriptionId = useId()
  const total = Math.max(pair.standard.steps.length, pair.trace.steps.length)
  const vertical = width < 590
  const graphHeight = vertical ? 239 + Math.max(0, total - 1) * 20 : 335
  const identity = pair.game_id ?? pair.case_id ?? ''
  const controlKey = JSON.stringify([identity, selected.standard?.i, selected.standard?.action,
    selected.trace?.i, selected.trace?.action, playback?.token, playback?.source, playback?.index,
    playback?.status, current, completedIndex, running])
  const local = preview?.key === controlKey ? preview : null
  const actualPlaying = running || !!playback && ['restoring', 'playing'].includes(playback.status)
  const differences = useMemo(() => ppePathDifferences(pair), [pair])

  function differenceFor(source: PlaybackArm, step: PairedTrajectoryStep) {
    const difference = differences[source].get(step.i)!
    const otherSource = source === 'standard' ? 'trace' : 'standard'
    const conclusion = /^record_ppe_(pass|fail|hold)$/.test(step.action)
      || /^record_ppe_(pass|fail|hold)$/.test(difference.counterpart?.action ?? '')
    const pending = conclusion && difference.methodChanged
      && !(revealed(source, step) && revealed(otherSource, difference.counterpart))
    const methodChanged = difference.methodChanged && !pending
    // Position already shows execution order. Only action differences receive a ring.
    return { ...difference, methodChanged, pending,
      emphasized: difference.missing || methodChanged }
  }

  useEffect(() => {
    const element = graph.current
    if (!element) return
    const measure = () => setWidth(Math.max(1, element.getBoundingClientRect().width))
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { setPreview(null) }, [controlKey])

  useEffect(() => {
    if (!local?.playing) return
    let frame = 0, previousTime: number | null = null
    const tick = (time: number) => {
      const elapsed = previousTime === null ? 0 : Math.min(80, time - previousTime)
      previousTime = time
      setPreview(value => {
        if (!value || value.key !== controlKey || !value.playing) return value
        const progress = Math.min(total + 1, value.progress + elapsed / 560)
        return { ...value, progress, playing: progress < total + 1 }
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [local?.playing, controlKey, total])

  useEffect(() => {
    if (reducedMotion) setPreview(value => value?.playing ? { ...value, playing: false } : value)
  }, [reducedMotion])

  const geometry = useMemo(() => {
    const start: Point = vertical ? [width / 2, 138] : [14, 179]
    const end: Point = vertical ? [width / 2, graphHeight - 39] : [width - 14, 179]
    const paths = {} as Record<PlaybackArm, Point[]>
    for (const source of ARMS) {
      const steps = pair[source].steps
      const points: Point[] = steps.map((step, index) => {
        const offset = PPE_ACTION_CATEGORIES[ppeActionCategory(step)].offset
        return vertical
          ? [(source === 'standard' ? width * .25 : width * .75) + offset * .55, 168 + index * 20]
          : [steps.length > 1 ? 58 + index * (width - 116) / (steps.length - 1) : width / 2,
            (source === 'standard' ? 94 : 264) + offset]
      })
      paths[source] = [start, ...points, end]
    }
    return { paths, start, end }
  }, [pair, width, vertical, graphHeight])

  const views = ARMS.map(source => {
    const steps = pair[source].steps
    const chosen = selected[source]
    const chosenIndex = chosen ? steps.findIndex(step => step.i === chosen.i && step.action === chosen.action) : -1
    const progress = local ? Math.min(local.progress, steps.length + 1) : chosenIndex + 1
    const stepIndex = Math.min(steps.length - 1, Math.max(0, Math.ceil(progress) - 1))
    const step = progress > 0 && progress < steps.length + 1 ? steps[stepIndex] : undefined
    const ready = !!step && revealed(source, step)
    const name = step ? inspectionLabel(step, ready) : !steps.length ? 'No recorded actions'
      : progress <= 0 ? 'Start' : 'End of path'
    const method = step ? ppeActionMethodLabel(step.action, ready) : ''
    return { source, steps, progress, step, stepIndex, name, method,
      difference: step ? differenceFor(source, step) : undefined,
      position: cursor(geometry.paths[source], progress, vertical) }
  })
  const sliderValue = local ? Math.round(local.progress) : Math.round(views.find(view => view.source === (playback?.source ?? 'trace'))?.progress ?? 0)
  const selectedSamePosition = views[0].progress === views[1].progress
  const positionLabel = local || selectedSamePosition ? `${Math.min(total, sliderValue)} / ${total}` : 'Selected check'
  const valueText = views.map(view => `${armName(view.source)}${view.step ? `, step ${view.stepIndex + 1}` : ''}: ${view.name}${view.method ? `, ${view.method}` : ''}`).join('. ')
  const selectedDifference = !local ? (views[0].difference ?? views[1].difference) : undefined
  const differenceLabel = !selectedDifference ? 'Differences circled'
    : selectedDifference.missing ? 'No matching check'
      : selectedDifference.pending ? 'Selected check'
        : selectedDifference.methodChanged && selectedDifference.orderChanged ? 'Method & order changed'
          : selectedDifference.methodChanged ? 'Different method'
            : selectedDifference.orderChanged ? 'Same method · different order' : 'Same method & order'

  function previewPaths() {
    if (local?.playing) { setPreview({ ...local, playing: false }); return }
    const progress = !local || local.progress >= total + 1 ? 0 : local.progress
    setPreview({ key: controlKey, progress: reducedMotion ? total + 1 : progress, playing: !reducedMotion })
  }

  function select(source: PlaybackArm, step: PairedTrajectoryStep) {
    setPreview(null)
    onSelect(source, step)
  }

  return <div className="ppe-action-paths" data-vertical={vertical} data-preview={!!local}>
    <div className="pap-heading">
      <span className="pap-number" aria-hidden="true">3</span>
      <h3 id={titleId}>What changed?</h3>
      <button type="button" className="pap-play" onClick={previewPaths} disabled={!total || actualPlaying}
        aria-label={local?.playing ? 'Pause path preview' : 'Preview paths'} aria-pressed={!!local?.playing}
        title={actualPlaying ? 'Path preview is paused during inspection replay' : 'Preview the paths without playing inspection actions'}>
        {local?.playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
        <span>{local?.playing ? 'Pause preview' : 'Preview paths'}</span>
      </button>
    </div>
    <div className="pap-legend" aria-label="Action colors">
      {Object.entries(PPE_ACTION_CATEGORIES).map(([category, spec]) => <span key={category}>
        <i className="pap-swatch" style={{ backgroundColor: spec.color }} aria-hidden="true" />{spec.label}
      </span>)}
      <span className="pap-difference" role="status">{differenceLabel}</span>
    </div>
    <div className="pap-graph" ref={graph}>
      <svg className="pap-drawing" viewBox={`0 0 ${width} ${graphHeight}`} height={graphHeight}
        role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <desc id={descriptionId}>Two recorded paths share a start and a save-report endpoint. Each dot is one recorded action.
          {vertical ? ' Execution order runs from top to bottom; action category sets each dot’s color and sideways offset.'
            : ' Execution order runs from left to right; action category sets each dot’s color and height.'}
          All dots have the same size and retain their action category color. Highlight rings mark a different action or method for the same check; a change in order alone has no ring.
          A small grey pointer marks the selected or previewed position without changing the dot.
          This shows execution choices, not a watermark detection result. Select a dot to inspect its action.</desc>
        {ARMS.map(source => <path key={source} d={route(geometry.paths[source], vertical)} className="pap-route" />)}
        {views.map(view => <g key={view.source} aria-label={armName(view.source)}>
          {view.steps.map((step, index) => {
            const point = geometry.paths[view.source][index + 1]
            const spec = PPE_ACTION_CATEGORIES[ppeActionCategory(step)]
            const ready = revealed(view.source, step)
            const label = inspectionLabel(step, ready), method = ppeActionMethodLabel(step.action, ready)
            const active = view.step?.i === step.i
            const difference = differenceFor(view.source, step)
            const change = difference.missing ? 'missing' : difference.methodChanged && difference.orderChanged ? 'method-order'
              : difference.methodChanged ? 'method' : difference.orderChanged ? 'order' : 'none'
            return <g key={`${step.i}:${step.action}`} role="button" tabIndex={0} className="pap-hit"
              aria-label={`${armName(view.source)} step ${index + 1}: ${label}${method ? ` · ${method}` : ''}`}
              aria-current={active ? 'step' : undefined} data-path-arm={view.source} data-action-index={step.i} data-path-change={change}
              onClick={() => select(view.source, step)} onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(view.source, step) }
              }}>
              <title>{`${index + 1}. ${label}${method ? ` · ${method}` : ''}`}</title>
              <circle cx={point[0]} cy={point[1]} r={10} fill="transparent" className="pap-touch" />
              {difference.emphasized && <circle cx={point[0]} cy={point[1]} r={10} fill="none" className="pap-change-ring" />}
              <circle cx={point[0]} cy={point[1]} r={5} fill={spec.color} className="pap-node" />
            </g>
          })}
        </g>)}
        {[geometry.start, geometry.end].map((point, index) => <g key={index} aria-hidden="true">
          <circle cx={point[0]} cy={point[1]} r={5} className="pap-end" />
          <text x={vertical ? point[0] : index === 0 ? 0 : width}
            y={vertical ? point[1] + (index === 0 ? -13 : 24) : point[1] + 22}
            className="pap-end-label" textAnchor={vertical ? 'middle' : index === 0 ? 'start' : 'end'}>{index === 0 ? 'Start' : 'Save report'}</text>
        </g>)}
        {views.map(view => <g key={view.source} aria-hidden="true" className="pap-marker" data-marker-arm={view.source}>
          <path d={`M${view.position[0] - 3.5},${view.position[1] - 18} h7 l-3.5,5 Z`} fill="#687684" className="pap-position-marker" />
        </g>)}
      </svg>
      {views.map(view => <div className="pap-caption" data-arm={view.source} key={view.source}>
        <span className="pap-arm">{armName(view.source)}{view.step && <span className={`pap-step${view.difference?.orderChanged ? ' pap-step-changed' : ''}`}>Step {view.stepIndex + 1}</span>}</span>
        <div className="pap-action"><span className="pap-action-name">{view.name}</span><span className={`pap-method${view.difference?.methodChanged ? ' pap-method-changed' : ''}`}>{view.method}</span></div>
      </div>)}
    </div>
    <div className="pap-scrub">
      <span className="pap-position">{positionLabel}</span>
      <input type="range" min={0} max={total + 1} step={1} value={sliderValue} disabled={!total || actualPlaying}
        aria-label="Preview recorded action in both paths" aria-valuetext={valueText}
        onChange={event => setPreview({ key: controlKey, progress: Number(event.currentTarget.value), playing: false })} />
      <span className="pap-status">{local ? 'Preview only' : actualPlaying ? 'Inspection replay' : 'Click a circled dot to compare'}</span>
    </div>
    {!local && <PPEChoiceComparison selected={selected} revealed={revealed} />}
  </div>
}
