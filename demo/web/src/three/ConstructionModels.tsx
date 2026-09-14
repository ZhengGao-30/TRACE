import { useEffect, useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'framer-motion'
import { Euler, Group, MathUtils, MeshStandardMaterial, Quaternion, Vector3 } from 'three'

export type ConstructionVariant = 'scaffold' | 'timber-yard'
type Phase = 'entry' | 'work' | 'incident' | 'aftermath'
type Point = [number, number, number]
type Paints = ReturnType<typeof usePaints>


function usePaints() {
  const paints = useMemo(() => {
    const paint = (color: string, roughness = .75, metalness = 0) =>
      new MeshStandardMaterial({ color, roughness, metalness })
    return {
      sand: paint('#d8c9b2'), edge: paint('#ad9a81'), gravel: paint('#bbad98'),
      concrete: paint('#c4c7c3'), steel: paint('#b9c3ca', .35, .65),
      darkSteel: paint('#536371', .48, .45), charcoal: paint('#28323e', .65),
      wood: paint('#b88953'), woodLight: paint('#d1ab75'), woodDark: paint('#8b623d'),
      white: paint('#f3f2ee', .4), indigo: paint('#6263cd', .38, .1),
      indigoDark: paint('#444aa0', .48), yellow: paint('#edbf48', .45),
      orange: paint('#df8853'), navy: paint('#33465c'), olive: paint('#71806a'),
      trousers: paint('#6d7379'), darkTrousers: paint('#4b545b'),
      skin: paint('#cf9c7c', .86), hair: paint('#514037'), sole: paint('#e1dfd7'),
      glass: paint('#132438', .18, .5), paper: paint('#fbfaf2'),
      eye: new MeshStandardMaterial({ color: '#b9f4ff', emissive: '#76d7ff', emissiveIntensity: 1.5, roughness: .2 }),
      status: new MeshStandardMaterial({ color: '#b7c0ff', emissive: '#7278ef', emissiveIntensity: .7 }),
    }
  }, [])
  useEffect(() => () => Object.values(paints).forEach(material => material.dispose()), [paints])
  return paints
}

function Box({ at = [0, 0, 0], size, material, radius = .025, rotation, shadow = true }:
  { at?: Point; size: Point; material: MeshStandardMaterial; radius?: number; rotation?: Point; shadow?: boolean }) {
  const bevel = Math.min(radius, Math.min(...size) * .48)
  return <RoundedBox position={at} args={size} radius={bevel} smoothness={2} bevelSegments={2}
    rotation={rotation} castShadow={shadow} receiveShadow material={material} />
}

function Ball({ at, radius, material, scale }:
  { at: Point; radius: number; material: MeshStandardMaterial; scale?: Point }) {
  return <mesh position={at} material={material} scale={scale} castShadow>
    <sphereGeometry args={[radius, 14, 10]} />
  </mesh>
}

function Rod({ from, to, radius = .028, material, shadow = true }:
  { from: Point; to: Point; radius?: number; material: MeshStandardMaterial; shadow?: boolean }) {
  const transform = useMemo(() => {
    const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a)
    return { center: a.add(b).multiplyScalar(.5), length: direction.length(),
      rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()) }
  }, [from[0], from[1], from[2], to[0], to[1], to[2]])
  return <mesh position={transform.center} quaternion={transform.rotation} material={material} castShadow={shadow}>
    <cylinderGeometry args={[radius, radius, transform.length, 8]} />
  </mesh>
}

function Capsule({ at, radius, length, material, rotation }:
  { at: Point; radius: number; length: number; material: MeshStandardMaterial; rotation?: Point }) {
  return <mesh position={at} material={material} rotation={rotation} castShadow>
    <capsuleGeometry args={[radius, length, 4, 10]} />
  </mesh>
}

function Timber({ at, length = 2.8, width = .2, height = .13, paints, rotation, grain = true }:
  { at: Point; length?: number; width?: number; height?: number; paints: Paints; rotation?: Point; grain?: boolean }) {
  return <group position={at} rotation={rotation}>
    <Box size={[length, height, width]} material={paints.woodLight} radius={.012} />
    {grain && <>
      <Box at={[-length * .04, height / 2 + .001, -width * .18]}
        size={[length * .87, .004, .008]} radius={.001} material={paints.wood} shadow={false} />
      <Box at={[length * .1, height / 2 + .001, width * .2]}
        size={[length * .66, .004, .005]} radius={.001} material={paints.woodDark} shadow={false} />
    </>}
  </group>
}

function Pallet({ at, paints, loaded = false }: { at: Point; paints: Paints; loaded?: boolean }) {
  return <group position={at}>
    {[-.44, .44].map(x => <Box key={x} at={[x, .06, 0]} size={[.14, .12, .86]} material={paints.woodDark} radius={.01} />)}
    {[-.34, -.11, .12, .35].map(z => <Timber key={z} at={[0, .145, z]} length={1.12} width={.18}
      height={.07} paints={paints} grain={false} />)}
    {loaded && [-.26, 0, .26].map(z => <Timber key={z} at={[.02, .25, z]} length={1.3} width={.22}
      height={.14} paints={paints} />)}
  </group>
}

function Cone({ at, paints }: { at: Point; paints: Paints }) {
  return <group position={at}>
    <Box at={[0, .025, 0]} size={[.3, .05, .3]} radius={.035} material={paints.charcoal} />
    <mesh position={[0, .19, 0]} material={paints.orange} castShadow><coneGeometry args={[.115, .34, 12]} /></mesh>
    <mesh position={[0, .225, 0]} material={paints.white}><cylinderGeometry args={[.053, .079, .075, 12]} /></mesh>
  </group>
}

function Scaffold({ paints }: { paints: Paints }) {
  const xs = [-.15, 3.0], zs = [-2.7, -.85]
  return <group>
    <Box at={[1.43, .63, -3.42]} size={[4, 1.26, .25]} radius={.035} material={paints.concrete} />
    {[.2, 2.62].map(x => <Box key={x} at={[x, 1.65, -3.45]} size={[.3, 3.3, .34]} material={paints.concrete} />)}
    {xs.flatMap(x => zs.map(z => <group key={`${x}:${z}`}>
      <Box at={[x, .035, z]} size={[.25, .07, .25]} material={paints.darkSteel} radius={.012} />
      <Rod from={[x, .07, z]} to={[x, 3.05, z]} material={paints.steel} radius={.045} />
      {[.38, 1.91, 2.82].map(y => <mesh key={y} position={[x, y, z]} material={paints.darkSteel}>
        <cylinderGeometry args={[.061, .061, .055, 10]} />
      </mesh>)}
    </group>))}
    {[.32, 1.9, 2.43, 2.91].map(y => <group key={y}>
      <Rod from={[xs[0], y, zs[0]]} to={[xs[1], y, zs[0]]} material={paints.steel} />
      <Rod from={[xs[0], y, zs[1]]} to={[xs[1], y, zs[1]]} material={paints.steel} />
    </group>)}
    {[1.9, 2.43, 2.91].map(y => <group key={y}>
      {xs.map(x => <Rod key={x} from={[x, y, zs[0]]} to={[x, y, zs[1]]} material={paints.steel} />)}
    </group>)}
    <Rod from={[-.15, .34, -2.73]} to={[3, 1.92, -2.73]} material={paints.darkSteel} radius={.022} />
    <Rod from={[3, .34, -2.73]} to={[-.15, 1.92, -2.73]} material={paints.darkSteel} radius={.022} />
    <Rod from={[3.025, .34, -.85]} to={[3.025, 1.92, -2.7]} material={paints.darkSteel} radius={.022} />
    <Rod from={[3.025, .34, -2.7]} to={[3.025, 1.92, -.85]} material={paints.darkSteel} radius={.022} />
    {[-2.52, -2.19, -1.86, -1.53, -1.2].map(z =>
      <Timber key={z} at={[1.42, 1.98, z]} length={3.48} width={.3} height={.12} paints={paints} />)}
    {                                                                 }
    {[-.78, -.36].map(x => <Rod key={x} from={[x, .07, -.04]} to={[x, 2.33, -1.18]}
      radius={.032} material={paints.steel} />)}
    {Array.from({ length: 8 }, (_, index) => {
      const t = (index + .6) / 8
      return <Rod key={index} from={[-.78, .07 + t * 2.26, -.04 - t * 1.14]}
        to={[-.36, .07 + t * 2.26, -.04 - t * 1.14]} radius={.023} material={paints.darkSteel} />
    })}
    <Pallet at={[-2.18, 0, -2.82]} paints={paints} />
  </group>
}

function TimberRack({ paints }: { paints: Paints }) {
  return <group>
    {[-.12, 2.98].flatMap(x => [-2.65, -1.03].map(z => <group key={`${x}:${z}`}>
      <Box at={[x, .035, z]} size={[.27, .07, .27]} material={paints.darkSteel} radius={.012} />
      <Box at={[x, 1.23, z]} size={[.1, 2.4, .1]} material={paints.darkSteel} radius={.015} />
    </group>))}
    {[.3, 1.18, 2.02].map((y, tier) => <group key={y}>
      <Box at={[1.43, y, -1.02]} size={[3.2, .12, .12]} material={paints.yellow} radius={.015} />
      <Box at={[1.43, y, -2.65]} size={[3.2, .12, .12]} material={paints.darkSteel} radius={.015} />
      {[-2.38, -1.97, -1.56, -1.18].map((z, index) => <Timber key={z}
        at={[1.39 + (index % 2) * .06, y + .14, z]} length={tier === 2 ? 3.13 : 2.92}
        width={.33} height={.16} paints={paints} grain={tier === 2} />)}
    </group>)}
    <Rod from={[-.12, .3, -2.72]} to={[2.98, 2.02, -2.72]} radius={.023} material={paints.steel} />
    <Rod from={[2.98, .3, -2.72]} to={[-.12, 2.02, -2.72]} radius={.023} material={paints.steel} />
    {                                                                           }
    <Pallet at={[1.08, 0, 1.31]} paints={paints} loaded />
    <Pallet at={[-2.08, 0, -2.85]} paints={paints} />
  </group>
}


export function ConstructionSite({ variant }: { variant: ConstructionVariant }) {
  const paints = usePaints()
  return <group>
    <Box at={[0, -.2, 0]} size={[12, .32, 9]} radius={.17} material={paints.edge} />
    <Box at={[0, -.035, 0]} size={[11.86, .07, 8.86]} radius={.08} material={paints.sand} />
    <Box at={[0, 0, 3.45]} size={[9.6, .012, 1]} radius={.025} material={paints.concrete} shadow={false} />
    {[-4, -2.9, -1.8, -.7, .4, 1.5, 2.6, 3.7].map(x => <Box key={x}
      at={[x, .005, 3.94]} size={[.6, .006, .026]} radius={.002} material={paints.white} shadow={false} />)}
    {                                                                       }
    {Array.from({ length: 14 }, (_, i) => <mesh key={i}
      position={[-5.42 + (i % 7) * 1.58, .024, i < 7 ? -4.02 : 4.22]}
      rotation={[.3 * i, i, .25]} scale={[.055 + (i % 3) * .02, .025, .045]}
      material={paints.gravel}><icosahedronGeometry args={[1, 0]} /></mesh>)}
    {variant === 'scaffold' ? <Scaffold paints={paints} /> : <TimberRack paints={paints} />}

    {                                                                        }
    {[-5.65, 5.65].map(x => <group key={x}>
      {[-3.68, -1.94, -.2].map(z => <Box key={z} at={[x, .44, z]}
        size={[.095, .88, .095]} radius={.015} material={paints.darkSteel} />)}
      {[.34, .74].map(y => <Rod key={y} from={[x, y, -3.68]} to={[x, y, -.2]}
        material={paints.steel} radius={.026} />)}
    </group>)}
    <Cone at={[-5.34, 0, 3.51]} paints={paints} />
    <Cone at={[5.32, 0, -3.47]} paints={paints} />

    {                                                               }
    <Rod from={[-5.25, 0, 1.85]} to={[-5.25, 1.47, 1.85]} radius={.035} material={paints.steel} />
    <Box at={[-5.25, 1.21, 1.86]} size={[.61, .47, .07]} radius={.05} material={paints.yellow} />
    <Box at={[-5.25, 1.23, 1.906]} size={[.29, .12, .016]} radius={.03} material={paints.charcoal} shadow={false} />
    <Box at={[-5.25, 1.11, 1.907]} size={[.19, .026, .015]} radius={.006} material={paints.charcoal} shadow={false} />

    {                                                       }
    <group position={[-4.33, 0, -2.48]}>
      <Box at={[0, .04, 0]} size={[.38, .08, .38]} material={paints.concrete} />
      <Rod from={[0, .06, 0]} to={[0, 2.22, 0]} radius={.043} material={paints.steel} />
      <Rod from={[0, 2.13, 0]} to={[.28, 2.13, .1]} radius={.037} material={paints.darkSteel} />
      <group position={[.3, 2.1, .13]} rotation={[-.13, .95, 0]}>
        <Box size={[.2, .17, .33]} radius={.035} material={paints.white} />
        <Box at={[0, 0, .17]} size={[.16, .13, .025]} radius={.025} material={paints.charcoal} />
        <mesh position={[0, 0, .191]} rotation={[Math.PI / 2, 0, 0]} material={paints.glass}>
          <cylinderGeometry args={[.044, .044, .028, 14]} />
        </mesh>
      </group>
      <Box at={[.03, .89, .08]} size={[.64, .42, .055]} radius={.03} material={paints.white} />
      {[-.08, .02, .12].map(y => <Box key={y} at={[.03, .89 + y, .117]}
        size={[.43, .024, .006]} radius={.003} material={paints.indigo} shadow={false} />)}
    </group>

    <group position={[-2.46, 0, -.91]}>
      <Box at={[0, .21, 0]} size={[.65, .38, .38]} radius={.055} material={paints.indigoDark} />
      <Box at={[0, .41, 0]} size={[.68, .08, .41]} radius={.025} material={paints.indigo} />
      <Box at={[0, .493, 0]} size={[.23, .035, .065]} radius={.012} material={paints.charcoal} />
      {[-.17, .17].map(x => <Box key={x} at={[x, .33, .2]} size={[.045, .09, .017]}
        radius={.008} material={paints.steel} />)}
    </group>

    {                                                                           }
    <group position={[3.8, 0, 4.08]}>
      {[-.54, .54].flatMap(x => [-.14, .14].map(z => <Rod key={`${x}:${z}`}
        from={[x, .02, z]} to={[x, .78, z]} radius={.025} material={paints.darkSteel} />))}
      <Box at={[0, .79, 0]} size={[1.35, .09, .42]} radius={.035} material={paints.woodLight} />
      <group position={[-.24, .86, 0]} rotation={[-.16, 0, 0]}>
        <Box size={[.37, .035, .28]} radius={.025} material={paints.charcoal} />
        <Box at={[0, .021, -.005]} size={[.31, .008, .21]} radius={.012} material={paints.indigo} shadow={false} />
        <Box at={[0, .028, -.018]} size={[.2, .004, .018]} radius={.004} material={paints.white} shadow={false} />
      </group>
      <Box at={[.28, .85, 0]} size={[.29, .025, .31]} radius={.008} material={paints.paper} />
      {[-.065, 0, .065].map(z => <Box key={z} at={[.28, .865, z]} size={[.19, .003, .014]}
        radius={.002} material={paints.darkSteel} shadow={false} />)}
    </group>
  </group>
}

function WorkerLeg({ paints, dark, side, legRef, kneeRef, safetyBoots = false }:
  { paints: Paints; dark: boolean; side: number; safetyBoots?: boolean; legRef: React.RefObject<Group | null>; kneeRef: React.RefObject<Group | null> }) {
  const cloth = dark ? paints.darkTrousers : paints.trousers
  return <group ref={legRef} position={[side * .115, 0, 0]}>
    <Capsule at={[0, -.17, 0]} radius={.085} length={.2} material={cloth} />
    <Ball at={[0, -.345, 0]} radius={.079} material={cloth} />
    <group ref={kneeRef} position={[0, -.35, 0]}>
      <Capsule at={[0, -.195, 0]} radius={.069} length={.28} material={cloth} />
      <group position={[0, -.405, .04]}>
        {safetyBoots && <Box at={[0, .095, -.01]} size={[.16, .23, .16]} radius={.035} material={paints.charcoal} />}
        <Box at={[0, -.019, .045]} size={[.165, .058, .31]} radius={.025} material={paints.sole} />
        <Box at={[0, .033, .023]} size={[.15, .09, .265]} radius={.043}
          material={safetyBoots || dark ? paints.charcoal : paints.trousers} />
        <Box at={[0, .026, .139]} size={[.133, .05, .059]} radius={.024} material={paints.sole} />
        {[-.012, .035, .079].map(z => <Box key={z} at={[0, .082, z]} size={[.082, .009, .014]}
          radius={.004} material={paints.white} shadow={false} />)}
      </group>
    </group>
  </group>
}

function WorkerArm({ paints, shirt, side, armRef, longSleeves = false }:
  { paints: Paints; shirt: MeshStandardMaterial; side: number; longSleeves?: boolean; armRef: React.RefObject<Group | null> }) {
  return <group ref={armRef} position={[side * .24, .4, 0]}>
    <Capsule at={[0, -.07, 0]} radius={.086} length={.085} material={shirt} />
    <Capsule at={[0, -.205, 0]} radius={.056} length={.14} material={longSleeves ? shirt : paints.skin} />
    <Ball at={[0, -.307, 0]} radius={.056} material={longSleeves ? shirt : paints.skin} />
    <Capsule at={[0, -.422, .018]} radius={.049} length={.15} material={longSleeves ? shirt : paints.skin} />
    <Ball at={[0, -.55, .03]} radius={.06} scale={[.78, 1.14, .72]} material={paints.skin} />
  </group>
}


export function ConstructionWorker({ variant, phase = 'work', progress = 1, syncPosition = false, inspection = false, ppe, adjusting = false }:
  { variant: ConstructionVariant; phase?: Phase; progress?: number; syncPosition?: boolean; inspection?: boolean; adjusting?: boolean;
    ppe?: { workwear: 'casual' | 'approved_workwear'; footwear: 'trainers' | 'safety_boots' } }) {
  const paints = usePaints(), reduced = useReducedMotion()
  const root = useRef<Group>(null), hips = useRef<Group>(null), torso = useRef<Group>(null)
  const leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null)
  const leftKnee = useRef<Group>(null), rightKnee = useRef<Group>(null)
  const leftArm = useRef<Group>(null), rightArm = useRef<Group>(null), head = useRef<Group>(null)
  const dark = variant === 'timber-yard', shirt = dark ? paints.olive : paints.navy
  const destination = useMemo(() => new Vector3(), [])

  useFrame((state, delta) => {
    if (!root.current || !hips.current || !torso.current || !head.current) return
    const t = MathUtils.clamp(progress, 0, 1), time = reduced ? 0 : state.clock.elapsedTime
    const blend = reduced ? 1 : 1 - Math.exp(-delta * 15)
    const walking = !inspection && phase === 'entry' && t < .99 && !reduced
    const seated = phase === 'aftermath'
    const startled = phase === 'incident'
    const stride = walking ? Math.sin(time * 8) * .38 : 0
    destination.set(phase === 'entry' ? MathUtils.lerp(-2.9, 1.2, t) : 1.2,
      0, phase === 'entry' ? MathUtils.lerp(2.45, .4, t) : .4)


    if (syncPosition) root.current.position.copy(destination)
    else root.current.position.lerp(destination, blend)
    const yaw = phase === 'entry' ? 2.035 : seated ? -.06 : phase === 'work' ? Math.PI : .18
    root.current.rotation.y = MathUtils.damp(root.current.rotation.y, yaw, reduced ? 1000 : 12, delta)
    hips.current.position.y = MathUtils.lerp(hips.current.position.y, seated ? .51 : startled ? .84 + Math.sin(t * Math.PI) * .08 : .81 + (walking ? Math.abs(Math.sin(time * 8)) * .025 : 0), blend)
    torso.current.rotation.x = MathUtils.lerp(torso.current.rotation.x, adjusting ? .13 : seated ? .46 : startled ? -.18 : -.035, blend)
    torso.current.rotation.z = MathUtils.lerp(torso.current.rotation.z, startled ? -.11 : 0, blend)
    head.current.rotation.x = MathUtils.lerp(head.current.rotation.x, adjusting ? .3 : seated ? .38 : phase === 'work' ? -.2 : 0, blend)
    if (leftLeg.current && rightLeg.current && leftKnee.current && rightKnee.current) {
      leftLeg.current.rotation.x = MathUtils.lerp(leftLeg.current.rotation.x, seated ? -1.24 : stride, blend)
      rightLeg.current.rotation.x = MathUtils.lerp(rightLeg.current.rotation.x, seated ? -1.10 : startled ? -.5 * Math.sin(t * Math.PI) : -stride, blend)
      leftKnee.current.rotation.x = MathUtils.lerp(leftKnee.current.rotation.x, seated ? .73 : walking ? Math.max(0, -stride) : 0, blend)
      rightKnee.current.rotation.x = MathUtils.lerp(rightKnee.current.rotation.x, seated ? .48 : walking ? Math.max(0, stride) : startled ? .45 : 0, blend)
    }
    if (leftArm.current && rightArm.current) {
      const reach = adjusting ? -.85 + Math.sin(time * 3) * .12 : seated ? -1.14 : phase === 'work' ? -2.1 : startled ? -1.15 : -stride * .65
      leftArm.current.rotation.x = MathUtils.lerp(leftArm.current.rotation.x, reach, blend)
      rightArm.current.rotation.x = MathUtils.lerp(rightArm.current.rotation.x, adjusting ? -.9 - Math.sin(time * 3) * .12 : seated ? -1.24 : phase === 'work' ? -1.91 : startled ? -.9 : stride * .65, blend)
      leftArm.current.rotation.z = MathUtils.lerp(leftArm.current.rotation.z, seated ? -.2 : startled ? -.38 : -.08, blend)
      rightArm.current.rotation.z = MathUtils.lerp(rightArm.current.rotation.z, seated ? .19 : startled ? .34 : .08, blend)
    }
  })

  const placementProgress = MathUtils.clamp(progress, 0, 1)
  const placement: Point = syncPosition && phase === 'entry'
    ? [MathUtils.lerp(-2.9, 1.2, placementProgress), 0, MathUtils.lerp(2.45, .4, placementProgress)]
    : [1.2, 0, .4]
  return <group ref={root} position={placement} scale={.98}>
    <group ref={hips} position={[0, .81, 0]}>
      <Box size={[.32, .18, .235]} radius={.065} material={dark ? paints.darkTrousers : paints.trousers} />
      <WorkerLeg paints={paints} dark={dark} side={-1} legRef={leftLeg} kneeRef={leftKnee} safetyBoots={ppe?.footwear === 'safety_boots'} />
      <WorkerLeg paints={paints} dark={dark} side={1} legRef={rightLeg} kneeRef={rightKnee} safetyBoots={ppe?.footwear === 'safety_boots'} />
      <group ref={torso}>
        <Box at={[0, .225, 0]} size={[.41, .45, .26]} radius={.105} material={shirt} />
        <Capsule at={[0, .49, 0]} radius={.058} length={.065} material={paints.skin} />
        {ppe?.workwear === 'approved_workwear' && <Box at={[0, .225, .135]} size={[.015, .32, .012]} radius={.004} material={paints.darkSteel} />}
        <WorkerArm paints={paints} shirt={shirt} side={-1} armRef={leftArm} longSleeves={ppe?.workwear === 'approved_workwear'} />
        <WorkerArm paints={paints} shirt={shirt} side={1} armRef={rightArm} longSleeves={ppe?.workwear === 'approved_workwear'} />
        <group ref={head} position={[0, .61, 0]}>
          <Ball at={[0, 0, 0]} radius={.151} scale={[.9, 1.11, .94]} material={paints.skin} />
          {[-1, 1].map(side => <Ball key={side} at={[side * .134, -.002, 0]} radius={.035}
            scale={[.6, 1, .72]} material={paints.skin} />)}
          <Ball at={[0, -.015, .144]} radius={.029} scale={[.75, .9, .85]} material={paints.skin} />
          {[-.049, .049].map(x => <Ball key={x} at={[x, .035, .136]} radius={.0105} material={paints.hair} />)}
          <Box at={[0, -.065, .127]} size={[.05, .008, .009]} radius={.003} material={paints.hair} shadow={false} />
          <mesh position={[0, .09, -.012]} material={dark ? paints.white : paints.yellow} castShadow>
            <sphereGeometry args={[.177, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, .093, .006]} scale={[1, 1, 1.1]} material={dark ? paints.white : paints.yellow} castShadow>
            <cylinderGeometry args={[.202, .206, .027, 18]} />
          </mesh>
          <Box at={[0, .231, -.012]} size={[.029, .05, .219]} radius={.014} material={dark ? paints.sole : paints.woodLight} />
        </group>
      </group>
    </group>
  </group>
}

function RobotLimb({ side, leg = false, paints, limbRef, forearmRef, children }:
  { side: number; leg?: boolean; paints: Paints; limbRef: React.RefObject<Group | null>;
    forearmRef?: React.RefObject<Group | null>; children?: React.ReactNode }) {
  return <group ref={limbRef} position={leg ? [side * .125, .335, 0] : [side * .277, .6, 0]}>
    <Ball at={[0, 0, 0]} radius={leg ? .065 : .072} material={paints.indigoDark} />
    <Capsule at={[0, leg ? -.082 : -.088, 0]} radius={leg ? .065 : .055}
      length={leg ? .095 : .115} material={paints.white} />
    <Ball at={[0, leg ? -.17 : -.18, 0]} radius={.048} material={paints.darkSteel} />
    {leg ? <Box at={[0, -.274, .041]} size={[.176, .098, .255]} radius={.04} material={paints.indigo} />
      : <group ref={forearmRef} position={[0, -.18, 0]}>
        {                                                                        }
        <Capsule at={[0, -.061, .01]} radius={.049} length={.071} material={paints.white} />
        <group name={side < 0 ? 'robot-left-hand' : 'robot-right-hand'} position={[0, -.135, .027]}>
          <Ball at={[0, 0, 0]} radius={.057} scale={[.88, 1.03, .84]} material={paints.indigo} />
          {children}
        </group>
      </group>}
  </group>
}

const TABLET_LEFT_ARM: Point = [-.88, 0, .30]
const TABLET_RIGHT_ARM: Point = [-.72, 0, -.52]
const TABLET_LEFT_ELBOW = -.75
const TABLET_RIGHT_ELBOW = -1.02


function HandheldTablet({ paints }: { paints: Paints }) {
  return <group name="robot-handheld-tablet">
    <Box size={[.36, .245, .036]} radius={.027} material={paints.charcoal} />
    <Box at={[0, 0, -.018]} size={[.342, .227, .012]} radius={.024} material={paints.indigo} />
    <Box at={[0, -.002, -.026]} size={[.306, .19, .007]} radius={.013} material={paints.indigoDark} shadow={false} />
    {
                                                                  }
    <Box at={[-.012, .066, -.031]} size={[.244, .014, .004]} radius={.003} material={paints.paper} shadow={false} />
    {[-.072, .065].map(x => <group key={x}>
      <Box at={[x, -.019, -.031]} size={[.113, .09, .004]} radius={.008} material={paints.paper} shadow={false} />
      <Box at={[x - .028, .005, -.034]} size={[.035, .012, .003]} radius={.002} material={paints.indigo} shadow={false} />
      <Box at={[x, -.017, -.034]} size={[.081, .007, .003]} radius={.002} material={paints.darkSteel} shadow={false} />
      <Box at={[x - .014, -.034, -.034]} size={[.053, .007, .003]} radius={.002} material={paints.darkSteel} shadow={false} />
    </group>)}
    <Ball at={[0, .109, -.027]} radius={.005} material={paints.glass} />
    <Box at={[0, 0, .02]} size={[.09, .015, .006]} radius={.005} material={paints.indigo} shadow={false} />
  </group>
}


export function ConstructionRobot({ walking = false, inspecting = false, active = true, usingTablet = false, inspectionPitch = .15 }:
  { walking?: boolean; inspecting?: boolean; active?: boolean; usingTablet?: boolean; inspectionPitch?: number }) {
  const paints = usePaints(), reduced = useReducedMotion()
  const chassis = useRef<Group>(null), head = useRef<Group>(null)
  const leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null)
  const leftArm = useRef<Group>(null), rightArm = useRef<Group>(null)
  const leftForearm = useRef<Group>(null), rightForearm = useRef<Group>(null)
  const tabletInUse = usingTablet && active && !walking
  const tabletGrip = useMemo(() => {



    const handRotation = (arm: Point, elbow: number) => new Quaternion()
      .setFromEuler(new Euler(...arm)).multiply(new Quaternion().setFromEuler(new Euler(elbow, 0, 0)))
    const leftInverse = handRotation(TABLET_LEFT_ARM, TABLET_LEFT_ELBOW).invert()
    const rightInverse = handRotation(TABLET_RIGHT_ARM, TABLET_RIGHT_ELBOW).invert()
    return {
      position: new Vector3(.17, .025, .025).applyQuaternion(leftInverse),
      rotation: leftInverse.clone().multiply(new Quaternion().setFromEuler(new Euler(.75, 0, 0))),
      fingerBase: new Vector3(-.029, .02, .013).applyQuaternion(rightInverse).toArray() as Point,
      fingerTip: new Vector3(-.054, .044, .027).applyQuaternion(rightInverse).toArray() as Point,
    }
  }, [])
  useFrame((state, delta) => {
    const time = reduced ? 0 : state.clock.elapsedTime
    const stride = walking && !reduced ? Math.sin(time * 9) * .4 : 0
    const blend = reduced ? 1 : 1 - Math.exp(-delta * 13)
    const tap = tabletInUse && !reduced ? (1 - Math.cos(time * 2.3)) * .014 : 0
    const scroll = tabletInUse && !reduced ? Math.sin(time * .9) * .025 : 0
    if (chassis.current) chassis.current.position.y = reduced || !active ? 0 : walking ? Math.abs(Math.sin(time * 9)) * .022 : Math.sin(time * 2.1) * .007
    if (leftLeg.current) leftLeg.current.rotation.x = MathUtils.lerp(leftLeg.current.rotation.x, stride, blend)
    if (rightLeg.current) rightLeg.current.rotation.x = MathUtils.lerp(rightLeg.current.rotation.x, -stride, blend)
    if (leftArm.current) {
      leftArm.current.rotation.x = MathUtils.lerp(leftArm.current.rotation.x, tabletInUse ? TABLET_LEFT_ARM[0] : -stride * .7, blend)
      leftArm.current.rotation.z = MathUtils.lerp(leftArm.current.rotation.z, tabletInUse ? TABLET_LEFT_ARM[2] : 0, blend)
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = MathUtils.lerp(rightArm.current.rotation.x, tabletInUse ? TABLET_RIGHT_ARM[0] : inspecting ? -1.12 : stride * .7, blend)
      rightArm.current.rotation.z = MathUtils.lerp(rightArm.current.rotation.z, tabletInUse ? TABLET_RIGHT_ARM[2] : 0, blend)
    }
    if (leftForearm.current) leftForearm.current.rotation.x = MathUtils.lerp(leftForearm.current.rotation.x, tabletInUse ? TABLET_LEFT_ELBOW : 0, blend)
    if (rightForearm.current) {
      rightForearm.current.rotation.x = MathUtils.lerp(rightForearm.current.rotation.x, tabletInUse ? TABLET_RIGHT_ELBOW + tap : 0, blend)
      rightForearm.current.rotation.y = MathUtils.lerp(rightForearm.current.rotation.y, tabletInUse ? scroll : 0, blend)
    }
    if (head.current) head.current.rotation.x = MathUtils.lerp(head.current.rotation.x, tabletInUse ? .42 : inspecting ? inspectionPitch : 0, blend)
    paints.eye.emissiveIntensity = active ? 1.25 + (reduced ? 0 : Math.sin(time * 2.1) * .15) : .25
  })
  return <group ref={chassis}>
    <RobotLimb side={-1} leg paints={paints} limbRef={leftLeg} />
    <RobotLimb side={1} leg paints={paints} limbRef={rightLeg} />
    <Box at={[0, .467, 0]} size={[.415, .33, .302]} radius={.105} material={paints.white} />
    <Box at={[0, .361, 0]} size={[.35, .085, .26]} radius={.035} material={paints.indigoDark} />
    <Box at={[0, .492, .155]} size={[.185, .13, .019]} radius={.035} material={paints.indigo} />
    <Box at={[0, .493, .17]} size={[.094, .019, .011]} radius={.006} material={paints.status} shadow={false} />
    <Rod from={[0, .62, 0]} to={[0, .7, 0]} radius={.07} material={paints.darkSteel} />
    <RobotLimb side={-1} paints={paints} limbRef={leftArm} forearmRef={leftForearm}>
      <group visible={tabletInUse} position={tabletGrip.position} quaternion={tabletGrip.rotation}>
        <HandheldTablet paints={paints} />
      </group>
    </RobotLimb>
    <RobotLimb side={1} paints={paints} limbRef={rightArm} forearmRef={rightForearm}>
      <group name="robot-tablet-touch" visible={tabletInUse}>
        <Rod from={tabletGrip.fingerBase} to={tabletGrip.fingerTip} radius={.012} material={paints.indigo} />
        <Ball at={tabletGrip.fingerTip} radius={.014} material={paints.indigo} />
      </group>
    </RobotLimb>
    <group ref={head} position={[0, .825, 0]}>
      <Box size={[.582, .361, .391]} radius={.125} material={paints.white} />
      <Box at={[0, -.005, .195]} size={[.466, .229, .055]} radius={.072} material={paints.glass} />
      {[-.095, .095].map(x => <Capsule key={x} at={[x, .008, .229]} radius={.024}
        length={.032} material={paints.eye} />)}
      <Box at={[0, -.057, .23]} size={[.066, .012, .006]} radius={.005} material={paints.status} shadow={false} />
      {[-1, 1].map(side => <group key={side} position={[side * .297, 0, -.005]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={paints.indigo} castShadow><cylinderGeometry args={[.077, .077, .055, 16]} /></mesh>
        <mesh position={[0, side * .031, 0]} material={paints.status}><cylinderGeometry args={[.037, .037, .013, 14]} /></mesh>
      </group>)}
      <Rod from={[.16, .146, -.025]} to={[.2, .258, -.025]} radius={.016} material={paints.indigoDark} />
      <Ball at={[.2, .274, -.025]} radius={.036} material={paints.status} />
      <Box at={[0, .172, -.048]} size={[.183, .019, .18]} radius={.009} material={paints.indigo} />
    </group>
  </group>
}
