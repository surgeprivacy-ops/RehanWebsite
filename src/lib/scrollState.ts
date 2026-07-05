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
  /** Which project's pinned story section is currently scrubbing, if any. */
  activeProject: 'none' as 'none' | 'surge' | 'laffy',
  /** 0-1 local progress through the active project's pinned section. */
  projectProgress: 0,
}

export function updateScrollState(rawProgress: number, damping = 0.07) {
  scrollState.progress = rawProgress
  scrollState.smoothProgress += (rawProgress - scrollState.smoothProgress) * damping
  scrollState.palette = samplePalette(scrollState.smoothProgress) as SampledPalette
  scrollState.isFlooded = scrollState.smoothProgress > 0.88
  return scrollState
}
