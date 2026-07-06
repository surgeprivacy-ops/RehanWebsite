import { useEffect, useRef } from 'react'
import { scrollState } from '../../lib/scrollState'
import { clamp01, CROSS_T } from '../../lib/growthChart'

/**
 * A tall pinned track (like StoryBeats) whose only job is to write local
 * scroll progress into scrollState so the two 3D curves in BackgroundScene
 * can draw themselves as the visitor scrolls through. The "Slope over
 * intercept." label fades in the instant that progress passes CROSS_T —
 * the same threshold the 3D crossover marker uses — so the label appears
 * exactly as x^1.01 overtakes the flat line.
 */
export default function GrowthProof() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = wrapRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const total = rect.height - window.innerHeight
        const raw = total > 0 ? -rect.top / total : 0
        scrollState.proofProgress = clamp01(raw)
        scrollState.proofActive = raw > -0.2 && raw < 1.2
        if (labelRef.current) {
          const opacity = clamp01((scrollState.proofProgress - CROSS_T) / 0.1)
          labelRef.current.style.opacity = String(opacity)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section
      id="proof"
      data-act="proof"
      data-act-progress="0.1"
      ref={wrapRef}
      className="relative border-t border-line"
      style={{ height: '220vh' }}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center px-4 text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-muted sm:tracking-[0.25em]">The bet</p>
        <p
          ref={labelRef}
          className="mt-6 max-w-xl font-serif text-3xl italic leading-relaxed text-amber sm:text-4xl md:text-5xl"
          style={{ opacity: 0 }}
        >
          Slope over intercept.
        </p>
      </div>
    </section>
  )
}
