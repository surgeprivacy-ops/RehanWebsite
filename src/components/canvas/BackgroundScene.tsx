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
  { at: 0.0, x: 2.55, y: 0.0, s: 1.08, o: 0.9, m: 0 }, // hero: full knot, right side
  { at: 0.18, x: 2.05, y: -0.15, s: 1.02, o: 0.68, m: 0.14 }, // loosens slowly
  { at: 0.34, x: 1.35, y: -0.98, s: 0.86, o: 0.34, m: 0.62 }, // chapters: halfway into line
  { at: 0.48, x: 1.25, y: -0.95, s: 0.58, o: 0.1, m: 1 }, // work: straight, subtle
  { at: 0.66, x: 1.45, y: -0.9, s: 0.56, o: 0.09, m: 1 }, // drifts through whitespace
  { at: 0.8, x: 1.1, y: -1.18, s: 0.68, o: 0.15, m: 0.86 }, // starts tying back together
  { at: 0.92, x: 1.1, y: -0.72, s: 0.88, o: 0.28, m: 0.38 }, // reforms before footer
  { at: 1.0, x: 1.45, y: -0.42, s: 0.95, o: 0.42, m: 0 }, // footer: knot returns, rose, in the flood
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

class KnotPath extends Curve<Vector3> {
  constructor() {
    super()
  }

  getPoint(t: number) {
    const p = 2
    const q = 3
    const u = t * Math.PI * 2 * p
    const quOverP = (q / p) * u
    const radius = 1.18
    const orbit = radius * (2 + Math.cos(quOverP)) * 0.5

    return new Vector3(
      orbit * Math.cos(u),
      orbit * Math.sin(u),
      radius * Math.sin(quOverP) * 0.5,
    )
  }
}

class LinePath extends Curve<Vector3> {
  constructor() {
    super()
  }

  getPoint(t: number) {
    return new Vector3((t - 0.5) * 5.4, 0, 0)
  }
}

function makeTube(path: Curve<Vector3>) {
  return new TubeGeometry(path, 240, 0.16, 24, true)
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

/**
 * The knot and the line are two separate, static meshes (normals computed
 * once, never touched again) that simply cross-fade opacity as `morph`
 * rises. This replaced a per-vertex geometry morph that recomputed vertex
 * normals on a ~6000-vertex tube every single frame — the actual cause of
 * the janky "unraveling" — with something the GPU/CPU barely notices.
 */
function Knot() {
  const rig = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const knotSolid = useRef<Mesh>(null)
  const knotOutline = useRef<Mesh>(null)
  const lineSolid = useRef<Mesh>(null)
  const lineOutline = useRef<Mesh>(null)
  const morph = useRef(0)
  const quietWorldY = useRef(-0.8)
  const quietSample = useRef(0)
  const gradientMap = useToonGradientMap()
  const knotGeometry = useMemo(() => makeTube(new KnotPath()), [])
  const lineGeometry = useMemo(() => makeTube(new LinePath()), [])

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

    if (spin.current) {
      const knotness = 1 - morph.current
      spin.current.rotation.z += delta * knotness * (0.15 + scrollP * 0.5)
      spin.current.rotation.x += (0 - spin.current.rotation.x) * morph.current * 0.03
      spin.current.rotation.y += (0 - spin.current.rotation.y) * morph.current * 0.03
      spin.current.rotation.z += (LINE_TILT - spin.current.rotation.z) * lineAmount * 0.04
    }

    const { paperRgb, accentRgb, inkRgb, dev } = scrollState.palette
    scratchSolid.setRGB(
      paperRgb[0] + (accentRgb[0] - paperRgb[0]) * dev * 0.65,
      paperRgb[1] + (accentRgb[1] - paperRgb[1]) * dev * 0.65,
      paperRgb[2] + (accentRgb[2] - paperRgb[2]) * dev * 0.65,
    )
    scratchOutline.setRGB(inkRgb[0], inkRgb[1], inkRgb[2])

    const knotOpacityTarget = k.o * (1 - lineAmount)
    const lineOpacityTarget = k.o * lineAmount

    const knotMat = knotSolid.current?.material as MeshToonMaterial | undefined
    if (knotMat) {
      knotMat.opacity += (knotOpacityTarget - knotMat.opacity) * 0.08
      knotMat.color.copy(scratchSolid)
      knotMat.emissive.copy(scratchSolid).multiplyScalar(0.18 + dev * 0.15)
    }
    const knotOutlineMat = knotOutline.current?.material as MeshBasicMaterial | undefined
    if (knotOutlineMat && knotMat) {
      knotOutlineMat.opacity = knotMat.opacity * 0.85
      knotOutlineMat.color.copy(scratchOutline)
    }

    const lineMat = lineSolid.current?.material as MeshToonMaterial | undefined
    if (lineMat) {
      lineMat.opacity += (lineOpacityTarget - lineMat.opacity) * 0.08
      lineMat.color.copy(scratchSolid)
      lineMat.emissive.copy(scratchSolid).multiplyScalar(0.18 + dev * 0.15)
    }
    const lineOutlineMat = lineOutline.current?.material as MeshBasicMaterial | undefined
    if (lineOutlineMat && lineMat) {
      lineOutlineMat.opacity = lineMat.opacity * 0.85
      lineOutlineMat.color.copy(scratchOutline)
    }
  })

  return (
    <group ref={rig}>
      <Float speed={1.3} rotationIntensity={0.5} floatIntensity={1}>
        <group ref={spin}>
          <mesh ref={knotSolid} geometry={knotGeometry}>
            <meshToonMaterial gradientMap={gradientMap} transparent opacity={0} />
          </mesh>
          <mesh ref={knotOutline} geometry={knotGeometry} scale={1.025}>
            <meshBasicMaterial side={BackSide} transparent opacity={0} />
          </mesh>
          <mesh ref={lineSolid} geometry={lineGeometry}>
            <meshToonMaterial gradientMap={gradientMap} transparent opacity={0} />
          </mesh>
          <mesh ref={lineOutline} geometry={lineGeometry} scale={1.025}>
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

/** One-shot rose particle bloom that windows in only near the finale. */
function FinaleBloom() {
  const points = useRef<Points>(null)
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const positions = new Float32Array(BLOOM_COUNT * 3)
    for (let i = 0; i < BLOOM_COUNT; i++) {
      const radius = 1.4 + Math.random() * 1.6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6
      positions[i * 3 + 2] = radius * Math.cos(phi) * 0.6
    }
    g.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return g
  }, [])

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

export default function BackgroundScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5.5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Lights />
      <Knot />
      <Companion />
      <DebrisCorridor />
      <FinaleBloom />
    </Canvas>
  )
}
