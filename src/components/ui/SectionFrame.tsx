import { useEffect, useRef } from 'react'
import { scrollState } from '../../lib/scrollState'
import { useMediaQuery } from '../../lib/useMediaQuery'

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)

type Key = 'none' | 'surge' | 'laffy' | 'finale'

/**
 * A thin line that draws itself around the edge of the screen, once, right
 * as you cross into a new project's story (or the finale) — a punctuation
 * mark at transitions rather than a constant on-screen element. Tracks
 * scrollState.activeProject/isFlooded (already written by ProjectStory and
 * ColorDirector) instead of computing its own scroll math.
 */
export default function SectionFrame() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const rectRef = useRef<SVGRectElement>(null)
  const totalRef = useRef(0)
  const lastKey = useRef<Key>('none')
  const startTime = useRef(0)

  useEffect(() => {
    if (reduced) return
    const rect = rectRef.current
    if (!rect) return

    const measure = () => {
      const inset = 2
      rect.setAttribute('x', String(inset))
      rect.setAttribute('y', String(inset))
      rect.setAttribute('width', String(Math.max(0, window.innerWidth - inset * 2)))
      rect.setAttribute('height', String(Math.max(0, window.innerHeight - inset * 2)))
      totalRef.current = rect.getTotalLength()
    }
    measure()
    window.addEventListener('resize', measure)

    let raf = 0
    const tick = (t: number) => {
      const key: Key = scrollState.isFlooded ? 'finale' : (scrollState.activeProject as Key)
      if (key !== lastKey.current) {
        lastKey.current = key
        startTime.current = t
      }

      if (key === 'none') {
        rect.style.opacity = '0'
      } else {
        const elapsed = (t - startTime.current) / 1000
        const drawIn = clamp01(elapsed / 0.5)
        const fadeOut = 1 - clamp01((elapsed - 0.75) / 0.65)
        const opacity = Math.max(0, Math.min(drawIn, fadeOut)) * 0.8
        const total = totalRef.current
        rect.style.strokeDasharray = `${total}`
        rect.style.strokeDashoffset = `${total * (1 - drawIn)}`
        rect.style.opacity = `${opacity}`
        const { surge, laffy, accent } = scrollState.palette
        rect.style.stroke = key === 'surge' ? surge : key === 'laffy' ? laffy : accent
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [reduced])

  if (reduced) return null

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[25]"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <rect ref={rectRef} fill="none" strokeWidth="2.5" style={{ opacity: 0 }} />
    </svg>
  )
}
