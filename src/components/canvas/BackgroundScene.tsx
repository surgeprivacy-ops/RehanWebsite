import { useEffect, useMemo, useRef } from 'react'
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

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)
const smoothstep = (t: number) => t * t * (3 - 2 * t)
const LINE_TILT = -0.08
const CAMERA_Z = 5.5
const CAMERA_FOV = 45

/**
 * Waypoints the shape travels through as the page scrolls (0 = top, 1 = bottom).
 * x/y are world-space offsets, s is scale, o is opacity, m is line morph amount.
 * Colors are NOT set here — they come only from scrollState.palette, sampled
 * once per frame, so the DOM and the 3D world always agree.
 */
type Waypoint = { at: number; x: number; y: number; s: number; o: number; m: number }
const WAYPOINTS: Waypoint[] = [
  { at: 0.0, x: 2.55, y: 0.0, s: 1.28, o: 0.95, m: 0 }, // hero: full circle, right side, front and center
  { at: 0.1, x: 1.9, y: -0.4, s: 1.05, o: 0.85, m: 0.3 }, // begins unraveling into the line
  { at: 0.22, x: 1.3, y: -0.9, s: 0.85, o: 0.78, m: 1 }, // work: fully a line now, still clearly visible
  { at: 0.55, x: 1.45, y: -0.9, s: 0.8, o: 0.75, m: 1 }, // drifts through whitespace, staying present
  { at: 0.78, x: 1.1, y: -1.1, s: 0.92, o: 0.8, m: 0.75 }, // starts tying back together
  { at: 0.92, x: 1.1, y: -0.72, s: 1.0, o: 0.85, m: 0.38 }, // reforms before footer
  { at: 1.0, x: 1.45, y: -0.42, s: 1.15, o: 0.92, m: 0 }, // footer: circle returns, rose, in the flood
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
        m: a.m + (b.m - a.m) * e,
      }
    }
  }
  return WAYPOINTS[WAYPOINTS.length - 1]
}

function screenYToWorld(y: number) {
  const visibleWorldHeight = 2 * Math.tan((CAMERA_FOV * Math.PI / 180) / 2) * CAMERA_Z
  return (window.innerHeight / 2 - y) * (visibleWorldHeight / window.innerHeight)
}

function chooseQuietWorldY() {
  const width = window.innerWidth
  const height = window.innerHeight
  const candidates = [0.36, 0.49, 0.62, 0.75].map((n) => n * height)
  const blockers = Array.from(
    document.querySelectorAll<HTMLElement>('header h1, header p, header a, section h2, section p, section a, section li, footer h2, footer p, footer a'),
  )
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 72 && r.top < height)

  const best = candidates.reduce((winner, candidate) => {
    const score = blockers.reduce((sum, rect) => {
      const center = (rect.top + rect.bottom) / 2
      const danger = rect.height / 2 + 58
      const overlap = Math.max(0, danger - Math.abs(candidate - center))
      return sum + overlap * Math.min(rect.width / width, 1)
    }, 0)

    return score < winner.score ? { y: candidate, score } : winner
  }, { y: candidates[0], score: Number.POSITIVE_INFINITY })

  return screenYToWorld(best.y)
}

const CIRCLE_RADIUS = 1.3
/** Circumference of the m=0 circle — kept as the line's length too, so the
 *  tube's own arc length never stretches or compresses as it opens up. */
const COIL_LENGTH = CIRCLE_RADIUS * Math.PI * 2

/**
 * A point on the "opening coil" family: at m=0 this traces an exact circle of
 * radius CIRCLE_RADIUS; at m=1 it's an exact straight line of length
 * COIL_LENGTH; in between it's a circular arc of constant arc length that
 * widens its angular span down to 0 as m rises — literally the shape you'd
 * get by holding a loop of wire and progressively straightening it, not a
 * per-vertex lerp between two unrelated shapes (which looks like the ends
 * sliding through each other rather than uncurling).
 */
function unrollPoint(t: number, m: number, out: Vector3) {
  const totalAngle = (1 - m) * Math.PI * 2
  if (totalAngle < 1e-3) {
    out.set((t - 0.5) * COIL_LENGTH, 0, 0)
    return out
  }
  const radius = COIL_LENGTH / totalAngle
  const angle = (t - 0.5) * totalAngle
  const half = totalAngle / 2
  // Shift so the shape stays centered on the local origin at every m (not
  // just at the endpoints) — otherwise the spin group, which rotates around
  // local origin, would make the coil visibly orbit instead of spin in place.
  const shift = (radius * (1 - Math.cos(half))) / 2
  out.set(radius * Math.sin(angle), radius * (1 - Math.cos(angle)) - shift, 0)
  return out
}

class UnrollPath extends Curve<Vector3> {
  m: number

  constructor(m: number) {
    super()
    this.m = m
  }

  getPoint(t: number) {
    return unrollPoint(t, this.m, new Vector3())
  }
}

function makeTube(path: Curve<Vector3>, lite: boolean) {
  return lite ? new TubeGeometry(path, 120, 0.16, 12, true) : new TubeGeometry(path, 240, 0.16, 24, true)
}

const MORPH_STOPS = [1 / 3, 2 / 3, 1]

/**
 * The base geometry is the m=0 circle; the three morph targets are keyframes
 * along the opening-coil curve at m=1/3, 2/3, 1. Blending two adjacent
 * keyframes (or base→first keyframe) via morphTargetInfluences each frame
 * gives a GPU-driven, per-vertex-correct approximation of the continuous
 * unroll — cheap (static precomputed buffers, no per-frame CPU geometry
 * work) while still looking like the coil is actually uncurling.
 */
function buildUnrollGeometry(lite: boolean) {
  const base = makeTube(new UnrollPath(0), lite)
  const targets = MORPH_STOPS.map((m) => makeTube(new UnrollPath(m), lite))
  base.morphAttributes.position = targets.map((g) => g.attributes.position)
  if (base.attributes.normal && targets.every((g) => g.attributes.normal)) {
    base.morphAttributes.normal = targets.map((g) => g.attributes.normal)
  }
  return base
}

/** Sets the two morphTargetInfluences that bracket `m` so the mesh sits exactly at the right point along the unroll. */
function applyUnrollInfluence(mesh: Mesh | null, m: number) {
  const inf = mesh?.morphTargetInfluences
  if (!inf) return
  for (let i = 0; i < inf.length; i++) inf[i] = 0
  if (m <= 0) return
  const stops = MORPH_STOPS.length
  const idx = Math.min(stops - 1, Math.floor(m * stops))
  const localT = m * stops - idx
  if (idx === 0) {
    inf[0] = localT
  } else {
    inf[idx - 1] = 1 - localT
    inf[idx] = localT
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
const scratchProjectAccent = new Color()

/**
 * A single shape that genuinely uncoils from a circle into a line as the
 * page scrolls, via the opening-coil morph targets above — not a cross-fade
 * between two meshes, and not a raw per-vertex lerp between unrelated
 * shapes (which looks like the shape imploding rather than unraveling).
 */
function Knot({ lite }: { lite: boolean }) {
  const rig = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const solid = useRef<Mesh>(null)
  const outline = useRef<Mesh>(null)
  const morph = useRef(0)
  const quietWorldY = useRef(-0.8)
  const quietSample = useRef(0)
  const surgeMix = useRef(0)
  const laffyMix = useRef(0)
  const gradientMap = useToonGradientMap()
  const geometry = useMemo(() => buildUnrollGeometry(lite), [lite])

  useEffect(() => {
    solid.current?.updateMorphTargets()
    outline.current?.updateMorphTargets()
  }, [geometry])

  useFrame((state, delta) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? clamp01(window.scrollY / max) : 0
    const k = sample(p)
    const scrollP = clamp01(window.scrollY / window.innerHeight)
    const lineAmount = smoothstep(morph.current)
    if (lineAmount > 0.45 && quietSample.current++ % 14 === 0) {
      quietWorldY.current += (chooseQuietWorldY() - quietWorldY.current) * 0.35
    }
    const driftX = lineAmount * (
      Math.sin(state.clock.elapsedTime * 0.48 + scrollP * 5.2) * 0.34
      + Math.cos(state.clock.elapsedTime * 0.31) * 0.12
    )
    const driftY = lineAmount * Math.cos(state.clock.elapsedTime * 0.42 + scrollP * 3.6) * 0.16
    const targetX = k.x * (1 - lineAmount) + (1.48 + driftX) * lineAmount
    const targetY = k.y * (1 - lineAmount) + (quietWorldY.current + driftY) * lineAmount

    if (rig.current) {
      rig.current.position.x += (targetX - rig.current.position.x) * 0.045
      rig.current.position.y += (targetY - rig.current.position.y) * 0.045
      const s = rig.current.scale.x + (k.s - rig.current.scale.x) * 0.07
      rig.current.scale.setScalar(s)
      const targetRotY = state.pointer.x * 0.5 * (1 - lineAmount * 0.7)
      const targetRotX = state.pointer.y * -0.3 * (1 - lineAmount * 0.7)
      rig.current.rotation.y += (targetRotY - rig.current.rotation.y) * 0.05
      rig.current.rotation.x += (targetRotX - rig.current.rotation.x) * 0.05
    }

    morph.current += (k.m - morph.current) * 0.045

    applyUnrollInfluence(solid.current, lineAmount)
    applyUnrollInfluence(outline.current, lineAmount)

    // Each project's pinned story gives the knot a distinct temperament:
    // Surge (analytical, review/test) spins faster and cooler; Laffy
    // (personalized, unbox) settles and warms toward its rose accent.
    surgeMix.current += ((scrollState.activeProject === 'surge' ? 1 : 0) - surgeMix.current) * 0.05
    laffyMix.current += ((scrollState.activeProject === 'laffy' ? 1 : 0) - laffyMix.current) * 0.05
    const spinRate = 1 + surgeMix.current * 0.9 - laffyMix.current * 0.5

    if (spin.current) {
      const knotness = 1 - morph.current
      spin.current.rotation.z += delta * knotness * (0.15 + scrollP * 0.5) * spinRate
      spin.current.rotation.x += (0 - spin.current.rotation.x) * morph.current * 0.03
      spin.current.rotation.y += (0 - spin.current.rotation.y) * morph.current * 0.03
      spin.current.rotation.z += (LINE_TILT - spin.current.rotation.z) * lineAmount * 0.04
    }

    const { paperRgb, accentRgb, surgeRgb, laffyRgb, inkRgb, dev } = scrollState.palette
    scratchSolid.setRGB(
      paperRgb[0] + (accentRgb[0] - paperRgb[0]) * dev * 0.65,
      paperRgb[1] + (accentRgb[1] - paperRgb[1]) * dev * 0.65,
      paperRgb[2] + (accentRgb[2] - paperRgb[2]) * dev * 0.65,
    )
    if (surgeMix.current > 0.01) {
      scratchProjectAccent.setRGB(surgeRgb[0], surgeRgb[1], surgeRgb[2])
      scratchSolid.lerp(scratchProjectAccent, surgeMix.current * 0.85)
    }
    if (laffyMix.current > 0.01) {
      scratchProjectAccent.setRGB(laffyRgb[0], laffyRgb[1], laffyRgb[2])
      scratchSolid.lerp(scratchProjectAccent, laffyMix.current * 0.85)
    }
    scratchOutline.setRGB(inkRgb[0], inkRgb[1], inkRgb[2])

    const mat = solid.current?.material as MeshToonMaterial | undefined
    if (mat) {
      mat.opacity += (k.o - mat.opacity) * 0.08
      mat.color.copy(scratchSolid)
      mat.emissive.copy(scratchSolid).multiplyScalar(0.18 + dev * 0.15)
    }
    const outlineMat = outline.current?.material as MeshBasicMaterial | undefined
    if (outlineMat && mat) {
      outlineMat.opacity = mat.opacity * 0.85
      outlineMat.color.copy(scratchOutline)
    }
  })

  return (
    <group ref={rig}>
      <Float speed={1.3} rotationIntensity={0.5} floatIntensity={1}>
        <group ref={spin}>
          <mesh ref={solid} geometry={geometry}>
            <meshToonMaterial gradientMap={gradientMap} transparent opacity={0} />
          </mesh>
          <mesh ref={outline} geometry={geometry} scale={1.025}>
            <meshBasicMaterial side={BackSide} transparent opacity={0} />
          </mesh>
        </group>
      </Float>
    </group>
  )
}

/** A small companion shape that lags the knot with heavier damping — the traveling-alongside feel. */
function Companion() {
  const rig = useRef<Group>(null)
  const solid = useRef<Mesh>(null)
  const outline = useRef<Mesh>(null)
  const pos = useRef(new Vector3(2.9, -0.6, -0.4))
  const gradientMap = useToonGradientMap()
  const geometry = useMemo(() => new IcosahedronGeometry(0.16, 0), [])

  useFrame((state) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? clamp01(window.scrollY / max) : 0
    const k = sample(p)
    const targetX = k.x + 0.55
    const targetY = k.y - 0.42
    pos.current.x += (targetX - pos.current.x) * 0.02
    pos.current.y += (targetY - pos.current.y) * 0.02
    if (rig.current) {
      rig.current.position.copy(pos.current)
      rig.current.rotation.y += (state.pointer.x * 0.6 - rig.current.rotation.y) * 0.04
      rig.current.rotation.x += (state.pointer.y * -0.4 - rig.current.rotation.x) * 0.04
      rig.current.rotation.z += 0.004
    }
    const { paperRgb, accentRgb, inkRgb, dev } = scrollState.palette
    const solidMat = solid.current?.material as MeshToonMaterial | undefined
    if (solidMat) {
      solidMat.opacity += (k.o * 0.7 - solidMat.opacity) * 0.07
      scratchSolid.setRGB(
        paperRgb[0] + (accentRgb[0] - paperRgb[0]) * dev,
        paperRgb[1] + (accentRgb[1] - paperRgb[1]) * dev,
        paperRgb[2] + (accentRgb[2] - paperRgb[2]) * dev,
      )
      solidMat.color.copy(scratchSolid)
      solidMat.emissive.copy(scratchSolid).multiplyScalar(0.3)
    }
    const outlineMat = outline.current?.material as MeshBasicMaterial | undefined
    if (outlineMat && solidMat) {
      outlineMat.opacity = solidMat.opacity * 0.85
      scratchOutline.setRGB(inkRgb[0], inkRgb[1], inkRgb[2])
      outlineMat.color.copy(scratchOutline)
    }
  })

  return (
    <group ref={rig}>
      <mesh ref={solid} geometry={geometry}>
        <meshToonMaterial gradientMap={gradientMap} transparent opacity={0} />
      </mesh>
      <mesh ref={outline} geometry={geometry} scale={1.08}>
        <meshBasicMaterial side={BackSide} transparent opacity={0} />
      </mesh>
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
      points.current.position.set(k.x, k.y, 0)
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

/** Soft particle bloom that swells in behind the knot while Laffy's story beats are pinned. */
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
      <Knot lite={lite} />
      {!lite && <Companion />}
      {!lite && <DebrisCorridor />}
      <LaffyBloom />
      <FinaleBloom />
    </Canvas>
  )
}
