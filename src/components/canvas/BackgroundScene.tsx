import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  ConeGeometry,
  Curve,
  DataTexture,
  Float32BufferAttribute,
  IcosahedronGeometry,
  NearestFilter,
  Object3D,
  RedFormat,
  SphereGeometry,
  Vector3,
} from 'three'
import type {
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Points,
  PointsMaterial,
} from 'three'
import { scrollState } from '../../lib/scrollState'
import { CROSS_T, X_DOMAIN, fastExponential, slowExponential } from '../../lib/growthChart'

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
 * The proof section uses two true exponentials: one starts lower but compounds
 * faster, the other starts higher and compounds slowly. Same domain, same
 * world-space span; the crossing point is shared with the DOM label timing.
 */
const CHART_SPAN_X = 5.2
const CHART_Y_SCALE = 0.32
const CHART_BASE_Y = -1.18
const CHART_LEFT = -CHART_SPAN_X / 2
const CHART_RIGHT = CHART_SPAN_X / 2
const CHART_VALUE_MAX = Math.ceil(Math.max(fastExponential(X_DOMAIN), slowExponential(X_DOMAIN)))
const CHART_TOP = CHART_BASE_Y + CHART_VALUE_MAX * CHART_Y_SCALE
const CHART_AXIS_Z = -0.04
const CHART_CURVE_Z = 0.02
const CHART_FIT_WIDTH = CHART_SPAN_X + 0.9

class FastExponentialCurvePath extends Curve<Vector3> {
  constructor() {
    super()
  }

  getPoint(t: number, optionalTarget = new Vector3()) {
    const real = fastExponential(t * X_DOMAIN)
    return optionalTarget.set(
      (t - 0.5) * CHART_SPAN_X,
      CHART_BASE_Y + CHART_Y_SCALE * real,
      CHART_CURVE_Z,
    )
  }
}

class SlowExponentialCurvePath extends Curve<Vector3> {
  constructor() {
    super()
  }

  getPoint(t: number, optionalTarget = new Vector3()) {
    const real = slowExponential(t * X_DOMAIN)
    return optionalTarget.set((t - 0.5) * CHART_SPAN_X, CHART_BASE_Y + CHART_Y_SCALE * real, CHART_CURVE_Z - 0.02)
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

const fastExponentialCurvePath = new FastExponentialCurvePath()
const slowExponentialCurvePath = new SlowExponentialCurvePath()
const scratchCrossPoint = new Vector3()

function createChartAxesGeometry() {
  const g = new BufferGeometry()
  g.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        CHART_LEFT,
        CHART_BASE_Y,
        CHART_AXIS_Z,
        CHART_RIGHT + 0.28,
        CHART_BASE_Y,
        CHART_AXIS_Z,
        CHART_LEFT,
        CHART_BASE_Y,
        CHART_AXIS_Z,
        CHART_LEFT,
        CHART_TOP + 0.28,
        CHART_AXIS_Z,
      ],
      3,
    ),
  )
  return g
}

function createChartGridGeometry() {
  const points: number[] = []
  for (let i = 1; i <= X_DOMAIN; i++) {
    const x = CHART_LEFT + (i / X_DOMAIN) * CHART_SPAN_X
    points.push(x, CHART_BASE_Y, CHART_AXIS_Z, x, CHART_TOP, CHART_AXIS_Z)
  }
  for (let i = 1; i <= CHART_VALUE_MAX; i++) {
    const y = CHART_BASE_Y + i * CHART_Y_SCALE
    points.push(CHART_LEFT, y, CHART_AXIS_Z, CHART_RIGHT, y, CHART_AXIS_Z)
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(points, 3))
  return g
}

function createCurveLineSegmentsGeometry(path: Curve<Vector3>, segments: number) {
  const points: number[] = []
  const a = new Vector3()
  const b = new Vector3()
  for (let i = 0; i < segments; i++) {
    path.getPoint(i / segments, a)
    path.getPoint((i + 1) / segments, b)
    points.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(points, 3))
  g.setDrawRange(0, 0)
  return g
}

/**
 * A scroll-scrubbed WebGL graph: thin axes, a quiet grid, and two spare
 * curves. The geometry stays 3D, but the styling borrows from a clean math
 * animation instead of a chunky object render.
 */
function GrowthChart({ lite }: { lite: boolean }) {
  const rig = useRef<Group>(null)
  const grid = useRef<LineSegments>(null)
  const axes = useRef<LineSegments>(null)
  const arrowX = useRef<Mesh>(null)
  const arrowY = useRef<Mesh>(null)
  const fast = useRef<LineSegments>(null)
  const slow = useRef<LineSegments>(null)
  const cross = useRef<Mesh>(null)
  const draw = useRef(0)
  const activeMix = useRef(0)
  const axesGeometry = useMemo(createChartAxesGeometry, [])
  const gridGeometry = useMemo(createChartGridGeometry, [])
  const fastGeometry = useMemo(() => createCurveLineSegmentsGeometry(fastExponentialCurvePath, lite ? 120 : 240), [lite])
  const slowGeometry = useMemo(() => createCurveLineSegmentsGeometry(slowExponentialCurvePath, lite ? 120 : 240), [lite])
  const arrowGeometry = useMemo(() => new ConeGeometry(0.055, 0.18, 16), [])
  const crossGeometry = useMemo(() => new SphereGeometry(0.04, 16, 10), [])
  const fastPointCount = fastGeometry.getAttribute('position').count
  const slowPointCount = slowGeometry.getAttribute('position').count

  useFrame((state, delta) => {
    // Delta-time smoothing so the draw tracks scroll identically on 60Hz,
    // 120Hz, and throttled tabs — a fixed per-frame lerp lags badly when the
    // frame rate drops and overshoots the feel when it rises.
    const eFade = 1 - Math.exp(-3.6 * delta)
    const eDraw = 1 - Math.exp(-4.8 * delta)

    const target = scrollState.proofActive ? 1 : 0
    activeMix.current += (target - activeMix.current) * eFade
    draw.current += (scrollState.proofProgress - draw.current) * eDraw

    const visibleFast = Math.min(fastPointCount, Math.floor((fastPointCount * draw.current) / 2) * 2)
    fastGeometry.setDrawRange(0, visibleFast)
    const visibleSlow = Math.min(slowPointCount, Math.floor((slowPointCount * draw.current) / 2) * 2)
    slowGeometry.setDrawRange(0, visibleSlow)

    if (rig.current) {
      const targetRotY = state.pointer.x * 0.045
      const targetRotX = state.pointer.y * -0.03
      rig.current.rotation.y += (targetRotY - rig.current.rotation.y) * eFade
      rig.current.rotation.x += (targetRotX - rig.current.rotation.x) * eFade
      const targetScale = Math.min(1, (state.viewport.width * 0.88) / CHART_FIT_WIDTH)
      const scale = rig.current.scale.x + (targetScale - rig.current.scale.x) * eDraw
      rig.current.scale.setScalar(scale)
    }

    if (cross.current) {
      fastExponentialCurvePath.getPoint(CROSS_T, scratchCrossPoint)
      cross.current.position.copy(scratchCrossPoint)
    }

    const { paperRgb, accentRgb, inkRgb } = scrollState.palette
    const baseOpacity = activeMix.current * 0.88

    scratchSolid.setRGB(paperRgb[0], paperRgb[1], paperRgb[2])
    scratchOutline.setRGB(inkRgb[0], inkRgb[1], inkRgb[2])

    const gridMat = grid.current?.material as LineBasicMaterial | undefined
    if (gridMat) {
      gridMat.opacity += (baseOpacity * 0.16 - gridMat.opacity) * eDraw
      gridMat.color.copy(scratchSolid)
    }

    const axesMat = axes.current?.material as LineBasicMaterial | undefined
    if (axesMat) {
      axesMat.opacity += (baseOpacity * 0.55 - axesMat.opacity) * eDraw
      axesMat.color.copy(scratchSolid)
    }

    for (const arrow of [arrowX.current, arrowY.current]) {
      const mat = arrow?.material as MeshBasicMaterial | undefined
      if (mat) {
        mat.opacity += (baseOpacity * 0.72 - mat.opacity) * eDraw
        mat.color.copy(scratchSolid)
      }
    }

    const fastMat = fast.current?.material as LineBasicMaterial | undefined
    if (fastMat) {
      fastMat.opacity += (baseOpacity - fastMat.opacity) * eDraw
      fastMat.color.setRGB(accentRgb[0], accentRgb[1], accentRgb[2])
    }

    const slowMat = slow.current?.material as LineBasicMaterial | undefined
    if (slowMat) {
      slowMat.opacity += (baseOpacity * 0.68 - slowMat.opacity) * eDraw
      slowMat.color.copy(scratchSolid)
    }

    const crossTarget = draw.current >= CROSS_T ? baseOpacity * 0.45 : 0
    const crossMat = cross.current?.material as MeshBasicMaterial | undefined
    if (crossMat) {
      crossMat.opacity += (crossTarget - crossMat.opacity) * eDraw
      crossMat.color.setRGB(accentRgb[0], accentRgb[1], accentRgb[2])
    }
  })

  return (
    <group ref={rig} position={[0, -0.05, 0]}>
      <Float speed={0.55} rotationIntensity={0.035} floatIntensity={0.12}>
        <lineSegments ref={grid} geometry={gridGeometry}>
          <lineBasicMaterial transparent opacity={0} depthWrite={false} />
        </lineSegments>
        <lineSegments ref={axes} geometry={axesGeometry}>
          <lineBasicMaterial transparent opacity={0} depthWrite={false} />
        </lineSegments>
        <mesh ref={arrowX} geometry={arrowGeometry} position={[CHART_RIGHT + 0.32, CHART_BASE_Y, CHART_AXIS_Z]} rotation={[0, 0, -Math.PI / 2]}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh ref={arrowY} geometry={arrowGeometry} position={[CHART_LEFT, CHART_TOP + 0.32, CHART_AXIS_Z]}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <lineSegments ref={slow} geometry={slowGeometry}>
          <lineBasicMaterial transparent opacity={0} depthWrite={false} />
        </lineSegments>
        <lineSegments ref={fast} geometry={fastGeometry}>
          <lineBasicMaterial transparent opacity={0} depthWrite={false} />
        </lineSegments>
        <mesh ref={cross} geometry={crossGeometry}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
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
    const proofQuiet = scrollState.proofActive ? 0.16 : 1
    const opacity = clamp01(0.16 + Math.sin(p * Math.PI) * 0.12) * proofQuiet
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
    const targetOpacity = clamp01(window0 * window1) * (scrollState.proofActive ? 0 : 0.85)
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
