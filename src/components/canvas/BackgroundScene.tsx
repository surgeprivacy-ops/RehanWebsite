import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import { BufferAttribute, Curve, TubeGeometry, Vector3 } from 'three'
import type { BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)
const smoothstep = (t: number) => t * t * (3 - 2 * t)
const LINE_TILT = -0.08
const CAMERA_Z = 5.5
const CAMERA_FOV = 45

/**
 * Waypoints the shape travels through as the page scrolls (0 = top, 1 = bottom).
 * x/y are world-space offsets, s is scale, o is opacity, m is line morph amount.
 */
type Waypoint = { at: number; x: number; y: number; s: number; o: number; m: number }
const WAYPOINTS: Waypoint[] = [
  { at: 0.0, x: 2.55, y: 0.0, s: 1.08, o: 0.9, m: 0 }, // hero: full knot, right side
  { at: 0.18, x: 2.05, y: -0.15, s: 1.02, o: 0.68, m: 0.14 }, // loosens slowly
  { at: 0.34, x: 1.35, y: -0.98, s: 0.86, o: 0.34, m: 0.62 }, // halfway into line
  { at: 0.48, x: 1.25, y: -0.95, s: 0.58, o: 0.1, m: 1 }, // work: straight, subtle
  { at: 0.66, x: 1.45, y: -0.9, s: 0.56, o: 0.09, m: 1 }, // drifts through whitespace
  { at: 0.8, x: 1.1, y: -1.18, s: 0.68, o: 0.15, m: 0.86 }, // starts tying back together
  { at: 0.92, x: 1.1, y: -0.72, s: 0.88, o: 0.28, m: 0.38 }, // reforms before footer
  { at: 1.0, x: 1.45, y: -0.42, s: 0.95, o: 0.38, m: 0 }, // footer: knot returns, offset from heading
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

function updateMorphGeometry(
  geometry: BufferGeometry,
  knotPositions: BufferAttribute,
  linePositions: BufferAttribute,
  amount: number,
) {
  const position = geometry.getAttribute('position') as BufferAttribute
  const target = position.array
  const knot = knotPositions.array
  const line = linePositions.array

  for (let i = 0; i < target.length; i++) {
    target[i] = knot[i] + (line[i] - knot[i]) * amount
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
}

function Knot() {
  const rig = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const solid = useRef<Mesh>(null)
  const wire = useRef<Mesh>(null)
  const morph = useRef(0)
  const quietWorldY = useRef(-0.8)
  const quietSample = useRef(0)
  const { geometry, knotPositions, linePositions } = useMemo(() => {
    const knot = makeTube(new KnotPath())
    const line = makeTube(new LinePath())
    const geometry = knot.clone()

    return {
      geometry,
      knotPositions: knot.getAttribute('position') as BufferAttribute,
      linePositions: line.getAttribute('position') as BufferAttribute,
    }
  }, [])

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
      // scroll-driven travel (lerped for smoothness)
      rig.current.position.x += (targetX - rig.current.position.x) * 0.045
      rig.current.position.y += (targetY - rig.current.position.y) * 0.045
      const s = rig.current.scale.x + (k.s - rig.current.scale.x) * 0.07
      rig.current.scale.setScalar(s)
      // cursor parallax lean
      const targetRotY = state.pointer.x * 0.5 * (1 - lineAmount * 0.7)
      const targetRotX = state.pointer.y * -0.3 * (1 - lineAmount * 0.7)
      rig.current.rotation.y += (targetRotY - rig.current.rotation.y) * 0.05
      rig.current.rotation.x += (targetRotX - rig.current.rotation.x) * 0.05
    }

    morph.current += (k.m - morph.current) * 0.045
    updateMorphGeometry(geometry, knotPositions, linePositions, morph.current)

    if (spin.current) {
      const knotness = 1 - morph.current
      spin.current.rotation.z += delta * knotness * (0.15 + scrollP * 0.5)
      spin.current.rotation.x += (0 - spin.current.rotation.x) * morph.current * 0.03
      spin.current.rotation.y += (0 - spin.current.rotation.y) * morph.current * 0.03
      spin.current.rotation.z += (LINE_TILT - spin.current.rotation.z) * lineAmount * 0.04
    }

    const solidMat = solid.current?.material as MeshStandardMaterial | undefined
    if (solidMat) solidMat.opacity += (k.o - solidMat.opacity) * 0.07
    const wireMat = wire.current?.material as MeshBasicMaterial | undefined
    if (wireMat && solidMat) wireMat.opacity = solidMat.opacity * (0.06 + morph.current * 0.14)
  })

  return (
    <group ref={rig}>
      <Float speed={1.3} rotationIntensity={0.5} floatIntensity={1}>
        <group ref={spin}>
          <mesh ref={solid} geometry={geometry}>
            <meshStandardMaterial
              color="#100f0d"
              roughness={0.18}
              metalness={0.9}
              emissive="#e8a33d"
              emissiveIntensity={0.12}
              transparent
              opacity={0.95}
            />
          </mesh>
          <mesh ref={wire} geometry={geometry} scale={1.006}>
            <meshBasicMaterial color="#f2efe9" wireframe transparent opacity={0.05} />
          </mesh>
        </group>
      </Float>
    </group>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[4, 3, 5]} intensity={80} color="#e8a33d" />
      <pointLight position={[-5, -2, -4]} intensity={30} color="#8a867f" />
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
    </Canvas>
  )
}
