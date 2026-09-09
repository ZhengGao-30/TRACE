export type EvidenceStationId = 'entry' | 'ppe' | 'timber' | 'records' | 'report'
export type ReconstructionPhase = 'entry' | 'work' | 'incident' | 'aftermath'
export type ScenePoint = [number, number, number]
export type RecordedWorkerState = 'waiting' | 'working' | 'held' | 'injured' | 'clear'
export type RecordedTimberState = 'overhead' | 'fallen'

export interface RecordedWorldEvent {
  id: string
  timestamp: string
  kind: string
  title: string
  description: string
  worker_state: RecordedWorkerState
  timber_state: RecordedTimberState
  contact?: boolean
}

export interface RecordedWorldState {
  worker_state: RecordedWorkerState
  timber_state: RecordedTimberState
  contact: boolean
  timestamp: string
}

/** Metadata belongs to the executed action interval, never to an L2 read. */
export interface ShiftSceneStep {
  i: number
  action: string
  event_kind?: string
  station_id?: string
  world_state_before?: unknown
  world_state_after?: unknown
  world_events?: unknown
  state_after?: { facts?: Record<string, unknown>; [key: string]: unknown }
}

interface SceneReplayGroup {
  i: number
  chosen?: string
  result?: string
  observations: { confirm?: boolean; command?: string; text: string }[]
}

/** The replay source buffers result text with its group. The scene releases
 * that text only once the main action's arrival/gesture callback has fired. */
export function gateShiftSceneResults<T extends SceneReplayGroup>(groups: T[], currentArrived: boolean): T[] {
  if (currentArrived || !groups.length) return groups
  return groups.map((group, index) => index === groups.length - 1
    ? { ...group, result: '', observations: group.observations.filter((observation) => observation.confirm) }
    : group)
}

export interface ShiftWorldFrame {
  state?: RecordedWorldState
  previousState?: RecordedWorldState
  transitionEvents: RecordedWorldEvent[]
  transitionToken: string
  events: RecordedWorldEvent[]
  incidentObserved: boolean
  observedAt?: string
}

export function parseSiteTimestamp(value: unknown) {
  if (typeof value !== 'string') return NaN
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/.exec(value)
  if (!parts) return NaN
  const [, year, month, day, hour, minute, second, zone] = parts
  if (+year < 1 || +month < 1 || +month > 12 || +day < 1
    || +day > new Date(Date.UTC(+year, +month, 0)).getUTCDate()
    || +hour > 23 || +minute > 59 || +second > 59) return NaN
  return Date.parse(zone ? value : `${value}Z`)
}

export function recordedWorldState(value: unknown): RecordedWorldState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const state = value as RecordedWorldState
  if (!['waiting', 'working', 'held', 'injured', 'clear'].includes(state.worker_state)
    || !['overhead', 'fallen'].includes(state.timber_state)
    || typeof state.contact !== 'boolean' || !Number.isFinite(parseSiteTimestamp(state.timestamp))) return undefined
  if (state.contact !== (state.worker_state === 'injured')
    || (state.contact && state.timber_state !== 'fallen')) return undefined
  return state
}

function samePhysicalState(a: RecordedWorldState, b: RecordedWorldState) {
  return a.worker_state === b.worker_state && a.timber_state === b.timber_state && a.contact === b.contact
}

function canFollowState(before: RecordedWorldState, after: RecordedWorldState) {
  return parseSiteTimestamp(after.timestamp) >= parseSiteTimestamp(before.timestamp)
    && !(before.timber_state === 'fallen' && after.timber_state !== 'fallen')
    && !(after.worker_state === 'injured' && !['working', 'injured'].includes(before.worker_state))
}

/** The action interval is indivisible until its result arrives. Unlike v2,
 * events may be spread over many intervals and need no approval prerequisite:
 * a controlled fault can admit the worker without an agent approval. */
export function shiftIntervalEvents(before: RecordedWorldState, after: RecordedWorldState, raw: unknown): RecordedWorldEvent[] | undefined {
  if (!Array.isArray(raw) || !canFollowState(before, after)) return undefined
  const events: RecordedWorldEvent[] = []
  const ids = new Set<string>()
  let previous = before
  for (const value of raw) {
    const state = recordedWorldState(value)
    const event = value as RecordedWorldEvent
    if (!state || !['worker_entry', 'falling_timber', 'event_recorded'].includes(event.kind)
      || ['id', 'title', 'description'].some((field) => typeof (value as Record<string, unknown>)[field] !== 'string')
      || !event.id || ids.has(event.id) || !canFollowState(previous, state)
      || parseSiteTimestamp(state.timestamp) <= parseSiteTimestamp(previous.timestamp)
      || parseSiteTimestamp(state.timestamp) > parseSiteTimestamp(after.timestamp)) return undefined
    if ((event.kind === 'worker_entry' && (state.worker_state !== 'working' || previous.worker_state === 'injured'))
      || (event.kind === 'falling_timber' && (previous.timber_state !== 'overhead' || state.timber_state !== 'fallen'))
      || (event.kind === 'event_recorded' && !samePhysicalState(previous, state))) return undefined
    events.push(event)
    ids.add(event.id)
    previous = state
  }
  if (!canFollowState(previous, after)) return undefined
  // Admission and falling timber must be backed by the actual world event.
  if ((before.worker_state !== 'working' && after.worker_state === 'working'
    && !events.some((event) => event.kind === 'worker_entry'))
    || (before.timber_state !== after.timber_state && !events.some((event) => event.kind === 'falling_timber'))
    || (before.contact !== after.contact && !events.some((event) => event.kind === 'falling_timber'))) return undefined
  return events
}

/** Reconstruct only the matching executed prefix. A future report, pending
 * result, or appended confirmation cannot advance the world or agent knowledge. */
export function shiftWorldFrame(steps: ShiftSceneStep[], groups: SceneReplayGroup[]): ShiftWorldFrame {
  const frame: ShiftWorldFrame = { transitionEvents: [], transitionToken: 'initial', events: [], incidentObserved: false }
  for (const [index, group] of groups.entries()) {
    const step = steps[index]
    const main = group.observations.find((observation) => !observation.confirm)
    if (!step || step.i !== group.i || step.action !== (group.chosen ?? main?.command)) break
    const before = recordedWorldState(step.world_state_before)
    if (!before || (frame.state && (!canFollowState(frame.state, before) || !samePhysicalState(frame.state, before)))) break
    frame.state = before
    const complete = !!(group.result?.trim() || main?.text.trim())
    if (!complete) break
    const after = recordedWorldState(step.world_state_after)
    if (!after) break
    const events = shiftIntervalEvents(before, after, step.world_events)
    if (!events || events.some((event) => frame.events.some((seen) => seen.id === event.id))) break
    frame.state = after
    frame.events.push(...events)
    if (!samePhysicalState(before, after)) {
      frame.previousState = before
      frame.transitionEvents = events
      frame.transitionToken = `${step.i}:${after.timestamp}`
    }
    const workerFact = step.state_after?.facts?.['site.worker_state'] as { value?: unknown; observed_at?: unknown } | undefined
    if (!frame.incidentObserved && workerFact?.value === 'injured') {
      frame.incidentObserved = true
      frame.observedAt = typeof workerFact.observed_at === 'string' ? workerFact.observed_at : after.timestamp
    }
  }
  return frame
}

export function shiftScenePose(state?: RecordedWorldState, previous?: RecordedWorldState, progress = 1) {
  if (!state) return recordedScenePose()
  const event = { ...state, id: 'state', kind: 'state', title: '', description: '' }
  const before = state.worker_state === 'working' && progress >= 1 ? state : previous ?? state
  return recordedScenePose(event, { ...before, id: 'before', kind: 'state', title: '', description: '' }, progress)
}

export function isShiftReplayComplete(running: boolean, steps: ShiftSceneStep[], groups: SceneReplayGroup[]) {
  return !running && steps.length > 0 && steps.length === groups.length && steps.every((step, index) => {
    const group = groups[index]
    const main = group?.observations.find((observation) => !observation.confirm)
    return group?.i === step.i && step.action === (group.chosen ?? main?.command) && !!(group.result?.trim() || main?.text.trim())
  })
}

export interface EvidenceStation {
  id: EvidenceStationId
  title: string
  shortLabel: string
  position: ScenePoint
  lookAt: ScenePoint
  preview: string
}

export const EVIDENCE_STATIONS: EvidenceStation[] = [
  { id: 'entry', title: 'Entry checkpoint', shortLabel: 'Entry', position: [-3.8, 0, 2.6],
    lookAt: [-2.9, .85, 2.45], preview: 'The worker waits outside the work area while the agent verifies the site and identity.' },
  { id: 'ppe', title: 'PPE inspection', shortLabel: 'PPE', position: [-1.5, 0, 2.1],
    lookAt: [-2.9, .55, 2.45], preview: 'The agent can inspect footwear and clothing before judging compliance. An obscured view can be checked from another angle.' },
  { id: 'timber', title: 'Work area', shortLabel: 'Site', position: [3.4, 0, 1.8],
    lookAt: [1.5, 2.8, -1.35], preview: 'This is the work area, not the waiting area. Later site events appear only when they are present in the completed run’s log.' },
  { id: 'records', title: 'Site requirements', shortLabel: 'Rules', position: [-3.8, 0, -1.4],
    lookAt: [-4.35, 1.1, -2.45], preview: 'The agent can read the site’s PPE requirements before making its assessment.' },
  { id: 'report', title: 'Entry decision', shortLabel: 'Decision', position: [3.8, 0, 3],
    lookAt: [3.8, .85, 4.08], preview: 'The agent records its assessment and chooses whether to approve, deny or hold entry. Preview mode makes no decision.' },
]

const COMMAND_STATIONS: Record<string, EvidenceStationId> = {
  check_site: 'entry', identify_worker: 'entry',
  inspect_footwear: 'ppe', inspect_workwear: 'ppe', check_ppe_requirements: 'records',
  read_footwear_alternate: 'ppe',
  assess_compliant: 'report', assess_non_compliant: 'report', assess_uncertain: 'report',
  approve_entry: 'report', deny_entry: 'report', hold_for_review: 'report',
}

export function evidenceStation(id?: EvidenceStationId | null) {
  return EVIDENCE_STATIONS.find((station) => station.id === id)
}

export function stationForReview(command?: string, stationId?: string) {
  const explicit = EVIDENCE_STATIONS.find((station) => station.id === stationId)
  return explicit ?? (command ? evidenceStation(COMMAND_STATIONS[command.split(/\s+/)[0]]) : undefined)
}

export type ReviewActionMode = 'tablet' | 'inspect' | 'wait'

// A logged information source is not necessarily a physical destination.
// These tools access digital records from the robot's current safe position.
const TABLET_ACTIONS = new Set([
  'read_shift_handover', 'read_work_plan', 'read_site_rules', 'check_ppe_requirements',
  'read_role_authorization', 'verify_authorization_addendum', 'verify_training_certificate',
  'read_previous_clearance', 'verify_footwear_model', 'request_ppe_replacement',
  'compile_admission_evidence', 'assess_compliant', 'assess_non_compliant', 'assess_uncertain',
  'recommend_approve', 'recommend_deny', 'recommend_hold', 'approve_entry', 'deny_entry', 'hold_for_review',
  'read_admission_receipt', 'read_patrol_assignment', 'read_site_alert',
  'report_observed_incident', 'preserve_observation_refs', 'read_supervisor_response', 'close_shift_handover',
])

export function reviewActionMode(command?: string, injectedAction = false): ReviewActionMode {
  // Neither a controller transaction nor an inert L2 read is a robot gesture.
  if (injectedAction || command?.trim() === 'review last_record') return 'wait'
  return TABLET_ACTIONS.has(command?.split(/\s+/)[0] ?? '') ? 'tablet' : 'inspect'
}

/** Presentation only: never changes action order, log timestamps or results. */
export function reviewActionPlan(from: ScenePoint, command?: string, station?: EvidenceStation, injectedAction = false) {
  const mode = reviewActionMode(command, injectedAction)
  if (mode !== 'inspect' || !station) return {
    mode: mode === 'inspect' ? 'wait' as const : mode,
    route: [] as ScenePoint[], target: undefined, duration: mode === 'tablet' ? 2.2 : .8,
  }
  const distance = Math.hypot(from[0] - station.position[0], from[2] - station.position[2])
  return { mode, route: distance < .05 ? [] : reviewRoute(from, station), target: inspectionTarget(command, station), duration: 1.5 }
}

/** Reconstruct a remounted robot from completed physical checks only. Digital
 * source locations and the buffered current result cannot move its body. */
export function reviewResumePose(steps: ShiftSceneStep[], groups: SceneReplayGroup[]) {
  let position: ScenePoint = [-3.8, 0, 2.6]
  let yaw = 0
  for (const [index, group] of groups.entries()) {
    const main = group.observations.find(observation => !observation.confirm)
    const command = group.chosen ?? main?.command
    const step = steps[index]
    if (!step || step.i !== group.i || step.action !== command || !(group.result?.trim() || main?.text.trim())) break
    if (reviewActionMode(command, step.event_kind === 'injected_action') !== 'inspect') continue
    const station = stationForReview(command, step.station_id)
    if (!station) continue
    position = [...station.position]
    const target = inspectionTarget(command, station)
    yaw = Math.atan2(target[0] - position[0], target[2] - position[2])
  }
  return { position, yaw }
}

export function inspectionTarget(command: string | undefined, station: EvidenceStation): ScenePoint {
  const name = command?.split(/\s+/)[0]
  if (name === 'inspect_workwear' || name === 'inspect_current_workwear') return [-2.9, .9, 2.45]
  if (name === 'inspect_footwear' || name === 'read_footwear_alternate'
    || name === 'inspect_footwear_wide' || name === 'inspect_footwear_detail' || name === 'verify_rectification') return [-2.9, .12, 2.45]
  return station.lookAt
}

/** All travel uses the open southern aisle and the western bypass. The building
 * occupies x=[.1,3], z=[-2.8,-.6]; no route crosses it or the waiting worker. */
export function reviewRoute(from: ScenePoint, destination: EvidenceStation): ScenePoint[] {
  const south = 3.5
  const west = -4.8
  const route: ScenePoint[] = []
  if (from[2] < 1.8) {
    route.push([west, 0, from[2]], [west, 0, south])
  } else {
    route.push([from[0], 0, south])
  }
  if (destination.id === 'records') {
    route.push([west, 0, south], [west, 0, destination.position[2]])
  } else {
    route.push([destination.position[0], 0, south])
  }
  route.push([...destination.position])
  let previous = from
  return route.filter((point) => {
    const distinct = Math.hypot(point[0] - previous[0], point[2] - previous[2]) > .035
    if (distinct) previous = point
    return distinct
  })
}

/** Only completed entry-check records may supply events. Fail closed for old
 * investigation bundles or inconsistent world-state transitions. */
export function recordedWorldEvents(report: unknown): RecordedWorldEvent[] {
  if (!report || typeof report !== 'object') return []
  const data = report as { world_events?: unknown; decision?: { action?: string; timestamp?: unknown } }
  const kinds = ['worker_entry', 'falling_timber', 'event_recorded']
  if (!Array.isArray(data.world_events) || data.world_events.length !== kinds.length) return []
  if (!['approve_entry', 'deny_entry', 'hold_for_review'].includes(data.decision?.action ?? '')) return []
  // Python's isoformat() may omit the timezone. Treat such site-local stamps in
  // one fixed zone for ordering, instead of depending on the viewer's timezone.
  const parseTimestamp = (value: unknown) => {
    if (typeof value !== 'string') return NaN
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/.exec(value)
    if (!parts) return NaN
    const [, year, month, day, hour, minute, second, zone] = parts
    if (+year < 1 || +month < 1 || +month > 12 || +day < 1
      || +day > new Date(Date.UTC(+year, +month, 0)).getUTCDate()
      || +hour > 23 || +minute > 59 || +second > 59) return NaN
    return Date.parse(zone ? value : `${value}Z`)
  }
  let previousTime = parseTimestamp(data.decision?.timestamp)
  if (!Number.isFinite(previousTime)) return []
  const allowedWorkers = new Set(['waiting', 'working', 'held', 'injured', 'clear'])
  const allowedTimber = new Set(['overhead', 'fallen'])
  const ids = new Set<string>()
  let previousWorker: RecordedWorkerState = 'waiting'
  let previousTimber: RecordedTimberState = 'overhead'
  const result: RecordedWorldEvent[] = []
  for (const [index, raw] of data.world_events.entries()) {
    if (!raw || typeof raw !== 'object') return []
    const event = raw as RecordedWorldEvent
    if (['id', 'timestamp', 'kind', 'title', 'description'].some((field) =>
      typeof (raw as Record<string, unknown>)[field] !== 'string')) return []
    if (!event.id || ids.has(event.id) || !allowedWorkers.has(event.worker_state) || !allowedTimber.has(event.timber_state)) return []
    if (event.kind !== kinds[index]) return []
    const timestamp = parseTimestamp(event.timestamp)
    if (!Number.isFinite(timestamp) || timestamp <= previousTime) return []
    if ('contact' in event && (typeof event.contact !== 'boolean' || event.contact !== (event.worker_state === 'injured'))) return []
    if ((event.worker_state === 'working' || event.worker_state === 'injured') && data.decision?.action !== 'approve_entry') return []
    if (event.worker_state === 'injured' && (event.timber_state !== 'fallen' || !['working', 'injured'].includes(previousWorker))) return []
    if (previousTimber === 'fallen' && event.timber_state !== 'fallen') return []
    result.push(event)
    ids.add(event.id)
    previousWorker = event.worker_state
    previousTimber = event.timber_state
    previousTime = timestamp
  }
  return result
}

export function siteEventAt(events: RecordedWorldEvent[], position: number) {
  if (!events.length) return undefined
  const value = Number.isFinite(position) ? Math.max(0, Math.min(1, position)) : 0
  const index = Math.min(events.length - 1, Math.floor(value * events.length))
  return {
    event: events[index], previous: events[index - 1], index,
    progress: value === 1 ? 1 : value * events.length - index,
  }
}

/** Maps recorded states onto existing model poses, without changing geometry.
 * Waiting/held/clear remain at the entrance. Injury needs recorded exposure. */
export function recordedScenePose(event?: RecordedWorldEvent, previous?: RecordedWorldEvent, progress = 1) {
  const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  const state = event?.worker_state ?? 'waiting'
  const previousState = previous?.worker_state ?? 'waiting'
  const exposed = previousState === 'working' || previousState === 'injured'
  const injured = state === 'injured' && exposed && event?.timber_state === 'fallen'
  const moving = state === 'working' && previousState !== 'working'
  const outside = state !== 'working' && !injured
  const phase: ReconstructionPhase = injured ? previousState === 'injured' || t >= 1 ? 'aftermath' : 'incident'
    : moving ? 'entry' : state === 'working' ? 'work' : 'entry'
  const timberFalling = event?.timber_state === 'fallen' && previous?.timber_state !== 'fallen'
  return {
    phase,
    progress: outside ? 1 : t,
    // ConstructionWorker entry(t=1) is [1.2, 0, .4]; move that standing pose to the checkpoint.
    offset: (outside ? [-4.1, 0, 2.05] : [0, 0, 0]) as ScenePoint,
    workerPosition: (outside ? [-2.9, .7, 2.45] : moving ? [-2.9 + 4.1 * t, .7, 2.45 - 2.05 * t] : [1.2, .7, .4]) as ScenePoint,
    timberProgress: event?.timber_state === 'fallen' ? timberFalling ? t : 1 : 0,
  }
}

export function isEntryReplayComplete(
  taskType: string | undefined,
  running: boolean,
  steps: { i: number; action: string }[],
  groups: { i: number; chosen?: string; result?: string; observations: { confirm?: boolean; command?: string; text: string }[] }[],
) {
  if (taskType !== 'construction_ppe_entry_check' || running || !steps.length || groups.length !== steps.length) return false
  return steps.every((step, index) => {
    const group = groups[index]
    const main = group?.observations.find((observation) => !observation.confirm)
    return group?.i === step.i && (group.chosen ?? main?.command) === step.action && !!(group.result?.trim() || main?.text.trim())
  })
}
