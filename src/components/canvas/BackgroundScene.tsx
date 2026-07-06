import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Curve,
  DataTexture,
  Float32BufferAttribute,
  IcosahedronGeometry,
  NearestFilter,
  Object3D,
  RedFormat,
  TubeGeometry,
  Vector3,
} from 'three'
import type {
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Points,
  PointsMaterial,
} from 'three'
import { scrollState } from '../../lib/scrollState'
import { CROSS_T, POWER_EXPONENT, X_DOMAIN } from '../../lib/growthChart'

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)
const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * Waypoints the debris field and particle blooms drift through as the page
 * scrolls (0 = top, 1 = bottom). x/y are world-space offsets, s is scale,
 * o is opacity. Colors are NOT set here — they come only from
 * scrollState.palette, sampled once per frame, so the DOM and the 3D world
 * always agree.
 */
type Waypoint = { at: number; x: number; y: number; s: number; o: number }
const WAYPOINTS: Waypoint[] = [
  { at: 0.0, x: 1.1, y: -0.25, s: 1.0, o: 0.95 },
  { at: 0.25, x: 1.35, y: -0.6, s: 0.92, o: 0.82 },
  { at: 0.6, x: 1.4, y: -0.75, s: 0.9, o: 0.78 },
  { at: 0.88, x: 1.2, y: -0.5, s: 0.98, o: 0.88 },
  { at: 1.0, x: 1.1, y: -0.3, s: 1.05, o: 0.95 }, // footer: rose, in the flood
]

function sample(p: number): Omit<Waypoint, 'at'> {
  if (p <= WAYPOINTS[0].at) return WAYPOINTS[0]
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i]
    const b = WAYPOINTS[i + 1]
    if (p >= a.at && p <= b.at) {
      const e = smoothstep((p - a.at) / (b.at - a.at))
      return {
        x: a.x + (b.x - a.x) * e,
        y: a.y + (b.y - a.y) * e,
        s: a.s + (b.s - a.s) * e,
        o: a.o + (b.o - a.o) * e,
      }
    }
  }
  return WAYPOINTS[WAYPOINTS.length - 1]
}

/**
 * The two curves of the proof section, literally: x^1.01 (compounds, starts
 * at 0) racing a flat 1^x (never moves, starts at 1). Both share the same
 * world-space span so t=0..1 walks real x=0..X_DOMAIN on either curve. A
 * small z undulation on the power curve gives its tube real depth so toon
 * shading reads it as a 3D object rather than a flat ribbon; the flat line
 * stays perfectly planar to read as "unchanging" beside it.
 */
const CHART_SPAN_X = 4.6
const CHART_Y_SCALE = 0.42
const CHART_BASE_Y = -1.05

class PowerCurvePath extends Curve<Vector3> {
  constructor() {
    super()
  }

  getPoint(t: number, optionalTarget = new Vector3()) {
    const real = Math.pow(t * X_DOMAIN, POWER_EXPONENT)
    return optionalTarget.set(
      (t - 0.5) * CHART_SPAN_X,
      CHART_BASE_Y + CHART_Y_SCALE * real,
      Math.sin(t * Math.PI * 2) * 0.14,
    )
  }
}

class FlatCurvePath extends Curve<Vector3> {
  constructor() {
    super()
  }

  getPoint(t: number, optionalTarget = new Vector3()) {
    return optionalTarget.set((t - 0.5) * CHART_SPAN_X, CHART_BASE_Y + CHART_Y_SCALE, 0)
  }
}

/** 3-step gradient map for the toon material — the cel-shaded look. */
function useToonGradientMap() {
  return useMemo(() => {
    // 5 steps (vs. the usual 3) so a thin round tube still reads as
    // rounded instead of flattening into a ribbon under toon shading.
    const data = new Uint8Array([40, 105, 165, 210, 255])
    const texture = new DataTexture(data, data.length, 1, RedFormat)
    texture.minFilter = NearestFilter
    texture.magFilter = NearestFilter
    texture.needsUpdate = true
    return texture
  }, [])
}

const scratchSolid = new Color()
const scratchOutline = new Color()

const powerCurvePath = new PowerCurvePath()
const flatCurvePath = new FlatCurvePath()
const scratchCrossPoint = new Vector3()

/**
 * The proof section's two curves, drawing themselves as the visitor scrolls
 * through it — no morphing, no topology change, ever. Each tube geometry is
 * built once; each frame only drawRange moves, so both curves extend
 * together from local progress written by <GrowthProof>. A marker fades in
 * at (1, 1) — real x=1 — the instant the draw passes the point where x^1.01
 * overtakes the flat line for good.
 */
function GrowthChart({ lite }: { lite: boolean }) {
  const rig = useRef<Group>(null)
  const power = useRef<Mesh>(null)
  const powerOutline = useRef<Mesh>(null)
  const flat = useRef<Mesh>(null)
  const flatOutline = useRef<Mesh>(null)
  const cross = useRef<Mesh>(null)
  const draw = useRef(0)
  const activeMix = useRef(0)
  const gradientMap = useToonGradientMap()
  const powerGeometry = useMemo(
    () => (lite ? new TubeGeometry(powerCurvePath, 100, 0.14, 12, false) : new TubeGeometry(powerCurvePath, 200, 0.14, 20, false)),
    [lite],
  )
  const flatGeometry = useMemo(
    () => (lite ? new TubeGeometry(flatCurvePath, 100, 0.09, 12, false) : new TubeGeometry(flatCurvePath, 200, 0.09, 20, false)),
    [lite],
  )
  const crossGeometry = useMemo(() => new IcosahedronGeometry(0.16, 0), [])
  const powerIndexCount = powerGeometry.index ? powerGeometry.index.count : 0
  const flatIndexCount = flatGeometry.index ? flatGeometry.index.count : 0

  useFrame((state) => {
    const target = scrollState.proofActive ? 1 : 0
    activeMix.current += (target - activeMix.current) * 0.06
    draw.current += (scrollState.proofProgress - draw.current) * 0.08

    const visiblePower = Math.min(powerIndexCount, Math.floor((powerIndexCount * draw.current) / 3) * 3)
    powerGeometry.setDrawRange(0, visiblePower)
    const visibleFlat = Math.min(flatIndexCount, Math.floor((flatIndexCount * draw.current) / 3) * 3)
    flatGeometry.setDrawRange(0, visibleFlat)

    if (rig.current) {
      // Gentle parallax only — the power tube has real z-depth from its
      // undulation, so a small tilt adds dimension without foreshortening it.
      const targetRotY = state.pointer.x * 0.12
      const targetRotX = state.pointer.y * -0.08
      rig.current.rotation.y += (targetRotY - rig.current.rotation.y) * 0.05
      rig.current.rotation.x += (targetRotX - rig.current.rotation.x) * 0.05
    }

    // The crossover marker sits at (1, 1) in real terms and fades in once
    // the draw has actually passed it, never before.
    if (cross.current) {
      powerCurvePath.getPoint(CROSS_T, scratchCrossPoint)
      cross.current.position.copy(scratchCrossPoint)
      cross.current.rotation.y += 0.012
      cross.current.rotation.z += 0.005
    }

    const { paperRgb, accentRgb, inkRgb, dev } = scrollState.palette
    const baseOpacity = activeMix.current * 0.95

    // The power curve is the story's protagonist — it takes the accent color.
    scratchSolid.setRGB(accentRgb[0], accentRgb[1], accentRgb[2])
    scratchOutline.setRGB(inkRgb[0], inkRgb[1], inkRgb[2])
    const powerMat = power.current?.material as MeshToonMaterial | undefined
    if (powerMat) {
      powerMat.opacity += (baseOpacity - powerMat.opacity) * 0.08
      powerMat.color.copy(scratchSolid)
      powerMat.emissive.copy(scratchSolid).multiplyScalar(0.2 + dev * 0.15)
    }
    const powerOutlineMat = powerOutline.current?.material as MeshBasicMaterial | undefined
    if (powerOutlineMat && powerMat) {
      powerOutlineMat.opacity = powerMat.opacity * 0.85
      powerOutlineMat.color.copy(scratchOutline)
    }

    // The flat line stays muted — it never changes, so it never draws the eye.
    scratchSolid.setRGB(paperRgb[0], paperRgb[1], paperRgb[2])
    const flatMat = flat.current?.material as MeshToonMaterial | undefined
    if (flatMat) {
      flatMat.opacity += (baseOpacity * 0.75 - flatMat.opacity) * 0.08
      flatMat.color.copy(scratchSolid)
      flatMat.emissive.copy(scratchSolid).multiplyScalar(0.08)
    }
    const flatOutlineMat = flatOutline.current?.material as MeshBasicMaterial | undefined
    if (flatOutlineMat && flatMat) {
      flatOutlineMat.opacity = flatMat.opacity * 0.85
      flatOutlineMat.color.copy(scratchOutline)
    }

    const crossTarget = draw.current >= CROSS_T ? baseOpacity : 0
    const crossMat = cross.current?.material as MeshToonMaterial | undefined
    if (crossMat) {
      crossMat.opacity += (crossTarget - crossMat.opacity) * 0.1
      crossMat.color.setRGB(accentRgb[0], accentRgb[1], accentRgb[2])
      crossMat.emissive.setRGB(accentRgb[0], accentRgb[1], accentRgb[2]).multiplyScalar(0.4)
    }
  })

  return (
    <group ref={rig} position={[1.15, -0.15, 0]}>
      <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.5}>
        <mesh ref={power} geometry={powerGeometry}>
          <meshToonMaterial gradientMap={gradientMap} transparent opacity={0} />
        </mesh>
        <mesh ref={powerOutline} geometry={powerGeometry} scale={1.01}>
          <meshBasicMaterial side={BackSide} transparent opacity={0} />
        </mesh>
        <mesh ref={flat} geometry={flatGeometry}>
          <meshToonMaterial gradientMap={gradientMap} transparent opacity={0} />
        </mesh>
        <mesh ref={flatOutline} geometry={flatGeometry} scale={1.01}>
          <meshBasicMaterial side={BackSide} transparent opacity={0} />
        </mesh>
        <mesh ref={cross} geometry={crossGeometry}>
          <meshToonMaterial gradientMap={gradientMap} transparent opacity={0} />
        </mesh>
      </Float>
    </group>
  )
}

const DEBRIS_COUNT = 24
const dummy = new Object3D()

/** Low-poly instanced debris the visitor appears to travel through while scrolling. */
function DebrisCorridor() {
  const solidRef = useRef<InstancedMesh>(null)
  const outlineRef = useRef<InstancedMesh>(null)
  const group = useRef<Group>(null)
  const geometry = useMemo(() => new IcosahedronGeometry(1, 0), [])
  const gradientMap = useToonGradientMap()

  const instances = useMemo(
    () =>
      Array.from({ length: DEBRIS_COUNT }, (_, i) => ({
        position: new Vector3(
          (Math.sin(i * 12.9) * 0.5 + 0.5) * 6 - 3,
          -(i / DEBRIS_COUNT) * 22 + 1,
          (Math.cos(i * 7.3) * 0.5 + 0.5) * -4 - 1,
        ),
        scale: 0.05 + ((i * 37) % 10) / 60,
        rotation: new Vector3(i * 0.7, i * 1.3, i * 0.4),
      })),
    [],
  )

  useFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? clamp01(window.scrollY / max) : 0
    if (group.current) {
      const targetY = p * 20
      group.current.position.y += (targetY - group.current.position.y) * 0.05
    }

    const solidMesh = solidRef.current
    const outlineMesh = outlineRef.current
    if (!solidMesh || !outlineMesh) return

    instances.forEach((inst, i) => {
      dummy.position.copy(inst.position)
      dummy.rotation.set(inst.rotation.x, inst.rotation.y + p * 2, inst.rotation.z)
      dummy.scale.setScalar(inst.scale)
      dummy.updateMatrix()
      solidMesh.setMatrixAt(i, dummy.matrix)
      dummy.scale.setScalar(inst.scale * 1.08)
      dummy.updateMatrix()
      outlineMesh.setMatrixAt(i, dummy.matrix)
    })
    solidMesh.instanceMatrix.needsUpdate = true
    outlineMesh.instanceMatrix.needsUpdate = true

    const { paperRgb, accentRgb, inkRgb, dev } = scrollState.palette
    const opacity = clamp01(0.16 + Math.sin(p * Math.PI) * 0.12)
    const solidMat = solidMesh.material as MeshToonMaterial
    solidMat.opacity += (opacity - solidMat.opacity) * 0.07
    scratchSolid.setRGB(
      paperRgb[0] + (accentRgb[0] - paperRgb[0]) * dev * 0.5,
      paperRgb[1] + (accentRgb[1] - paperRgb[1]) * dev * 0.5,
      paperRgb[2] + (accentRgb[2] - paperRgb[2]) * dev * 0.5,
    )
    solidMat.color.copy(scratchSolid)

    const outlineMat = outlineMesh.material as MeshBasicMaterial
    outlineMat.opacity = solidMat.opacity * 0.8
    scratchOutline.setRGB(inkRgb[0], inkRgb[1], inkRgb[2])
    outlineMat.color.copy(scratchOutline)
  })

  return (
    <group ref={group}>
      <instancedMesh ref={solidRef} args={[geometry, undefined, DEBRIS_COUNT]}>
        <meshToonMaterial gradientMap={gradientMap} transparent opacity={0} />
      </instancedMesh>
      <instancedMesh ref={outlineRef} args={[geometry, undefined, DEBRIS_COUNT]}>
        <meshBasicMaterial side={BackSide} transparent opacity={0} />
      </instancedMesh>
    </group>
  )
}

const BLOOM_COUNT = 400

function createBloomGeometry(count: number) {
  const g = new BufferGeometry()
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const radius = 1.4 + Math.random() * 1.6
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6
    positions[i * 3 + 2] = radius * Math.cos(phi) * 0.6
  }
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return g
}

/** One-shot rose particle bloom that windows in only near the finale. */
function FinaleBloom() {
  const points = useRef<Points>(null)
  const geometry = useMemo(() => createBloomGeometry(BLOOM_COUNT), [])

  useFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? clamp01(window.scrollY / max) : 0
    const k = sample(p)
    if (points.current) {
      // Bloom drifts with the waypoint track, riding slightly above it.
      points.current.position.set(k.x + 1.35 * k.s, k.y + 1.4 * k.s, 0)
      points.current.rotation.y += 0.0015
    }
    const window0 = clamp01((p - 0.86) / 0.06)
    const window1 = 1 - clamp01((p - 0.97) / 0.03)
    const targetOpacity = clamp01(window0 * window1) * 0.85
    const mat = points.current?.material as PointsMaterial | undefined
    if (mat) {
      mat.opacity += (targetOpacity - mat.opacity) * 0.08
      const { accentRgb } = scrollState.palette
      mat.color.setRGB(accentRgb[0], accentRgb[1], accentRgb[2])
    }
  })

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial size={0.035} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
    </points>
  )
}

const LAFFY_BLOOM_COUNT = 220

/** Soft particle bloom that swells in behind the slope while Laffy's story beats are pinned. */
function LaffyBloom() {
  const points = useRef<Points>(null)
  const geometry = useMemo(() => createBloomGeometry(LAFFY_BLOOM_COUNT), [])

  useFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? clamp01(window.scrollY / max) : 0
    const k = sample(p)
    if (points.current) {
      points.current.position.set(k.x, k.y, 0)
      points.current.rotation.y += 0.001
    }
    const active = scrollState.activeProject === 'laffy'
    const wobble = Math.sin(scrollState.projectProgress * Math.PI)
    const targetOpacity = active ? clamp01(wobble) * 0.6 : 0
    const mat = points.current?.material as PointsMaterial | undefined
    if (mat) {
      mat.opacity += (targetOpacity - mat.opacity) * 0.08
      const { laffyRgb } = scrollState.palette
      mat.color.setRGB(laffyRgb[0], laffyRgb[1], laffyRgb[2])
    }
  })

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial size={0.03} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
    </points>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[3.5, 2.5, 4]} intensity={45} />
      <pointLight position={[-4, -2, -3]} intensity={20} />
      <directionalLight position={[2, 4, 6]} intensity={0.5} />
    </>
  )
}

export default function BackgroundScene({ lite = false }: { lite?: boolean }) {
  return (
    <Canvas
      dpr={lite ? [1, 1] : [1, 1.5]}
      camera={{ position: [0, 0, 5.5], fov: 45 }}
      gl={{ antialias: !lite, alpha: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Lights />
      <GrowthChart lite={lite} />
      {!lite && <DebrisCorridor />}
      <LaffyBloom />
      <FinaleBloom />
    </Canvas>
  )
}
