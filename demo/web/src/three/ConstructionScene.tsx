import { Component, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import {
  ConstructionRobot, ConstructionSite, ConstructionWorker,
} from './ConstructionModels'
import type { ConstructionVariant } from './ConstructionModels'
import {
  EVIDENCE_STATIONS, evidenceStation, inspectionTarget, recordedScenePose, reviewActionMode, reviewActionPlan, shiftScenePose,
} from '../lib/constructionScene'
import type { EvidenceStationId, RecordedWorldEvent, ScenePoint, ShiftWorldFrame } from '../lib/constructionScene'
import type { PPEAppearance, PPESceneAction } from '../lib/ppeInspection'

export type ConstructionCameraMode = 'overview' | 'follow' | 'detail' | 'free'

interface ConstructionSceneProps {
  inspection?: boolean
  ppe?: PPEAppearance
  actionSpec?: PPESceneAction
  actionFinished?: boolean
  paused?: boolean
  variant: ConstructionVariant
  mode: 'preview' | 'review' | 'reconstruction'
  stationId?: EvidenceStationId
  command?: string

  actionToken: string
  replayEpoch?: number
  robotResetKey?: string
  initialRobotPose?: { position: ScenePoint; yaw: number }

  liveWorld?: ShiftWorldFrame
  shift?: boolean
  injectedAction?: boolean

  worldEvent?: RecordedWorldEvent
  previousWorldEvent?: RecordedWorldEvent
  eventProgress?: number
  cameraMode: ConstructionCameraMode
  cameraRevision?: number
  speed?: number
  reducedMotion?: boolean
  onStationSelect?: (id: EvidenceStationId) => void
  onCameraInteract?: () => void
  onActionComplete?: (token: string) => void
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <div className="grid h-full min-h-[260px] place-items-center bg-stone-100 p-6 text-center">
      <div><p className="text-sm font-semibold text-slate-700">The 3D view could not start.</p>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">Check that WebGL is enabled in your browser, then try again.</p>
        <button className="mt-4 rounded-full bg-indigo-600 px-4 py-2 text-xs text-white" onClick={() => this.setState({ failed: false })}>Retry 3D view</button>
      </div>
    </div> : this.props.children
  }
}

function WebGLHealth({ onLost }: { onLost: () => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onLost() }
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => gl.domElement.removeEventListener('webglcontextlost', lost)
  }, [gl, onLost])
  return null
}

function RobotController({ stationId, command, actionToken, body, speed = 1, reducedMotion = false, injectedAction = false, targetOverride, initialPose, onComplete, actionSpec, actionFinished = false, paused = false }: {
  actionSpec?: PPESceneAction
  actionFinished?: boolean
  paused?: boolean
  stationId?: EvidenceStationId; command?: string; actionToken: string
  body: React.MutableRefObject<THREE.Vector3>; speed?: number; reducedMotion?: boolean
  injectedAction?: boolean; targetOverride?: ScenePoint
  initialPose?: { position: ScenePoint; yaw: number }
  onComplete?: (token: string) => void
}) {
  const group = useRef<THREE.Group>(null)


  const start = useRef(initialPose ?? { position: [-3.8, 0, 2.6] as ScenePoint, yaw: 0 })
  const route = useRef<ScenePoint[]>([])
  const inspectTime = useRef(0)
  const completed = useRef<string | null>(null)
  const preparedToken = useRef<string | null>(null)
  const station = evidenceStation(stationId)
  const actionMode = actionSpec ? actionSpec.mode === 'inspect' ? 'inspect' : 'tablet' : reviewActionMode(command, injectedAction)
  const target = useMemo(() => actionMode !== 'inspect' ? undefined : targetOverride ?? (station ? inspectionTarget(command, station) : undefined), [station, command, actionMode, targetOverride])
  const walkingRef = useRef(false)
  const inspectingRef = useRef(false)
  const tabletRef = useRef(false)
  const [walking, setWalking] = useState(false)
  const [inspecting, setInspecting] = useState(false)
  const [usingTablet, setUsingTablet] = useState(false)
  const [beamFrom, setBeamFrom] = useState<ScenePoint>([-3.8, .78, 2.6])

  useEffect(() => {
    if (!group.current) return
    preparedToken.current = actionToken
    completed.current = null
    const position = group.current.position
    const plan = reviewActionPlan([position.x, 0, position.z], command, station, injectedAction, actionSpec)
    route.current = actionFinished ? [] : plan.route
    inspectTime.current = actionFinished ? 0 : plan.duration / Math.max(.5, speed)
    if (actionFinished) completed.current = actionToken
    if (reducedMotion && plan.mode === 'inspect' && station) {
      position.set(...station.position)
      route.current = []
    }
    body.current.copy(position)
  }, [actionToken, stationId, reducedMotion, actionMode, actionFinished])

  useFrame((_, dt) => {
    if (!group.current || paused) return
    const position = group.current.position
    let isWalking = route.current.length > 0
    if (isWalking) {
      const next = route.current[0]
      const dx = next[0] - position.x, dz = next[2] - position.z
      const distance = Math.hypot(dx, dz)
      const movement = Math.min(distance, Math.max(.5, speed) * 3.4 * Math.min(dt, .06))
      if (distance > .001) {
        position.x += dx / distance * movement
        position.z += dz / distance * movement
        const desired = Math.atan2(dx, dz)
        const delta = Math.atan2(Math.sin(desired - group.current.rotation.y), Math.cos(desired - group.current.rotation.y))
        group.current.rotation.y += delta * (reducedMotion ? 1 : 1 - Math.exp(-dt * 11))
      }
      if (distance <= movement + .01) {
        position.set(next[0], 0, next[2])
        route.current.shift()
      }
      isWalking = route.current.length > 0
    } else if (target) {
      const desired = Math.atan2(target[0] - position.x, target[2] - position.z)
      const delta = Math.atan2(Math.sin(desired - group.current.rotation.y), Math.cos(desired - group.current.rotation.y))
      group.current.rotation.y += delta * (reducedMotion ? 1 : 1 - Math.exp(-dt * 8))
    }
    body.current.copy(position)
    const isInspecting = !isWalking && inspectTime.current > 0 && !!target
    const isUsingTablet = !isWalking && inspectTime.current > 0 && actionMode === 'tablet'
    if (!isWalking && inspectTime.current > 0) inspectTime.current = Math.max(0, inspectTime.current - dt)
    if (isWalking !== walkingRef.current) {
      walkingRef.current = isWalking
      setWalking(isWalking)
    }
    if (isInspecting !== inspectingRef.current) {
      inspectingRef.current = isInspecting
      setInspecting(isInspecting)
      if (isInspecting) setBeamFrom([position.x, .78, position.z])
    }
    if (isUsingTablet !== tabletRef.current) {
      tabletRef.current = isUsingTablet
      setUsingTablet(isUsingTablet)
    }
    if (preparedToken.current === actionToken && !isWalking && inspectTime.current <= 0 && completed.current !== actionToken) {
      completed.current = actionToken
      onComplete?.(actionToken)
    }
  })

  return <>
    <group ref={group} position={start.current.position} rotation={[0, start.current.yaw, 0]}>
      <ConstructionRobot walking={walking && !reducedMotion && !paused} inspecting={inspecting && !paused}
        usingTablet={usingTablet && !paused}
        inspectionPitch={target ? THREE.MathUtils.clamp(Math.atan2(.825 - target[1], Math.hypot(target[0] - beamFrom[0], target[2] - beamFrom[2])), -.4, .65) : .15} active />
    </group>
    {inspecting && target && !paused && <group>
      <Line points={[beamFrom, target]} color="#8b7ad7" lineWidth={1.2} transparent opacity={.55} dashed dashSize={.1} gapSize={.07} />
      <mesh position={target}><sphereGeometry args={[.075, 20, 16]} /><meshBasicMaterial color="#a78bfa" transparent opacity={.75} /></mesh>
    </group>}
  </>
}

function ShiftWorld({ frame, variant, reducedMotion, speed = 1 }: {
  frame: ShiftWorldFrame; variant: ConstructionVariant; reducedMotion?: boolean; speed?: number
}) {
  const [progress, setProgress] = useState(1)
  const animation = useRef({ token: frame.transitionToken, value: 1 })
  useEffect(() => {
    if (animation.current.token === frame.transitionToken) return
    animation.current = { token: frame.transitionToken, value: reducedMotion ? 1 : 0 }
    setProgress(animation.current.value)
  }, [frame.transitionToken, reducedMotion])
  useFrame((_, dt) => {
    if (animation.current.value >= 1) return
    animation.current.value = reducedMotion ? 1 : Math.min(1, animation.current.value + Math.min(dt, .06) * Math.max(.5, speed) / 1.6)
    setProgress(animation.current.value)
  })
  const currentProgress = reducedMotion ? 1 : animation.current.token === frame.transitionToken ? progress : 0
  const pose = shiftScenePose(frame.state, frame.previousState, currentProgress)
  return <>
    <group position={pose.offset}><ConstructionWorker variant={variant} phase={pose.phase} progress={pose.progress} syncPosition /></group>
    <IncidentTimber progress={pose.timberProgress} />
  </>
}

function IncidentTimber({ progress }: { progress: number }) {
  const t = Math.max(0, Math.min(1, progress))
  const drop = t * t
  return <RoundedBox args={[1.9, .13, .26]} radius={.025} smoothness={3} castShadow receiveShadow
    position={[1.45, 2.8 * (1 - drop) + .1, -1.35 + 2.35 * t]}
    rotation={[Math.sin(t * Math.PI) * .4, -.4, Math.sin(t * Math.PI) * .85]}>
    <meshStandardMaterial color="#ae8054" roughness={.91} metalness={0} />
  </RoundedBox>
}

function StationMarkers({ active, selectable, onSelect, shift }: {
  active?: EvidenceStationId; selectable: boolean; onSelect?: (id: EvidenceStationId) => void; shift?: boolean
}) {
  return <group>{EVIDENCE_STATIONS.map((station) => <group key={station.id} position={station.position}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .013, 0]}
      onClick={selectable ? (event) => { event.stopPropagation(); onSelect?.(station.id) } : undefined}>
      <ringGeometry args={[.39, .48, 48]} />
      <meshBasicMaterial color={station.id === active ? '#8b7ad7' : '#9e9c94'} transparent opacity={station.id === active ? .7 : .28} />
    </mesh>
    <Html center position={[0, .1, .62]} zIndexRange={[20, 0]}>
      <button type="button" disabled={!selectable} onClick={() => onSelect?.(station.id)}
        className={`whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-semibold shadow-sm backdrop-blur-sm transition-colors ${station.id === active ? 'border-indigo-300 bg-indigo-600 text-white' : 'border-white/80 bg-white/85 text-slate-500'} ${selectable ? 'cursor-pointer hover:bg-indigo-50 hover:text-indigo-700' : 'cursor-default'}`}>
        {shift && station.id === 'report' ? 'Report' : station.shortLabel}
      </button>
    </Html>
  </group>)}</group>
}

function CameraRig({ body, focus, eventFocus, alternateView, mode, revision, reducedMotion, onInteract }: {
  body: React.MutableRefObject<THREE.Vector3>; mode: ConstructionCameraMode; revision?: number
  focus?: ScenePoint
  eventFocus?: ScenePoint
  alternateView?: boolean
  reducedMotion?: boolean; onInteract?: () => void
}) {
  const { camera, size } = useThree()
  const controls = useRef<any>(null)
  const goal = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const initial = useRef(true)
  const baseZoom = Math.min(size.width / 16.8, size.height / 10.5)
  useEffect(() => { controls.current?.update() }, [revision])
  useFrame((_, dt) => {
    if (mode === 'free' || !controls.current) return
    const follow = mode === 'follow'
    const detail = mode === 'detail'
    if (detail) look.current.set(...(eventFocus ?? [-2.9, .7, 2.45]))
    else look.current.set(follow ? (body.current.x + (focus?.[0] ?? body.current.x)) / 2 : 0,
      follow ? .6 : .45, follow ? (body.current.z + (focus?.[2] ?? body.current.z)) / 2 : 0)
    goal.current.set(look.current.x + (follow && alternateView ? -11 : 11),
      look.current.y + (follow && alternateView ? 8 : 10), look.current.z + (follow && alternateView ? 10 : 13))
    const amount = reducedMotion || initial.current ? 1 : 1 - Math.exp(-Math.min(dt, .06) * 3)
    camera.position.lerp(goal.current, amount)
    controls.current.target.lerp(look.current, amount)
    const orthographic = camera as THREE.OrthographicCamera
    if (orthographic.isOrthographicCamera) {
      const magnification = detail ? 1.55 : follow ? 1.85 : 1
      orthographic.zoom = THREE.MathUtils.lerp(orthographic.zoom, baseZoom * magnification, amount)
      orthographic.updateProjectionMatrix()
    }
    controls.current.update()
    initial.current = false
  })
  return <OrbitControls ref={controls} makeDefault enableDamping={!reducedMotion} dampingFactor={.09}
    minPolarAngle={.2} maxPolarAngle={Math.PI / 2.15} minZoom={baseZoom * .65} maxZoom={baseZoom * 2.8}
    enablePan minDistance={7} maxDistance={30} onStart={onInteract} />
}

export default function ConstructionScene(props: ConstructionSceneProps) {
  const body = useRef(new THREE.Vector3(...(props.initialRobotPose?.position ?? [-3.8, 0, 2.6] as ScenePoint)))
  const station = evidenceStation(props.stationId)
  const actionMode = props.actionSpec ? props.actionSpec.mode === 'inspect' ? 'inspect' : 'tablet' : reviewActionMode(props.command, props.injectedAction)
  const live = props.shift && props.mode !== 'reconstruction' ? props.liveWorld : undefined
  const livePose = shiftScenePose(live?.state)
  const targetOverride: ScenePoint | undefined = props.actionSpec?.mode === 'inspect'
    ? [-2.9, props.actionSpec.target === 'footwear' ? .12 : .9, 2.45]
    : live?.state && station?.id === 'timber' ? [livePose.workerPosition[0], live.state.contact ? .2 : .75, livePose.workerPosition[2]] : undefined
  const cameraFocus = actionMode !== 'inspect' ? undefined : targetOverride ?? (station ? inspectionTarget(props.command, station) : undefined)
  const pose = live ? livePose : recordedScenePose(props.mode === 'reconstruction' ? props.worldEvent : undefined,
    props.mode === 'reconstruction' ? props.previousWorldEvent : undefined, props.eventProgress ?? 1)
  const [lost, setLost] = useState(false)
  const [canvasVersion, setCanvasVersion] = useState(0)
  if (lost) return <div className="grid h-full min-h-[260px] place-items-center bg-stone-100 p-5 text-center">
    <div><p className="text-sm font-semibold text-slate-700">The 3D connection was interrupted.</p>
      <button onClick={() => { setCanvasVersion((value) => value + 1); setLost(false) }}
        className="mt-3 rounded-full bg-indigo-600 px-4 py-2 text-xs text-white">Reload 3D view</button></div>
  </div>
  return <SceneBoundary key={props.variant}>
    <Canvas key={`${props.variant}-${canvasVersion}`} orthographic shadows="percentage" dpr={[1, 1.75]}
      camera={{ position: [11, 10, 13], zoom: 38, near: .1, far: 100 }}
      gl={{ antialias: true, alpha: false }}
      fallback={<div className="grid h-full place-items-center bg-stone-100 p-6 text-xs text-slate-600">Interactive 3D construction scene.</div>}>
      <color attach="background" args={['#eeece6']} />
      <ambientLight intensity={.65} />
      <hemisphereLight args={['#fff8ec', '#aaa89e', 1.5]} />
      <directionalLight position={[-4, 10, 5]} intensity={2.4} color="#fff4e1" castShadow
        shadow-mapSize={[2048, 2048]} shadow-normalBias={.03}
        shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <directionalLight position={[6, 5, -4]} intensity={.65} color="#dfe7ff" />
      <ConstructionSite variant={props.variant} />
      {props.inspection ? <ConstructionWorker variant={props.variant} phase="entry" progress={0} syncPosition inspection ppe={props.ppe}
        adjusting={props.actionSpec?.mode === 'rectify' && !props.actionFinished && !props.paused} />
        : live ? <ShiftWorld frame={live} variant={props.variant} reducedMotion={props.reducedMotion} speed={props.speed} /> : <>
        <group position={pose.offset}><ConstructionWorker key={props.mode === 'reconstruction' ? 'site-events' : 'entry-checks'} variant={props.variant}
          phase={pose.phase} progress={pose.progress} syncPosition /></group>
        <IncidentTimber progress={pose.timberProgress} />
      </>}
      <group visible={props.shift || props.mode !== 'reconstruction'}><RobotController
        key={`${props.replayEpoch ?? 0}:${props.robotResetKey ?? 'continuous'}:${props.mode === 'preview' ? 'preview' : 'run'}`}
        stationId={props.stationId} command={props.command} actionToken={props.actionToken}
        body={body} speed={props.speed} reducedMotion={props.reducedMotion}
        initialPose={props.mode === 'preview' ? undefined : props.initialRobotPose}
        injectedAction={props.injectedAction} targetOverride={targetOverride} actionSpec={props.actionSpec} actionFinished={props.actionFinished} paused={props.paused}
        onComplete={props.mode === 'review' ? props.onActionComplete : undefined} /></group>
      {!props.inspection && props.mode !== 'reconstruction' && <StationMarkers active={actionMode === 'inspect' ? props.stationId : undefined}
        selectable={props.mode === 'preview'} onSelect={props.onStationSelect} shift={props.shift} />}
      <CameraRig body={body} focus={cameraFocus} eventFocus={pose.workerPosition}
        alternateView={props.variant === 'timber-yard' && ['read_footwear_alternate', 'inspect_footwear_detail'].includes(props.command?.split(/\s+/)[0] ?? '')}
        mode={props.cameraMode} revision={props.cameraRevision}
        reducedMotion={props.reducedMotion} onInteract={props.onCameraInteract} />
      <WebGLHealth onLost={() => setLost(true)} />
    </Canvas>
  </SceneBoundary>
}
