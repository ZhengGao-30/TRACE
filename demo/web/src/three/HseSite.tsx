import { useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, ContactShadows, Billboard } from '@react-three/drei'
import { EffectComposer, N8AO, Vignette, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import { blockMaterial } from './textures'
import { siteFor, stationFor, standAt, actOf, describeHse } from '../lib/hseSite'
import type { SiteModel, Station, StationKind, HseAct } from '../lib/hseSite'
import { useI18n } from '../i18n'

/**
 * The HSE plant site -- the analogue of VoxelRoom for permit-to-work and
 * compliance jobs.
 *
 * An HSE agent works a SITE, not a kitchen: it walks between the tank, the
 * valve manifold, the gas detector, the rescue tripod and the permit desk, and
 * every recorded action happens at one of them. The character is a robot,
 * because the whole point of the project is that the trajectory belongs to an
 * autonomous agent rather than a person.
 */

export interface HseSceneState {
  taskType?: string
  command?: string
  confirm?: boolean
  visited: string[]
  step: number
  done?: boolean
  success?: boolean
  /** stamped record lines, newest last -- rendered as the on-site docket */
  lines: { i: number; chosen: string; k: number; phase?: string }[]
  /**
   * Attack-lab extras. `erased` means this step's record was deleted, so the
   * robot reaches the asset but the record never lands. `rewritten` means the
   * log now claims a DIFFERENT action -- and because a different action belongs
   * to a different asset, the robot visibly walks to the wrong place.
   */
  attack?: 'ok' | 'erased' | 'rewritten'
  /** the action the agent really took, when the log has been rewritten */
  ghostCommand?: string
  /** hide the on-site docket (the lab shows its own) */
  hideDocket?: boolean
}

const HI_VIS = '#f5a524'
const STEEL = '#8c96a3'
const DARK = '#3c4654'
const ACCENT = '#6366f1'
const TALLY = '#8b5cf6'

// ---------------------------------------------------------------------------
// Station geometry
// ---------------------------------------------------------------------------

function Tank() {
  return (
    <group>
      <mesh position={[0, 2.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.5, 2.5, 5.2, 20]} />
        <meshLambertMaterial color="#b9c3cd" />
      </mesh>
      {/* hoop bands */}
      {[1.1, 2.6, 4.1].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[2.56, 2.56, 0.16, 20]} />
          <meshLambertMaterial color={STEEL} />
        </mesh>
      ))}
      {/* conical roof + entry hatch */}
      <mesh position={[0, 5.5, 0]} castShadow>
        <coneGeometry args={[2.7, 0.9, 20]} />
        <meshLambertMaterial color="#98a3b0" />
      </mesh>
      <mesh position={[0.9, 5.9, 0.5]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.22, 12]} />
        <meshLambertMaterial color={HI_VIS} />
      </mesh>
      {/* access ladder */}
      <group position={[0, 0, 2.55]}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[i ? 0.28 : -0.28, 2.7, 0]}>
            <boxGeometry args={[0.08, 5.4, 0.08]} />
            <meshLambertMaterial color={DARK} />
          </mesh>
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[0, 0.5 + i * 0.58, 0]}>
            <boxGeometry args={[0.62, 0.06, 0.06]} />
            <meshLambertMaterial color={DARK} />
          </mesh>
        ))}
      </group>
      {/* hazard skirt */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.7, 3.5, 32]} />
        <meshBasicMaterial color={HI_VIS} transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

function Bund() {
  return (
    <group>
      {/* containment wall */}
      {([[0, -2.6, 6.4, 0.5], [0, 2.6, 6.4, 0.5],
         [-3.2, 0, 0.5, 5.7], [3.2, 0, 0.5, 5.7]] as const).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.42, z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.84, d]} />
          <meshLambertMaterial color="#a9b2bc" />
        </mesh>
      ))}
      {/* the release itself */}
      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.9, 5.0]} />
        <meshLambertMaterial color="#c8b23a" transparent opacity={0.62} />
      </mesh>
      {/* absorbent boom across the outlet */}
      <mesh position={[2.0, 0.28, 1.9]} rotation={[0, -0.5, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 3.0, 8]} />
        <meshLambertMaterial color="#e8e3d2" />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.2, 4.9, 32]} />
        <meshBasicMaterial color={HI_VIS} transparent opacity={0.18} />
      </mesh>
    </group>
  )
}

function ValveManifold() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[3.0, 0.6, 0.9]} />
        <meshLambertMaterial color={DARK} />
      </mesh>
      {[-1.0, 0, 1.0].map((x, i) => (
        <group key={i} position={[x, 0.6, 0]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.9, 10]} />
            <meshLambertMaterial color={STEEL} />
          </mesh>
          {/* handwheel */}
          <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.36, 0.07, 8, 16]} />
            <meshLambertMaterial color="#c0392b" />
          </mesh>
          {/* LOTO tag */}
          <mesh position={[0.28, 0.72, 0.16]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.26, 0.36, 0.03]} />
            <meshLambertMaterial color={HI_VIS} />
          </mesh>
        </group>
      ))}
      {/* pipe run */}
      <mesh position={[0, 0.62, -0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 3.4, 12]} />
        <meshLambertMaterial color={STEEL} />
      </mesh>
    </group>
  )
}

function Blower() {
  const fan = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (fan.current) fan.current.rotation.z += dt * 7 })
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.2, 1.0, 1.2]} />
        <meshLambertMaterial color={HI_VIS} />
      </mesh>
      <group ref={fan} position={[0, 0.95, 0.62]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <boxGeometry args={[0.62, 0.12, 0.04]} />
            <meshLambertMaterial color={DARK} />
          </mesh>
        ))}
      </group>
      {/* flexible duct toward the tank */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[0, 0.55, -0.8 - i * 0.62]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.5, 10]} />
          <meshLambertMaterial color={i % 2 ? '#e2c96b' : '#d8bd58'} />
        </mesh>
      ))}
    </group>
  )
}

function Cabinet() {
  return (
    <group>
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.9, 0.7]} />
        <meshLambertMaterial color="#5d6b7a" />
      </mesh>
      <mesh position={[0, 0.95, 0.37]}>
        <boxGeometry args={[1.3, 1.7, 0.02]} />
        <meshLambertMaterial color="#48566b" />
      </mesh>
      {/* isolation lamps */}
      {[0.35, 0, -0.35].map((y, i) => (
        <mesh key={i} position={[0.45, 1.3 + y * 0.5, 0.4]}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 8]} />
          <meshBasicMaterial color={i === 0 ? '#e74c3c' : i === 1 ? '#f1c40f' : '#2ecc71'} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[1.7, 0.1, 0.9]} />
        <meshLambertMaterial color={DARK} />
      </mesh>
    </group>
  )
}

function Instrument() {
  return (
    <group>
      {/* tripod stand */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} castShadow
          position={[Math.cos((i * Math.PI * 2) / 3) * 0.34, 0.55,
                     Math.sin((i * Math.PI * 2) / 3) * 0.34]}
          rotation={[Math.cos((i * Math.PI * 2) / 3) * 0.3, 0,
                     -Math.sin((i * Math.PI * 2) / 3) * 0.3]}>
          <boxGeometry args={[0.08, 1.15, 0.08]} />
          <meshLambertMaterial color={DARK} />
        </mesh>
      ))}
      <mesh position={[0, 1.28, 0]} castShadow>
        <boxGeometry args={[0.72, 0.5, 0.4]} />
        <meshLambertMaterial color="#2f3d4a" />
      </mesh>
      <mesh position={[0, 1.32, 0.21]}>
        <boxGeometry args={[0.52, 0.3, 0.02]} />
        <meshBasicMaterial color="#7ee787" />
      </mesh>
      {/* sample line */}
      <mesh position={[0.3, 0.85, 0.3]} rotation={[0.5, 0, 0.4]}>
        <cylinderGeometry args={[0.03, 0.03, 1.0, 6]} />
        <meshLambertMaterial color="#cfd6dd" />
      </mesh>
    </group>
  )
}

function RescueStation() {
  return (
    <group>
      {/* tripod */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} castShadow
          position={[Math.cos((i * Math.PI * 2) / 3) * 0.85, 1.35,
                     Math.sin((i * Math.PI * 2) / 3) * 0.85]}
          rotation={[Math.cos((i * Math.PI * 2) / 3) * 0.55, 0,
                     -Math.sin((i * Math.PI * 2) / 3) * 0.55]}>
          <boxGeometry args={[0.11, 2.9, 0.11]} />
          <meshLambertMaterial color={HI_VIS} />
        </mesh>
      ))}
      <mesh position={[0, 2.75, 0]} castShadow>
        <boxGeometry args={[0.36, 0.24, 0.36]} />
        <meshLambertMaterial color={DARK} />
      </mesh>
      {/* winch line */}
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 2.0, 6]} />
        <meshLambertMaterial color="#cfd6dd" />
      </mesh>
      {/* SCBA set on the ground */}
      <mesh position={[1.3, 0.34, 0.5]} rotation={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.68, 12]} />
        <meshLambertMaterial color="#2980b9" />
      </mesh>
    </group>
  )
}

function Desk() {
  return (
    <group>
      {/* site cabin */}
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 2.0, 2.0]} />
        <meshLambertMaterial color="#e6ebf0" />
      </mesh>
      <mesh position={[0, 2.06, 0]} castShadow>
        <boxGeometry args={[3.6, 0.14, 2.2]} />
        <meshLambertMaterial color={STEEL} />
      </mesh>
      <mesh position={[0, 1.15, 1.01]}>
        <boxGeometry args={[1.9, 0.9, 0.02]} />
        <meshBasicMaterial color="#cfe4f5" />
      </mesh>
      <mesh position={[-1.25, 0.85, 1.01]}>
        <boxGeometry args={[0.7, 1.55, 0.03]} />
        <meshLambertMaterial color="#9fb0c2" />
      </mesh>
      {/* the permit board outside the door */}
      <group position={[2.2, 0, 0.6]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[1.0, 1.3, 0.06]} />
          <meshLambertMaterial color="#fdfdf7" />
        </mesh>
        {[0, 1].map((i) => (
          <mesh key={i} position={[i ? 0.4 : -0.4, 0.4, 0]}>
            <boxGeometry args={[0.07, 0.9, 0.07]} />
            <meshLambertMaterial color={DARK} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Drums() {
  return (
    <group>
      {([[0, 0, '#3f7f4f'], [0.75, 0.2, '#3f7f4f'], [0.36, 0.85, '#c9a227']] as const)
        .map(([x, z, c], i) => (
          <mesh key={i} position={[x, 0.45, z]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.9, 14]} />
            <meshLambertMaterial color={c} />
          </mesh>
        ))}
      <mesh position={[0.36, 0.05, 0.4]} castShadow>
        <boxGeometry args={[2.0, 0.1, 1.8]} />
        <meshLambertMaterial color={DARK} />
      </mesh>
    </group>
  )
}

function HoseRun() {
  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[0.5, 1.4, 0.5]} />
        <meshLambertMaterial color={STEEL} />
      </mesh>
      {/* the split hose, lying on the ground */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} castShadow
          position={[0.5 + i * 0.55, 0.16, Math.sin(i * 0.8) * 0.35]}
          rotation={[0, Math.sin(i * 0.8) * 0.4, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 0.55, 10]} />
          <meshLambertMaterial color={i === 3 ? '#c0392b' : '#33383d'} />
        </mesh>
      ))}
      <mesh position={[2.15, 0.04, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.75, 16]} />
        <meshBasicMaterial color="#c8b23a" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

function DrainGrate() {
  return (
    <group>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.5, 1.1]} />
        <meshLambertMaterial color={DARK} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-0.6 + i * 0.24, 0.07, 0]}>
          <boxGeometry args={[0.1, 0.05, 1.0]} />
          <meshLambertMaterial color={STEEL} />
        </mesh>
      ))}
      {/* the plug */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.42, 0.28, 14]} />
        <meshLambertMaterial color="#e8e3d2" />
      </mesh>
    </group>
  )
}

function NoticeBoard() {
  return (
    <group>
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[2.0, 1.3, 0.09]} />
        <meshLambertMaterial color="#2f3d4a" />
      </mesh>
      <mesh position={[0, 1.35, 0.06]}>
        <boxGeometry args={[1.8, 1.1, 0.02]} />
        <meshBasicMaterial color="#f7f5ee" />
      </mesh>
      {[-0.5, 0, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 1.35, 0.08]}>
          <boxGeometry args={[0.46, 0.62, 0.01]} />
          <meshBasicMaterial color={i === 1 ? '#dde7f3' : '#e9edf2'} />
        </mesh>
      ))}
      {[0, 1].map((i) => (
        <mesh key={i} position={[i ? 0.8 : -0.8, 0.45, 0]} castShadow>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshLambertMaterial color={DARK} />
        </mesh>
      ))}
    </group>
  )
}

const GEOM: Record<StationKind, () => ReactElement> = {
  tank: Tank, bund: Bund, valve: ValveManifold, fan: Blower, cabinet: Cabinet,
  instrument: Instrument, rescue: RescueStation, desk: Desk, drum: Drums,
  hose: HoseRun, drain: DrainGrate, board: NoticeBoard,
}

// ---------------------------------------------------------------------------

function StationNode({ st, active, visited }: {
  st: Station; active: boolean; visited: boolean
}) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ring.current) return
    const p = (Math.sin(state.clock.elapsedTime * 3.2) + 1) / 2
    const m = ring.current.material as THREE.MeshBasicMaterial
    m.opacity = active ? 0.35 + p * 0.45 : visited ? 0.16 : 0.07
    ring.current.scale.setScalar(active ? 1 + p * 0.06 : 1)
  })
  const Geo = GEOM[st.kind]
  return (
    <group position={[st.x, 0, st.z]} rotation={[0, st.rot ?? 0, 0]}>
      <Geo />
      <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[st.r + 0.25, st.r + 0.85, 44]} />
        <meshBasicMaterial color={active ? ACCENT : visited ? '#10b981' : '#94a3b8'}
                           transparent depthWrite={false} />
      </mesh>
      <Billboard position={[0, st.kind === 'tank' ? 7.1 : 2.6, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[Math.max(2.0, st.label.length * 0.19), 0.56]} />
          <meshBasicMaterial color={active ? ACCENT : '#ffffff'} transparent
                             opacity={active ? 0.95 : 0.82} depthWrite={false} />
        </mesh>
        <Text fontSize={0.26} anchorX="center" anchorY="middle"
              color={active ? '#ffffff' : '#334155'}>
          {st.label}
        </Text>
      </Billboard>
    </group>
  )
}

// ---------------------------------------------------------------------------
// The robot
// ---------------------------------------------------------------------------

function Robot({ target, act, posRef, onArrive, speed = 1 }: {
  target: [number, number]; act: HseAct
  posRef?: React.MutableRefObject<THREE.Vector3>
  onArrive?: () => void; speed?: number
}) {
  const g = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const visor = useRef<THREE.MeshBasicMaterial>(null)
  const beacon = useRef<THREE.MeshBasicMaterial>(null)
  const t = useRef(0)
  const arrived = useRef(true)
  const beat = useRef(0)

  const mBody = useMemo(() => new THREE.MeshLambertMaterial({ color: HI_VIS }), [])
  const mDark = useMemo(() => new THREE.MeshLambertMaterial({ color: DARK }), [])
  const mSteel = useMemo(() => new THREE.MeshLambertMaterial({ color: STEEL }), [])

  useFrame((_, dt) => {
    if (!g.current) return
    const p = g.current.position
    posRef?.current.copy(p)
    const dx = target[0] - p.x, dz = target[1] - p.z
    const dist = Math.hypot(dx, dz)

    // status beacon always pulses -- it reads as "this is a machine, and it is on"
    if (beacon.current) {
      beacon.current.opacity = 0.45 + 0.55 * (Math.sin(t.current * 6) + 1) / 2
    }

    if (dist > 0.08) {
      arrived.current = false
      beat.current = 0
      // constant-DURATION travel, same trick as VoxelRoom: the pacer must not
      // outrun the character on a long walk across the site
      const walkTime = 0.9 / speed
      const sp = Math.min(dist, THREE.MathUtils.clamp(dist / walkTime, 2.5, 26) * dt)
      p.x += (dx / dist) * sp
      p.z += (dz / dist) * sp
      const want = Math.atan2(dx, dz)
      const cur = g.current.rotation.y
      const d = ((want - cur + Math.PI) % (Math.PI * 2)) - Math.PI
      g.current.rotation.y = cur + d * (1 - Math.exp(-9 * dt))
      t.current += dt * 9 * Math.min(2, speed)
      const s = Math.sin(t.current) * 0.62
      if (legL.current) legL.current.rotation.x = s
      if (legR.current) legR.current.rotation.x = -s
      if (armL.current) armL.current.rotation.x = -s * 0.5
      if (armR.current) armR.current.rotation.x = s * 0.5
      p.y = Math.abs(Math.sin(t.current)) * 0.04
      if (visor.current) visor.current.color.set('#7dd3fc')
    } else {
      const ease = (r: THREE.Group | null, to = 0, k = 8) => {
        if (r) r.rotation.x += (to - r.rotation.x) * Math.min(1, dt * k)
      }
      ease(legL.current); ease(legR.current)
      p.y += (0 - p.y) * Math.min(1, dt * 8)
      t.current += dt

      if (!arrived.current) {
        beat.current += dt
        if (beat.current > (act === 'idle' ? 0.12 : 0.45) / speed) {
          arrived.current = true
          onArrive?.()
        }
      }

      // per-action gesture, and a visor colour that names the channel at work
      if (act === 'scan' || act === 'sample') {
        ease(armR.current, -1.4 + Math.sin(t.current * 5) * 0.2, 9)
        ease(armL.current, -0.2, 7)
        if (head.current) head.current.rotation.y = Math.sin(t.current * 2.2) * 0.35
        if (visor.current) visor.current.color.set('#38bdf8')
      } else if (act === 'write') {
        ease(armR.current, -1.1, 9); ease(armL.current, -0.9, 9)
        if (head.current) head.current.rotation.x = 0.28
        if (visor.current) visor.current.color.set('#a5b4fc')
      } else if (act === 'attest') {
        // the inert Layer-2 step: a glance, nothing touched
        ease(armR.current, -0.1, 7); ease(armL.current, -0.1, 7)
        if (head.current) head.current.rotation.y = Math.sin(t.current * 1.4) * 0.5
        if (visor.current) visor.current.color.set(TALLY)
      } else {
        ease(armR.current, -0.9 + Math.sin(t.current * 3) * 0.12, 8)
        ease(armL.current, -0.15, 7)
        if (head.current) {
          head.current.rotation.y += (0 - head.current.rotation.y) * Math.min(1, dt * 6)
          head.current.rotation.x += (0 - head.current.rotation.x) * Math.min(1, dt * 6)
        }
        if (visor.current) visor.current.color.set('#7dd3fc')
      }
    }
  })

  return (
    <group ref={g} position={[0, 0, 4]}>
      <group position={[0, 0.92, 0]}>
        {/* legs */}
        <group ref={legL} position={[-0.19, 0, 0]}>
          <mesh position={[0, -0.3, 0]} material={mDark} castShadow>
            <boxGeometry args={[0.19, 0.62, 0.19]} />
          </mesh>
          <mesh position={[0, -0.64, 0.04]} material={mSteel} castShadow>
            <boxGeometry args={[0.25, 0.12, 0.32]} />
          </mesh>
        </group>
        <group ref={legR} position={[0.19, 0, 0]}>
          <mesh position={[0, -0.3, 0]} material={mDark} castShadow>
            <boxGeometry args={[0.19, 0.62, 0.19]} />
          </mesh>
          <mesh position={[0, -0.64, 0.04]} material={mSteel} castShadow>
            <boxGeometry args={[0.25, 0.12, 0.32]} />
          </mesh>
        </group>

        {/* torso: hi-vis shell with a dark chest panel */}
        <mesh position={[0, 0.3, 0]} material={mBody} castShadow>
          <boxGeometry args={[0.66, 0.72, 0.42]} />
        </mesh>
        <mesh position={[0, 0.32, 0.22]} material={mDark}>
          <boxGeometry args={[0.4, 0.44, 0.03]} />
        </mesh>
        {/* reflective bands, like a hi-vis vest */}
        {[0.12, 0.5].map((y, i) => (
          <mesh key={i} position={[0, y, 0.215]}>
            <boxGeometry args={[0.68, 0.07, 0.02]} />
            <meshBasicMaterial color="#e8eef5" />
          </mesh>
        ))}
        {/* status beacon on the shoulder */}
        <mesh position={[0.24, 0.7, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial ref={beacon} color="#ef4444" transparent />
        </mesh>

        {/* arms */}
        <group ref={armL} position={[-0.42, 0.52, 0]}>
          <mesh position={[0, -0.28, 0]} material={mSteel} castShadow>
            <boxGeometry args={[0.15, 0.6, 0.15]} />
          </mesh>
          <mesh position={[0, -0.62, 0]} material={mDark} castShadow>
            <boxGeometry args={[0.17, 0.14, 0.17]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.42, 0.52, 0]}>
          <mesh position={[0, -0.28, 0]} material={mSteel} castShadow>
            <boxGeometry args={[0.15, 0.6, 0.15]} />
          </mesh>
          {/* the sensing head on the working arm */}
          <mesh position={[0, -0.64, 0.02]} material={mDark} castShadow>
            <boxGeometry args={[0.2, 0.18, 0.24]} />
          </mesh>
          <mesh position={[0, -0.64, 0.15]}>
            <boxGeometry args={[0.1, 0.08, 0.02]} />
            <meshBasicMaterial color="#7ee787" />
          </mesh>
        </group>

        {/* head: boxy, with a wraparound visor and an antenna */}
        <group ref={head} position={[0, 0.92, 0]}>
          <mesh material={mBody} castShadow>
            <boxGeometry args={[0.52, 0.42, 0.44]} />
          </mesh>
          <mesh position={[0, 0.02, 0.225]}>
            <boxGeometry args={[0.42, 0.2, 0.02]} />
            <meshBasicMaterial ref={visor} color="#7dd3fc" />
          </mesh>
          {/* ear pods */}
          {[-0.28, 0.28].map((x, i) => (
            <mesh key={i} position={[x, 0, 0]} material={mDark}>
              <boxGeometry args={[0.06, 0.18, 0.18]} />
            </mesh>
          ))}
          <mesh position={[0.16, 0.3, 0]} material={mDark}>
            <boxGeometry args={[0.03, 0.24, 0.03]} />
          </mesh>
          <mesh position={[0.16, 0.44, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={TALLY} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------

/** A red cross over an asset whose record was erased -- the step never lands. */
function ErasedMark({ at }: { at: [number, number] }) {
  const g = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!g.current) return
    const p = (Math.sin(state.clock.elapsedTime * 5) + 1) / 2
    g.current.scale.setScalar(1 + p * 0.12)
  })
  return (
    <group ref={g} position={[at[0], 2.2, at[1]]}>
      <Billboard>
        {[0.7, -0.7].map((r, i) => (
          <mesh key={i} rotation={[0, 0, r]}>
            <planeGeometry args={[1.5, 0.22]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.95}
                               depthWrite={false} depthTest={false} />
          </mesh>
        ))}
      </Billboard>
    </group>
  )
}

/**
 * Where the agent actually went, when the log claims somewhere else.
 * A dashed amber run from the true asset to the one now on record.
 */
function DivertedPath({ from, to }: { from: [number, number]; to: [number, number] }) {
  const dx = to[0] - from[0], dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  if (len < 0.6) return null
  const n = Math.max(3, Math.floor(len / 0.9))
  return (
    <group>
      {Array.from({ length: n }).map((_, i) => {
        const t = (i + 0.5) / n
        return (
          <mesh key={i} position={[from[0] + dx * t, 0.09, from[1] + dz * t]}
                rotation={[-Math.PI / 2, 0, -Math.atan2(dz, dx)]}>
            <planeGeometry args={[0.5, 0.16]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.85}
                               depthWrite={false} />
          </mesh>
        )
      })}
      {/* marker over the asset the agent really worked */}
      <group position={[from[0], 1.9, from[1]]}>
        <Billboard>
          <mesh>
            <circleGeometry args={[0.32, 20]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.35}
                               depthWrite={false} />
          </mesh>
        </Billboard>
      </group>
    </group>
  )
}

function Ground({ radius, kind }: { radius: number; kind: 'concrete' | 'asphalt' }) {
  const base = kind === 'asphalt' ? '#5d6167' : '#9aa2ab'
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius, 48]} />
        <meshLambertMaterial color={base} />
      </mesh>
      {/* hazard walkway ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[radius - 2.4, radius - 2.1, 48]} />
        <meshBasicMaterial color={HI_VIS} transparent opacity={0.35} />
      </mesh>
      {/* expansion joints */}
      {[-8, -4, 0, 4, 8].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 0]}>
          <planeGeometry args={[0.06, radius * 1.9]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.07} />
        </mesh>
      ))}
    </group>
  )
}

function smoothDamp(cur: THREE.Vector3, goal: THREE.Vector3, vel: THREE.Vector3,
                    smoothTime: number, dt: number) {
  const omega = 2 / Math.max(0.0001, smoothTime)
  const x = omega * dt
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = cur.clone().sub(goal)
  const temp = vel.clone().addScaledVector(change, omega).multiplyScalar(dt)
  vel.sub(temp.clone().multiplyScalar(omega)).multiplyScalar(exp)
  cur.copy(goal).add(change.addScaledVector(temp, 1).multiplyScalar(exp))
}

function Chase({ bodyRef, radius }: {
  bodyRef: React.MutableRefObject<THREE.Vector3>; radius: number
}) {
  const pos = useRef(new THREE.Vector3(0, 11, 17))
  const posVel = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3(0, 1.4, 0))
  const lookVel = useRef(new THREE.Vector3())
  const goal = useRef(new THREE.Vector3())
  const lookGoal = useRef(new THREE.Vector3())
  useFrame(({ camera }, dt) => {
    const b = bodyRef.current
    const d = Math.min(dt, 1 / 30)
    goal.current.set(b.x * 0.6, radius * 0.42, b.z * 0.6 + radius * 0.62)
    lookGoal.current.set(b.x * 0.88, 1.5, b.z * 0.88)
    smoothDamp(pos.current, goal.current, posVel.current, 0.78, d)
    smoothDamp(look.current, lookGoal.current, lookVel.current, 0.46, d)
    camera.position.copy(pos.current)
    camera.lookAt(look.current)
  })
  return null
}

// ---------------------------------------------------------------------------

export default function HseSite({ s, expanded, onToggleExpand, onArrive, speed = 1 }: {
  s: HseSceneState; expanded?: boolean; onToggleExpand?: () => void
  onArrive?: () => void; speed?: number
}) {
  const { t } = useI18n()
  const bodyRef = useRef(new THREE.Vector3(0, 0, 4))
  const site: SiteModel | null = useMemo(() => siteFor(s.taskType), [s.taskType])

  // An action with no station of its own (the read-only attestation) is done
  // where the robot already stands -- it must not read as travel to a new asset.
  const lastSt = useRef<Station | undefined>(undefined)
  const st = useMemo(() => {
    if (!site) return undefined
    const found = stationFor(site, s.command)
    if (found) lastSt.current = found
    return found ?? lastSt.current
  }, [site, s.command])
  const act = actOf(s.command, s.confirm)

  // derived from the station's own footprint, so the robot can never end up
  // standing inside the geometry (see standAt)
  const stand: [number, number] = st ? standAt(st) : [0, 4]

  // Where the agent REALLY worked, when the log has been rewritten. A swapped
  // identity usually belongs to a different asset, so this is the visible cost
  // of the rewrite: the recorded walk no longer matches the walk that happened.
  const ghostSt = useMemo(
    () => (site && s.ghostCommand ? stationFor(site, s.ghostCommand) : undefined),
    [site, s.ghostCommand])
  const diverted = s.attack === 'rewritten' && ghostSt && st && ghostSt.id !== st.id
  const ghostStand: [number, number] | null = diverted ? standAt(ghostSt!) : null

  const [docketOpen, setDocketOpen] = useState(true)
  const recent = s.lines.slice(-9)

  if (!site) {
    return <div className="w-full h-full grid place-items-center text-xs text-slate-400">
      {t('standby')}
    </div>
  }

  return (
    <div className="relative w-full h-full rounded-core overflow-hidden">
      <Canvas shadows="soft" dpr={[1, 2]} camera={{ fov: 46, position: [0, 11, 17] }}
              gl={{ antialias: true }}>
        <color attach="background" args={['#aec6dd']} />
        <fog attach="fog" args={['#bcd0e2', 26, 62]} />

        <hemisphereLight args={['#ffffff', '#7f8b98', 0.8]} />
        <directionalLight
          position={[-10, 16, -7]} intensity={1.4} castShadow
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0008}
          shadow-camera-left={-20} shadow-camera-right={20}
          shadow-camera-top={20} shadow-camera-bottom={-20} />
        <directionalLight position={[9, 10, 11]} intensity={0.32} color="#dce9ff" />

        <Ground radius={site.radius} kind={site.ground} />

        {site.stations.map((station) => (
          <StationNode key={station.id} st={station}
            active={station.id === st?.id}
            visited={s.visited.includes(station.id)} />
        ))}

        {ghostStand && <DivertedPath from={ghostStand} to={stand} />}
        {s.attack === 'erased' && st && <ErasedMark at={stand} />}

        <Robot target={stand} act={act} posRef={bodyRef}
               onArrive={onArrive} speed={speed} />
        <ContactShadows position={[0, 0.03, 0]} scale={site.radius * 1.6} blur={2.4}
                        opacity={0.34} far={6} resolution={512} />
        <Chase bodyRef={bodyRef} radius={site.radius} />

        <EffectComposer enableNormalPass multisampling={0}>
          <N8AO aoRadius={1.1} intensity={2.0} distanceFalloff={0.8} quality="performance" />
          <SMAA />
          <Vignette eskil={false} offset={0.22} darkness={0.5} />
        </EffectComposer>
      </Canvas>

      {/* site plate */}
      <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-2">
        {onToggleExpand && (
          <button onClick={onToggleExpand} title={expanded ? 'restore' : 'expand'}
            className="pointer-events-auto rounded-lg bg-slate-900/50 backdrop-blur
                       px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-900/70">
            {expanded ? '⤡' : '⤢'}
          </button>
        )}
        <div className="rounded-lg bg-slate-900/55 backdrop-blur px-2.5 py-1 text-white">
          <div className="text-[11px] font-semibold leading-none">{site.title}</div>
          <div className="text-[9px] text-white/60 mt-0.5">{site.subtitle}</div>
        </div>
      </div>

      {/* the on-site docket: the record being built, with its per-step counts */}
      <div className={[
        'absolute right-2.5 top-2.5 bottom-14 w-[15.5rem] max-w-[45%]',
        'flex flex-col pointer-events-none',
        s.hideDocket ? 'hidden' : '',
      ].join(' ')}>
        <button onClick={() => setDocketOpen((v) => !v)}
          className="pointer-events-auto self-end mb-1 rounded-md bg-slate-900/50 backdrop-blur
                     px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-slate-900/70">
          {docketOpen ? t('docketHide') : t('docketShow')}
        </button>
        {docketOpen && (
          <div className="flex-1 min-h-0 overflow-hidden rounded-lg bg-white/88 backdrop-blur
                          ring-1 ring-white/60 shadow-lg flex flex-col">
            <div className="shrink-0 px-2 py-1.5 border-b border-slate-200/70">
              <div className="text-[9px] font-semibold tracking-wide text-l1-700">
                {t('docketTitle')}
              </div>
              <div className="text-[8px] text-slate-400">
                {s.lines.length} {t('permitStamped')}
              </div>
            </div>
            <div className="flex-1 overflow-hidden px-2 py-1.5 space-y-1">
              {recent.map((l) => (
                <div key={l.i} className="flex items-start gap-1.5">
                  <span className="mono text-[8px] text-slate-300 w-4 shrink-0 pt-[2px]">
                    {String(l.i + 1).padStart(2, '0')}
                  </span>
                  <span className="mono flex-1 min-w-0 text-[8.5px] leading-snug
                                   text-slate-600 truncate">
                    {l.chosen}
                  </span>
                  <span className="flex items-center gap-[2px] shrink-0 pt-[2px]">
                    {Array.from({ length: Math.max(1, l.k) }).map((_, i) => (
                      <span key={i} className="inline-block h-2 w-1.5 rounded-[1px]"
                            style={{ background: i === 0 ? TALLY : '#a78bfa' }} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <div className="shrink-0 px-2 py-1 border-t border-slate-200/70
                            text-[8px] text-slate-400">
              {t('docketLegend')}
            </div>
          </div>
        )}
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute left-2.5 bottom-2.5 right-2.5 flex items-center gap-2">
        <span className={[
          'chip shrink-0 shadow-sm',
          s.confirm ? 'bg-l2-500 text-white' : 'bg-white/92 text-slate-700',
        ].join(' ')}>
          {s.confirm ? t('tallyReadOnly') : t('step', { n: s.step })}
        </span>
        <div className={[
          'flex-1 truncate rounded-lg backdrop-blur px-2.5 py-1 text-xs shadow-sm',
          s.attack === 'erased' ? 'bg-rose-600/85 text-white'
            : s.attack === 'rewritten' ? 'bg-amber-500/90 text-white'
              : 'bg-slate-900/55 text-white',
        ].join(' ')}>
          {s.attack === 'erased' && <span className="font-semibold mr-1.5">RECORD ERASED ·</span>}
          {s.attack === 'rewritten' && <span className="font-semibold mr-1.5">LOG REWRITTEN ·</span>}
          {s.command ? describeHse(s.command, s.confirm) : t('standby')}
          {st && <span className="ml-2 text-[10px] text-white/60">@ {st.label}</span>}
          {diverted && (
            <span className="ml-2 text-[10px] text-white/80">
              (really worked {ghostSt!.label})
            </span>
          )}
        </div>
      </div>

      {s.done && (
        <div className={[
          'pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 px-3 py-1',
          'rounded-full text-xs font-semibold backdrop-blur shadow',
          s.success ? 'bg-emerald-500/92 text-white' : 'bg-rose-500/92 text-white',
        ].join(' ')}>
          {s.success ? `✓ ${t('recordClosed')}` : `✗ ${t('taskFailed')}`}
        </div>
      )}
    </div>
  )
}
