import type { SampledPalette } from './palette'
import { samplePalette } from './palette'

/**
 * Mutable singleton read by the DOM color director and the 3D scene every
 * frame. Deliberately not React state — this changes ~60x/sec and neither
 * consumer should re-render off of it.
 */
export const scrollState = {
  progress: 0,
  smoothProgress: 0,
  isFlooded: false,
  palette: samplePalette(0),
  hoverAccent: null as [number, number, number] | null,
  /** Which pinned story chapter is currently scrubbing, if any. */
  activeProject: 'none' as 'none' | 'about' | 'surge' | 'laffy',
  /** 0-1 local progress through the active chapter's pinned section. */
  projectProgress: 0,
  /** 0-1 local scroll progress through the growth-chart proof section (clamped: 0 before, 1 after). */
  proofProgress: 0,
  /** Whether the proof section's pinned viewport is roughly on screen — drives the chart's fade. */
  proofActive: false,
}

export function updateScrollState(rawProgress: number, damping = 0.07) {
  scrollState.progress = rawProgress
  scrollState.smoothProgress += (rawProgress - scrollState.smoothProgress) * damping
  scrollState.palette = samplePalette(scrollState.smoothProgress) as SampledPalette
  scrollState.isFlooded = scrollState.smoothProgress > 0.88
  return scrollState
}
