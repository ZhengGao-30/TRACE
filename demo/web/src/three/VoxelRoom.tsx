import { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, ContactShadows, Billboard } from '@react-three/drei'
import { EffectComposer, N8AO, Vignette, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import { blueprintOf, itemColor, accentOf, categoryOf } from './blocks'
import type { Box } from './blocks'
import {
  blockMaterial, surfaceMaterial, FLOOR, WALL, WALL_LOWER, RUG, CEILING,
  SKIN, SHIRT, PANTS, HAIR,
} from './textures'
import { parseCommand, describe } from '../lib/room'
import { layoutRoom3D } from './layout3d'
import type { Kind, ParsedCmd } from '../lib/room'
import { useI18n } from '../i18n'

export interface SceneState {
  receptacles: string[]
  command?: string
  confirm?: boolean
  visited: string[]
  opened: string[]
  carrying?: string
  done?: boolean
  success?: boolean
  step: number
}

const WALL_H = 5.6

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------
function Blocks({ boxes, open }: { boxes: Box[]; open: number }) {
  return (
    <>
      {boxes.map((bx, i) => {
        if (bx.door) {
          return (
            <group key={i} position={[bx.p[0] - bx.s[0] / 2, bx.p[1], bx.p[2]]}
                   rotation={[0, -open * Math.PI * 0.6, 0]}>
              <mesh position={[bx.s[0] / 2, 0, 0]} material={blockMaterial(bx.c)}
                    castShadow receiveShadow>
                <boxGeometry args={bx.s} />
              </mesh>
            </group>
          )
        }
        if (bx.drawer) {
          return (
            <mesh key={i} position={[bx.p[0], bx.p[1], bx.p[2] + open * 0.34]}
                  material={blockMaterial(bx.c)} castShadow receiveShadow>
              <boxGeometry args={bx.s} />
            </mesh>
          )
        }
        return (
          <mesh key={i} position={bx.p} material={blockMaterial(bx.c)}
                castShadow receiveShadow>
            <boxGeometry args={bx.s} />
          </mesh>
        )
      })}
    </>
  )
}

function NameTag({ text, y, accent, active, visited, near }: {
  text: string; y: number; accent: string
  active: boolean; visited: boolean; near: boolean
}) {
  // Distance-compensated scale: the tag keeps a CONSTANT on-screen size, so a
  // piece right in front of the camera no longer covers half the room.
  const grp = useRef<THREE.Group>(null)
  const world = useRef(new THREE.Vector3())
  useFrame(({ camera }) => {
    if (!grp.current) return
    grp.current.getWorldPosition(world.current)
    const d = camera.position.distanceTo(world.current)
    const k = THREE.MathUtils.clamp(d * 0.048, 0.45, 1.35)
    grp.current.scale.setScalar(k)
  })

  if (!active && !near && !visited) return null      // declutter the far field

  const w = 0.17 * text.length + 0.3
  const op = active ? 0.97 : near ? 0.8 : 0.55
  return (
    <group ref={grp} position={[0, y, 0]}>
      <Billboard>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[w, 0.4]} />
          <meshBasicMaterial color={active ? accent : '#ffffff'} transparent
                             opacity={op} depthWrite={false} />
        </mesh>
        <mesh position={[0, -0.225, -0.005]}>
          <planeGeometry args={[w, 0.055]} />
          <meshBasicMaterial color={accent} transparent
                             opacity={active ? 1 : 0.8} depthWrite={false} />
        </mesh>
        <Text fontSize={0.24} anchorX="center" anchorY="middle"
              color={active ? '#ffffff' : '#111827'} letterSpacing={-0.02}>
          {text}
        </Text>
      </Billboard>
    </group>
  )
}

function Furniture({ id, kind, pos, rot, opened, active, visited, near }: {
  id: string; kind: Kind; pos: [number, number]; rot: number
  opened: boolean; active: boolean; visited: boolean; near: boolean
}) {
  const bp = useMemo(() => blueprintOf(kind), [kind])
  const accent = useMemo(() => accentOf(kind), [kind])
  const anim = useRef(0)
  const [, force] = useState(0)
  const ring = useRef<THREE.Mesh>(null)
  const tagY = useRef(bp.h + 0.55)

  useFrame((state, dt) => {
    const target = opened ? 1 : 0
    const next = anim.current + (target - anim.current) * (1 - Math.exp(-9 * dt))
    if (Math.abs(next - anim.current) > 0.0015) { anim.current = next; force((n) => n + 1) }
    if (ring.current) {
      const k = 1 + Math.sin(state.clock.elapsedTime * 3.4) * 0.07
      ring.current.scale.set(k, k, 1)
    }
  })

  // footprint of the piece, so the base plate matches its size
  const fw = Math.max(...bp.boxes.map((b) => Math.abs(b.p[0]) + b.s[0] / 2)) * 2 + 0.28
  const fd = Math.max(...bp.boxes.map((b) => Math.abs(b.p[2]) + b.s[2] / 2)) * 2 + 0.28

  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, rot, 0]}>
      {/* category base plate -- the main "which kind is this" cue on the floor */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[fw, fd]} />
        <meshBasicMaterial color={accent} transparent
                           opacity={active ? 0.5 : visited ? 0.26 : 0.16} />
      </mesh>

      <Blocks boxes={bp.boxes} open={anim.current} />

      {/* accent trim across the front, colour-matched to the name tag */}
      <mesh position={[0, 0.08, fd / 2 - 0.16]}>
        <boxGeometry args={[fw * 0.72, 0.09, 0.09]} />
        <meshLambertMaterial color={accent} />
      </mesh>

      {active && (
        <mesh ref={ring} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(fw, fd) * 0.55, Math.max(fw, fd) * 0.7, 40]} />
          <meshBasicMaterial color={accent} transparent opacity={0.95} />
        </mesh>
      )}

      <NameTag text={id} y={tagY.current} accent={accent}
               active={active} visited={visited} near={near} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
type Act = 'idle' | 'open' | 'take' | 'put' | 'fx' | 'look'

function Player({ target, action, carrying, posRef, onArrive, speed = 1 }: {
  target: [number, number]; action: Act; carrying?: string
  posRef?: React.MutableRefObject<THREE.Vector3>
  onArrive?: () => void
  speed?: number
}) {
  const g = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const t = useRef(0)
  const arrived = useRef(true)
  const beat = useRef(0)

  const mSkin = useMemo(() => new THREE.MeshLambertMaterial({ map: SKIN() }), [])
  const mShirt = useMemo(() => new THREE.MeshLambertMaterial({ map: SHIRT() }), [])
  const mPants = useMemo(() => new THREE.MeshLambertMaterial({ map: PANTS() }), [])
  const mHair = useMemo(() => new THREE.MeshLambertMaterial({ map: HAIR() }), [])

  useFrame((_, dt) => {
    if (!g.current) return
    const p = g.current.position
    posRef?.current.copy(p)
    const dx = target[0] - p.x, dz = target[1] - p.z
    const dist = Math.hypot(dx, dz)

    if (dist > 0.07) {
      arrived.current = false
      beat.current = 0
      // Constant-DURATION travel: speed scales with the remaining distance so a
      // walk across the room takes about as long as a short hop. Without this
      // the event pacer runs ahead of the character on long walks.
      const walkTime = 0.85 / speed          // seconds, whatever the distance
      const sp = Math.min(dist, THREE.MathUtils.clamp(dist / walkTime, 2.5, 26) * dt)
      p.x += (dx / dist) * sp
      p.z += (dz / dist) * sp
      const want = Math.atan2(dx, dz)
      const cur = g.current.rotation.y
      const d = ((want - cur + Math.PI) % (Math.PI * 2)) - Math.PI
      g.current.rotation.y = cur + d * (1 - Math.exp(-9 * dt))
      t.current += dt * 9.5 * Math.min(2, speed)
      const s = Math.sin(t.current) * 0.72
      if (legL.current) legL.current.rotation.x = s
      if (legR.current) legR.current.rotation.x = -s
      if (armL.current) armL.current.rotation.x = -s * 0.82
      if (armR.current) armR.current.rotation.x = s * 0.82
      p.y = Math.abs(Math.sin(t.current)) * 0.05
    } else {
      const ease = (r: THREE.Group | null, to = 0, k = 8) => {
        if (r) r.rotation.x += (to - r.rotation.x) * Math.min(1, dt * k)
      }
      ease(legL.current); ease(legR.current)
      p.y += (0 - p.y) * Math.min(1, dt * 8)
      t.current += dt

      // a short beat on arrival so the reach / glance animation can be seen
      if (!arrived.current) {
        beat.current += dt
        if (beat.current > (action === 'idle' ? 0.12 : 0.42) / speed) {
          arrived.current = true
          onArrive?.()
        }
      }

      if (action === 'open' || action === 'take' || action === 'put' || action === 'fx') {
        ease(armR.current, -1.35 + Math.sin(t.current * 5) * 0.22, 9)
        ease(armL.current, -0.25, 7)
        if (head.current) head.current.rotation.y += (0 - head.current.rotation.y) * Math.min(1, dt * 7)
      } else if (action === 'look') {
        // tally-channel confirm: the agent only glances -- nothing is touched
        if (head.current) head.current.rotation.y = Math.sin(t.current * 3.2) * 0.75
        ease(armR.current); ease(armL.current)
      } else {
        if (head.current) head.current.rotation.y += (0 - head.current.rotation.y) * Math.min(1, dt * 6)
        ease(armR.current); ease(armL.current)
      }
    }
  })

  return (
    <group ref={g}>
      <group ref={legL} position={[-0.17, 0.72, 0]}>
        <mesh position={[0, -0.36, 0]} material={mPants} castShadow>
          <boxGeometry args={[0.3, 0.72, 0.3]} />
        </mesh>
      </group>
      <group ref={legR} position={[0.17, 0.72, 0]}>
        <mesh position={[0, -0.36, 0]} material={mPants} castShadow>
          <boxGeometry args={[0.3, 0.72, 0.3]} />
        </mesh>
      </group>
      <mesh position={[0, 1.08, 0]} material={mShirt} castShadow>
        <boxGeometry args={[0.64, 0.72, 0.34]} />
      </mesh>
      <group ref={armL} position={[-0.48, 1.4, 0]}>
        <mesh position={[0, -0.34, 0]} material={mShirt} castShadow>
          <boxGeometry args={[0.28, 0.7, 0.28]} />
        </mesh>
      </group>
      <group ref={armR} position={[0.48, 1.4, 0]}>
        <mesh position={[0, -0.34, 0]} material={mShirt} castShadow>
          <boxGeometry args={[0.28, 0.7, 0.28]} />
        </mesh>
        {carrying && (
          <mesh position={[0, -0.8, 0.18]} castShadow>
            <boxGeometry args={[0.28, 0.28, 0.28]} />
            <meshLambertMaterial color={itemColor(carrying)} />
          </mesh>
        )}
      </group>
      <group ref={head} position={[0, 1.78, 0]}>
        <mesh material={mSkin} castShadow>
          <boxGeometry args={[0.56, 0.56, 0.56]} />
        </mesh>
        <mesh position={[0, 0.21, 0]} material={mHair}>
          <boxGeometry args={[0.6, 0.2, 0.6]} />
        </mesh>
        <mesh position={[0, 0.02, -0.29]} material={mHair}>
          <boxGeometry args={[0.58, 0.42, 0.04]} />
        </mesh>
        {[-0.14, 0.14].map((x, i) => (
          <group key={i}>
            <mesh position={[x, 0.04, 0.29]}>
              <boxGeometry args={[0.13, 0.1, 0.02]} />
              <meshLambertMaterial color="#f3f3f3" />
            </mesh>
            <mesh position={[x + (i ? 0.03 : -0.03), 0.04, 0.305]}>
              <boxGeometry args={[0.06, 0.1, 0.02]} />
              <meshLambertMaterial color="#2f3a4a" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------
function Burst({ at, color, seed }: { at: [number, number]; color: string; seed: number }) {
  const t = useRef(0)
  const grp = useRef<THREE.Group>(null)
  const parts = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      a: (i / 18) * Math.PI * 2 + seed * 0.7,
      r: 0.25 + ((i * 37 + seed * 91) % 60) / 110,
      h: 0.3 + ((i * 53 + seed * 17) % 90) / 90,
      s: 0.07 + ((i * 29) % 8) / 90,
    })), [seed])

  useFrame((_, dt) => {
    t.current = Math.min(1, t.current + dt * 1.05)
    if (grp.current) grp.current.rotation.y += dt * 0.6
  })

  return (
    <group ref={grp} position={[at[0], 1.05, at[1]]}>
      {parts.map((p, i) => (
        <mesh key={i}
          position={[Math.cos(p.a) * p.r * (0.4 + t.current * 1.7),
                     p.h * t.current * 1.8,
                     Math.sin(p.a) * p.r * (0.4 + t.current * 1.7)]}
          rotation={[t.current * 3, t.current * 2, 0]}>
          <boxGeometry args={[p.s, p.s, p.s]} />
          <meshLambertMaterial color={color} transparent opacity={1 - t.current * 0.85} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Room shell: floor, walls, skirting, window with a light shaft, ceiling lamp
// ---------------------------------------------------------------------------
function Shell({ ROOM }: { ROOM: number }) {
  const HALF = ROOM / 2
  const floor = useMemo(() => surfaceMaterial('floor', FLOOR(), Math.round(ROOM)), [ROOM])
  const wall = useMemo(() => surfaceMaterial('wall', WALL(), 8), [])
  const wallLo = useMemo(() => surfaceMaterial('wallLo', WALL_LOWER(), 8), [])
  const rug = useMemo(() => surfaceMaterial('rug', RUG(), 3), [])
  const ceil = useMemo(() => surfaceMaterial('ceil', CEILING(), 6), [])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={floor}>
        <planeGeometry args={[ROOM, ROOM]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.5]} receiveShadow material={rug}>
        <planeGeometry args={[7.5, 5]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0]} material={ceil}>
        <planeGeometry args={[ROOM, ROOM]} />
      </mesh>

      {/* three walls (the fourth is open toward the camera) */}
      {([[0, -HALF, 0], [-HALF, 0, Math.PI / 2], [HALF, 0, -Math.PI / 2]] as const).map(
        ([x, z, ry], i) => (
          <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
            <mesh position={[0, WALL_H / 2 + 1.1, 0]} receiveShadow material={wall}>
              <boxGeometry args={[ROOM, WALL_H - 1.1, 0.35]} />
            </mesh>
            <mesh position={[0, 0.55, 0]} receiveShadow material={wallLo}>
              <boxGeometry args={[ROOM, 1.1, 0.38]} />
            </mesh>
            {/* skirting board */}
            <mesh position={[0, 0.12, 0.2]} material={blockMaterial('#cda06a')}>
              <boxGeometry args={[ROOM, 0.24, 0.06]} />
            </mesh>
          </group>
        ))}

      {/* window on the back wall + a volumetric-ish light shaft */}
      <group position={[-4.5, 3.1, -HALF + 0.2]}>
        <mesh material={blockMaterial('#cda06a')}>
          <boxGeometry args={[3.4, 2.6, 0.16]} />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[3.0, 2.2, 0.08]} />
          <meshBasicMaterial color="#dff0ff" />
        </mesh>
        <mesh position={[0, 0, 0.1]} material={blockMaterial('#cda06a')}>
          <boxGeometry args={[0.1, 2.2, 0.06]} />
        </mesh>
        <mesh position={[0, 0, 0.1]} material={blockMaterial('#cda06a')}>
          <boxGeometry args={[3.0, 0.1, 0.06]} />
        </mesh>
      </group>
      <mesh position={[-3.2, 1.6, -6.0]} rotation={[0.62, 0.22, 0]}>
        <planeGeometry args={[3.4, 7.4]} />
        <meshBasicMaterial color="#fff6da" transparent opacity={0.14}
                           side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* ceiling lamp */}
      <group position={[0, WALL_H - 0.02, 0]}>
        <mesh position={[0, -0.35, 0]} material={blockMaterial('#33383d')}>
          <boxGeometry args={[0.08, 0.7, 0.08]} />
        </mesh>
        <mesh position={[0, -0.85, 0]} material={blockMaterial('#eceff2')}>
          <boxGeometry args={[1.5, 0.32, 1.5]} />
        </mesh>
        <mesh position={[0, -1.03, 0]}>
          <boxGeometry args={[1.2, 0.06, 1.2]} />
          <meshBasicMaterial color="#fff3cf" />
        </mesh>
        <pointLight position={[0, -1.2, 0]} intensity={22} distance={17}
                    color="#fff0cd" castShadow />
      </group>

      {/* a couple of potted plants for life */}
      {([[-HALF + 1.6, HALF - 1.6], [HALF - 1.6, HALF - 1.8]] as const).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.28, 0]} material={blockMaterial('#a8422f')} castShadow>
            <boxGeometry args={[0.62, 0.56, 0.62]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} castShadow
              position={[Math.cos(k * 1.6) * 0.22, 0.75 + (k % 2) * 0.3, Math.sin(k * 1.6) * 0.22]}
              rotation={[0, k * 0.9, 0.2]}>
              <boxGeometry args={[0.5, 0.1, 0.16]} />
              <meshLambertMaterial color={k % 2 ? '#4f8f43' : '#5da84f'} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Third-person chase camera with a gentle drift
// ---------------------------------------------------------------------------
/**
 * Critically damped chase camera.
 *
 * Two things make it feel smooth: it follows the player's ACTUAL body position
 * (which is itself easing toward the goal) rather than snapping between goal
 * points, and it uses a SmoothDamp spring -- velocity is carried across frames,
 * so there is no overshoot and no per-frame jerk when the goal jumps.
 */
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

function Chase({ bodyRef, room }: { bodyRef: React.MutableRefObject<THREE.Vector3>; room: number }) {
  const pos = useRef(new THREE.Vector3(0, 9.5, 15))
  const posVel = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3(0, 1.2, 0))
  const lookVel = useRef(new THREE.Vector3())
  const goal = useRef(new THREE.Vector3())
  const lookGoal = useRef(new THREE.Vector3())

  useFrame(({ camera }, dt) => {
    const b = bodyRef.current
    const d = Math.min(dt, 1 / 30)                 // clamp hitches
    // stay behind and above the player, pulled slightly toward the room centre
    const back = room * 0.52
    goal.current.set(b.x * 0.62, room * 0.36, b.z * 0.62 + back)
    lookGoal.current.set(b.x * 0.9, 1.35, b.z * 0.9)
    smoothDamp(pos.current, goal.current, posVel.current, 0.75, d)
    smoothDamp(look.current, lookGoal.current, lookVel.current, 0.45, d)
    camera.position.copy(pos.current)
    camera.lookAt(look.current)
  })
  return null
}

// ---------------------------------------------------------------------------

const FX_COLOR: Record<string, string> = {
  cool: '#8fd4f5', heat: '#ff9a45', clean: '#6fe0e6', take: '#ffd75e', put: '#7fd45f',
}

export default function VoxelRoom({ s, expanded, onToggleExpand, onArrive, speed = 1 }:
  { s: SceneState; expanded?: boolean; onToggleExpand?: () => void
    onArrive?: () => void; speed?: number }) {
  const { t } = useI18n()
  const bodyRef = useRef(new THREE.Vector3())
  const layout = useMemo(() => layoutRoom3D(s.receptacles), [s.receptacles.join('|')])
  const ROOM = layout.room
  const cmd: ParsedCmd | null = useMemo(
    () => (s.command ? parseCommand(s.command) : null), [s.command])

  const world = useMemo(() => {
    const m = new Map<string, { pos: [number, number]; rot: number }>()
    layout.items.forEach((it) => m.set(it.id, { pos: [it.x, it.z], rot: it.rot }))
    return m
  }, [layout])

  const activeId = cmd?.target
  const spot = activeId ? world.get(activeId) : undefined
  // stand just in front of the piece, on the room-centre side
  const stand: [number, number] = spot
    ? [spot.pos[0] * 0.86, spot.pos[1] * 0.86] : [0, 1.5]

  const action: Act = !cmd ? 'idle'
    : cmd.verb === 'open' || cmd.verb === 'close' ? 'open'
    : cmd.verb === 'take' ? 'take'
    : cmd.verb === 'put' ? 'put'
    : ['cool', 'heat', 'clean', 'use'].includes(cmd.verb) ? 'fx'
    : ['look', 'examine'].includes(cmd.verb) ? 'look' : 'idle'

  const [burst, setBurst] = useState<{ k: number; color: string } | null>(null)
  useEffect(() => {
    const c = cmd ? FX_COLOR[cmd.verb] : undefined
    if (!c) return
    setBurst({ k: s.step, color: c })
    const id = setTimeout(() => setBurst(null), 1200)
    return () => clearTimeout(id)
  }, [s.step, s.command])

  return (
    <div className="relative w-full h-full rounded-core overflow-hidden">
      <Canvas shadows="soft" dpr={[1, 2]} camera={{ fov: 46, position: [0, 11, 17] }}
              gl={{ antialias: true }}>
        <color attach="background" args={['#b9d6ef']} />
        <fog attach="fog" args={['#c6dcf0', 30, 58]} />

        <hemisphereLight args={['#ffffff', '#8d9aa8', 0.75]} />
        <directionalLight
          position={[-9, 15, -6]} intensity={1.35} castShadow
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0008}
          shadow-camera-left={-16} shadow-camera-right={16}
          shadow-camera-top={16} shadow-camera-bottom={-16} />
        <directionalLight position={[8, 9, 10]} intensity={0.35} color="#dce9ff" />

        <Shell ROOM={ROOM} />

        {layout.items.map((it) => (
          <Furniture key={it.id} id={it.id} kind={it.kind} pos={[it.x, it.z]}
            rot={it.rot} opened={s.opened.includes(it.id)}
            active={it.id === activeId} visited={s.visited.includes(it.id)}
            near={Math.hypot(it.x - stand[0], it.z - stand[1]) < 7} />
        ))}

        <Player target={stand} action={action} carrying={s.carrying} posRef={bodyRef}
                onArrive={onArrive} speed={speed} />
        {burst && <Burst at={stand} color={burst.color} seed={burst.k} />}
        <ContactShadows position={[0, 0.03, 0]} scale={ROOM} blur={2.4}
                        opacity={0.36} far={5} resolution={512} />

        <Chase bodyRef={bodyRef} room={ROOM} />

        <EffectComposer enableNormalPass multisampling={0}>
          <N8AO aoRadius={1.1} intensity={2.2} distanceFalloff={0.8} quality="performance" />
          <SMAA />
          <Vignette eskil={false} offset={0.22} darkness={0.55} />
        </EffectComposer>
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute left-2.5 bottom-2.5 right-2.5 flex items-center gap-2">
        <span className={[
          'chip shrink-0 shadow-sm',
          s.confirm ? 'bg-l2-500 text-white' : 'bg-white/92 text-slate-700',
        ].join(' ')}>
          {s.confirm ? t('tallyReadOnly') : t('step', { n: s.step })}
        </span>
        <div className="flex-1 truncate rounded-lg bg-slate-900/55 backdrop-blur px-2.5 py-1
                        text-xs text-white shadow-sm">
          {cmd ? describe(cmd, t) : t('standby')}
          <span className="ml-2 font-mono text-[10px] text-white/55">{cmd?.raw}</span>
        </div>
      </div>

      {onToggleExpand && (
        <button onClick={onToggleExpand} title={expanded ? 'restore' : 'expand'}
          className="absolute left-2.5 top-2.5 rounded-lg bg-slate-900/50 backdrop-blur
                     px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-900/70">
          {expanded ? '⤡' : '⤢'}
        </button>
      )}

      {s.carrying && (
        <div className="pointer-events-none absolute right-2.5 top-2.5 flex items-center gap-1.5
                        rounded-lg bg-slate-900/55 backdrop-blur px-2 py-1 text-[11px] text-white">
          <span className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: itemColor(s.carrying) }} />
          {t('holding')} {s.carrying}
        </div>
      )}

      {s.done && (
        <div className={[
          'pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 px-3 py-1',
          'rounded-full text-xs font-semibold backdrop-blur shadow',
          s.success ? 'bg-emerald-500/92 text-white' : 'bg-rose-500/92 text-white',
        ].join(' ')}>
          {s.success ? `✓ ${t('taskDone')}` : `✗ ${t('taskFailed')}`}
        </div>
      )}
    </div>
  )
}
