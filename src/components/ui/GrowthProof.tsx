import { useEffect, useRef } from 'react'
import { scrollState } from '../../lib/scrollState'
import { clamp01, LABEL_T } from '../../lib/growthChart'

/**
 * A tall pinned track (like StoryBeats) whose only job is to write local
 * scroll progress into scrollState so the two 3D curves in BackgroundScene
 * can draw themselves as the visitor scrolls through. The "Slope over
 * intercept." label fades in after the rising curve has visibly overtaken
 * the exponential line.
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
          const opacity = clamp01((scrollState.proofProgress - LABEL_T) / 0.12)
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
        <p
          ref={labelRef}
          className="proof-label max-w-4xl font-serif text-[clamp(2.25rem,4.5vw,4rem)] leading-[0.98] text-paper"
          style={{ opacity: 0 }}
        >
          Slope over intercept.
        </p>
      </div>
    </section>
  )
}
