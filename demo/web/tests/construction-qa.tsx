
import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import ConstructionScene from '../src/three/ConstructionScene'
import { ConstructionRobot } from '../src/three/ConstructionModels'
import { EVIDENCE_STATIONS } from '../src/lib/constructionScene'
import type { EvidenceStationId, RecordedWorldEvent } from '../src/lib/constructionScene'


const event = (id: string, worker_state: RecordedWorldEvent['worker_state'], timber_state: RecordedWorldEvent['timber_state']): RecordedWorldEvent => ({
  id, worker_state, timber_state, timestamp: 'QA only', kind: 'visual_test', title: id, description: 'Visual test fixture only',
})
const qaEvents = [event('Admitted', 'working', 'overhead'), event('Exposed to fall', 'injured', 'fallen'), event('After contact', 'injured', 'fallen'),
  event('Held outside', 'held', 'overhead'), event('Fall without contact', 'held', 'fallen'), event('Clear outside', 'clear', 'fallen')]

type PoseFixture = 'site' | 'tablet' | 'footwear'



function HoldPose() {
  const elapsed = useRef(0)
  const held = useRef(false)
  const setFrameloop = useThree(state => state.setFrameloop)
  useFrame((_, delta) => {
    if (held.current) return
    elapsed.current += Math.min(delta, .05)
    if (elapsed.current >= 1.1) {
      held.current = true
      setFrameloop('demand')
    }
  })
  return null
}

function RobotPoseFixture({ pose }: { pose: Exclude<PoseFixture, 'site'> }) {
  return <div style={{ height: '100%', position: 'relative' }}>
    <div style={{ position: 'absolute', zIndex: 1, top: 16, left: 20, padding: '10px 14px',
      borderRadius: 12, background: 'rgba(255,255,255,.9)', color: '#475569', fontSize: 13 }}>
      <strong>{pose === 'tablet' ? 'Tablet pose fixture' : 'Footwear pose fixture'}</strong>
      <div style={{ marginTop: 4 }}>Held visual fixture · no agent evidence · drag to inspect</div>
    </div>
    <Canvas key={pose} shadows frameloop="always" dpr={[1, 1.5]}
      camera={{ position: [1.7, 1.45, 2.8], fov: 31, near: .05, far: 20 }}>
      <color attach="background" args={['#f0f1f5']} />
      <ambientLight intensity={.65} />
      <hemisphereLight args={['#fffaf2', '#bbc2d6', 1.6]} />
      <directionalLight position={[-3, 5, 4]} intensity={2.1} color="#fff8eb" castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-2} shadow-camera-right={2}
        shadow-camera-top={2} shadow-camera-bottom={-2} shadow-normalBias={.025} />
      <directionalLight position={[3, 3, -2]} intensity={.6} color="#dce4ff" />
      <mesh position={[0, -.025, 0]} receiveShadow>
        <cylinderGeometry args={[1.1, 1.12, .05, 64]} />
        <meshStandardMaterial color="#e1e3eb" roughness={.9} />
      </mesh>
      <ConstructionRobot walking={false} active usingTablet={pose === 'tablet'}
        inspecting={pose === 'footwear'} inspectionPitch={.48} />
      <OrbitControls makeDefault target={[0, .56, .08]} enableDamping={false}
        enablePan={false} minDistance={1.5} maxDistance={5} maxPolarAngle={Math.PI / 2.08} />
      <HoldPose />
    </Canvas>
  </div>
}

function Harness() {
  const [variant, setVariant] = useState<'scaffold' | 'timber-yard'>('scaffold')
  const [station, setStation] = useState<EvidenceStationId>('entry')
  const [mode, setMode] = useState<'preview' | 'review' | 'reconstruction'>('preview')
  const [eventIndex, setEventIndex] = useState(0)
  const [progress, setProgress] = useState(1)
  const [revision, setRevision] = useState(0)
  const [camera, setCamera] = useState<'overview' | 'follow' | 'free'>('overview')
  const [step, setStep] = useState(0)
  const [run, setRun] = useState(0)
  const [completed, setCompleted] = useState<string[]>([])
  const [fixture, setFixture] = useState<PoseFixture>('site')
  const seen = useRef(new Set<string>())
  const checks = [
    { station: 'ppe' as const, command: 'inspect_footwear' },
    { station: 'ppe' as const, command: 'inspect_workwear' },
    { station: 'records' as const, command: 'check_ppe_requirements' },
  ]
  const token = mode === 'review' ? `qa-${run}-${step}` : `${variant}:${station}:${revision}`
  if (!import.meta.env.DEV) return <p>Development-only scene test.</p>
  return <main style={{ fontFamily: 'system-ui', background: '#f6f7fb', minHeight: '100vh' }}>
    <header style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <b>Scene QA · no API / no agent evidence</b>
      <select aria-label="QA case" value={variant} onChange={e => setVariant(e.target.value as typeof variant)}>
        <option value="scaffold">Scaffold</option><option value="timber-yard">Timber yard</option>
      </select>
      <button onClick={() => { setFixture('site'); setMode('preview'); setRevision(x => x + 1) }}>Robot preview</button>
      <button onClick={() => { setFixture('site'); setMode('reconstruction') }}>Site event pose fixtures</button>
      <button onClick={() => setFixture('tablet')}>Tablet pose fixture</button>
      <button onClick={() => setFixture('footwear')}>Footwear pose fixture</button>
      <button onClick={() => setFixture('site')}>Return to whole site</button>
      <button onClick={() => { setCamera('overview'); setRevision(x => x + 1) }}>Overview</button>
      <button onClick={() => setCamera('follow')}>Follow</button>
      <button onClick={() => { seen.current.clear(); setCompleted([]); setStep(0); setRun(n => n + 1); setFixture('site'); setMode('review') }}>Run 3-step callback test</button>
      <output aria-label="QA completed actions">Completed {completed.length}/3{completed.length === 3 ? ' · PASS' : ''}</output>
      {EVIDENCE_STATIONS.map(s => <button key={s.id} onClick={() => { setFixture('site'); setStation(s.id); setMode('preview'); setRevision(x => x + 1) }}>{s.shortLabel}</button>)}
      {mode === 'reconstruction' && <>
        <select aria-label="QA event" value={eventIndex} onChange={e => setEventIndex(+e.target.value)}>
          {qaEvents.map((item, index) => <option key={item.id} value={index}>{item.title}</option>)}
        </select>
        <input aria-label="QA phase progress" type="range" min="0" max="1" step=".01" value={progress} onChange={e => setProgress(+e.target.value)} />
      </>}
    </header>
    <div style={{ height: 'calc(100vh - 100px)', minHeight: 480 }}>
      {fixture !== 'site' ? <RobotPoseFixture pose={fixture} /> : <ConstructionScene variant={variant} mode={mode} stationId={mode === 'review' ? checks[step].station : station}
        command={mode === 'review' ? checks[step].command : station === 'ppe' ? 'inspect_footwear' : undefined}
        actionToken={token} replayEpoch={run} speed={2} worldEvent={qaEvents[eventIndex]}
        previousWorldEvent={eventIndex === 3 ? undefined : qaEvents[eventIndex - 1]}
        eventProgress={progress} cameraMode={camera} cameraRevision={revision}
        onActionComplete={received => {
          if (mode !== 'review' || received !== token || seen.current.has(received)) return
          seen.current.add(received)
          setCompleted([...seen.current])
          if (step < checks.length - 1) setStep(step + 1)
        }}
        onCameraInteract={() => setCamera('free')}
        onStationSelect={id => { setStation(id); setRevision(x => x + 1) }} />}
    </div>
  </main>
}

createRoot(document.getElementById('root')!).render(<Harness />)
