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

/**
 * Waypoints the slope drifts through as the page scrolls (0 = top, 1 = bottom).
 * x/y are world-space offsets, s is scale, o is opacity. The drift is modest —
 * the slope is ~5.4 world units wide, so it mostly stays put (center-right)
 * and the story is told by how much of it has been drawn, not by travel.
 * Colors are NOT set here — they come only from scrollState.palette, sampled
 * once per frame, so the DOM and the 3D world always agree.
 */
type Waypoint = { at: number; x: number; y: number; s: number; o: number }
const WAYPOINTS: Waypoint[] = [
  { at: 0.0, x: 1.1, y: -0.25, s: 1.0, o: 0.95 }, // hero: slope base rising bottom-right
  { at: 0.25, x: 1.35, y: -0.6, s: 0.92, o: 0.82 }, // about/work: settles lower, behind text
  { at: 0.6, x: 1.4, y: -0.75, s: 0.9, o: 0.78 }, // drifts through the case studies
  { at: 0.88, x: 1.2, y: -0.5, s: 0.98, o: 0.88 }, // rises again approaching the finale
  { at: 1.0, x: 1.1, y: -0.3, s: 1.05, o: 0.95 }, // footer: full slope, rose, in the flood
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
 * "Slope over intercept," literally: a gently accelerating ascent. The rise
 * uses t^1.7 so the curve starts shallow and steepens toward the end — the
 * growth story — and a small z undulation gives the tube real depth so toon
 * shading reads it as a 3D object rather than a flat ribbon.
 */
const SLOPE_SPAN_X = 5.4
const SLOPE_RISE = 2.6
const SLOPE_BASE_Y = -1.2

class SlopePath extends Curve<Vector3> {
  constructor() {
    super()
  }

  getPoint(t: number, optionalTarget = new Vector3()) {
    return optionalTarget.set(
      (t - 0.5) * SLOPE_SPAN_X,
      SLOPE_BASE_Y + SLOPE_RISE * Math.pow(t, 1.7),
      Math.sin(t * Math.PI * 2.2) * 0.22,
    )
  }
}

/** How much of the slope is drawn at page scroll p: never empty (the hero
 *  shows the base of the climb), complete only at the very bottom. */
function drawProgressFor(p: number) {
  return 0.12 + 0.88 * clamp01(p)
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

const slopePath = new SlopePath()
const scratchTip = new Vector3()

/**
 * The ascending slope that draws itself as the page scrolls — no morphing,
 * no topology change, ever. The tube geometry is built once; each frame only
 * drawRange moves (which indices the GPU renders), so the curve extends
 * upward as the visitor descends the page. A small tip marker rides the end
 * of the drawn portion: "you are here" on the climb.
 */
function Slope({ lite }: { lite: boolean }) {
  const rig = useRef<Group>(null)
  const solid = useRef<Mesh>(null)
  const outline = useRef<Mesh>(null)
  const tip = useRef<Mesh>(null)
  const draw = useRef(drawProgressFor(0))
  const surgeMix = useRef(0)
  const laffyMix = useRef(0)
  const gradientMap = useToonGradientMap()
  const geometry = useMemo(
    () => (lite ? new TubeGeometry(slopePath, 120, 0.16, 12, false) : new TubeGeometry(slopePath, 240, 0.16, 24, false)),
    [lite],
  )
  const tipGeometry = useMemo(() => new IcosahedronGeometry(0.2, 0), [])
  const indexCount = geometry.index ? geometry.index.count : 0

  useFrame((state) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? clamp01(window.scrollY / max) : 0
    const k = sample(p)

    draw.current += (drawProgressFor(p) - draw.current) * 0.05
    // Snap the visible index count to whole triangles so the cut end stays clean.
    const visible = Math.min(indexCount, Math.floor((indexCount * draw.current) / 3) * 3)
    geometry.setDrawRange(0, visible)

    if (rig.current) {
      rig.current.position.x += (k.x - rig.current.position.x) * 0.045
      rig.current.position.y += (k.y - rig.current.position.y) * 0.045
      const s = rig.current.scale.x + (k.s - rig.current.scale.x) * 0.07
      rig.current.scale.setScalar(s)
      // Gentle parallax only — the tube has real z-depth from its undulation,
      // so a small tilt adds dimension without foreshortening it into a line.
      const targetRotY = state.pointer.x * 0.15
      const targetRotX = state.pointer.y * -0.1
      rig.current.rotation.y += (targetRotY - rig.current.rotation.y) * 0.05
      rig.current.rotation.x += (targetRotX - rig.current.rotation.x) * 0.05
    }

    // The tip marker sits at the end of the drawn portion of the curve
    // (local coordinates — it lives inside the same rig/Float transform).
    if (tip.current) {
      slopePath.getPoint(draw.current, scratchTip)
      tip.current.position.copy(scratchTip)
      tip.current.rotation.y += 0.01
      tip.current.rotation.z += 0.004
    }

    // Each project's pinned story tints the whole climb: Surge cools it
    // toward teal, Laffy warms it toward rose; the emissive lift makes the
    // slope glow slightly brighter while a story is being told.
    surgeMix.current += ((scrollState.activeProject === 'surge' ? 1 : 0) - surgeMix.current) * 0.05
    laffyMix.current += ((scrollState.activeProject === 'laffy' ? 1 : 0) - laffyMix.current) * 0.05

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

    const storyGlow = (surgeMix.current + laffyMix.current) * 0.12
    const mat = solid.current?.material as MeshToonMaterial | undefined
    if (mat) {
      mat.opacity += (k.o - mat.opacity) * 0.08
      mat.color.copy(scratchSolid)
      mat.emissive.copy(scratchSolid).multiplyScalar(0.18 + dev * 0.15 + storyGlow)
    }
    const outlineMat = outline.current?.material as MeshBasicMaterial | undefined
    if (outlineMat && mat) {
      outlineMat.opacity = mat.opacity * 0.85
      outlineMat.color.copy(scratchOutline)
    }
    const tipMat = tip.current?.material as MeshToonMaterial | undefined
    if (tipMat && mat) {
      tipMat.opacity += (k.o - tipMat.opacity) * 0.08
      tipMat.color.copy(scratchSolid)
      tipMat.emissive.copy(scratchSolid).multiplyScalar(0.35 + storyGlow)
    }
  })

  return (
    <group ref={rig}>
      <Float speed={1.3} rotationIntensity={0.15} floatIntensity={0.6}>
        <mesh ref={solid} geometry={geometry}>
          <meshToonMaterial gradientMap={gradientMap} transparent opacity={0} />
        </mesh>
        {/* Small multiplier: the slope reaches far from the origin, so a
            uniform scale-up drifts the outline more at the ends than the
            middle — keep it tight so the rim never visibly detaches. */}
        <mesh ref={outline} geometry={geometry} scale={1.008}>
          <meshBasicMaterial side={BackSide} transparent opacity={0} />
        </mesh>
        <mesh ref={tip} geometry={tipGeometry}>
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
      // Bloom at the summit — the top end of the fully-drawn slope.
      points.current.position.set(k.x + (SLOPE_SPAN_X / 2) * k.s, k.y + (SLOPE_BASE_Y + SLOPE_RISE) * k.s, 0)
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
      <Slope lite={lite} />
      {!lite && <DebrisCorridor />}
      <LaffyBloom />
      <FinaleBloom />
    </Canvas>
  )
}
