import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { scrollState } from '../../lib/scrollState'
import type { StorySequence } from '../../data/projects'

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)

/** The about chapter colors with the site's accent; projects use their own token. */
function beatColorVar(key: StorySequence['key']) {
  return key === 'about' ? 'var(--color-amber)' : `var(--color-${key})`
}

/**
 * A tall (beats.length * 100vh) scroll track with a pinned viewport-height
 * panel inside it. As the visitor scrolls through the track, local progress
 * (0-1) drives which beat word is on screen and is written into the shared
 * scrollState singleton so the 3D scene can react to "which chapter is
 * currently being told" without any prop-drilling or re-renders here.
 * Powers the project intros and the personal About chapter alike.
 */
export default function StoryBeats({ story }: { story: StorySequence }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const beatIndexRef = useRef(0)
  const [beatIndex, setBeatIndex] = useState(0)
  const storyKey = story.key

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = wrapRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const total = rect.height - window.innerHeight
        const raw = total > 0 ? -rect.top / total : 0
        if (raw >= 0 && raw <= 1) {
          const p = clamp01(raw)
          scrollState.activeProject = storyKey
          scrollState.projectProgress = p
          const idx = Math.min(story.beats.length - 1, Math.floor(p * story.beats.length))
          if (idx !== beatIndexRef.current) {
            beatIndexRef.current = idx
            setBeatIndex(idx)
          }
        } else if (scrollState.activeProject === storyKey) {
          scrollState.activeProject = 'none'
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [story.beats.length, storyKey])

  return (
    <div ref={wrapRef} style={{ height: `${story.beats.length * 100}vh` }} className="relative">
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden px-4 text-center">
        <p className="text-sm tracking-[0.3em] uppercase text-muted">{story.meta}</p>
        <AnimatePresence mode="wait">
          <motion.h2
            key={beatIndex}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -32 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 font-serif text-6xl italic tracking-tight sm:text-8xl md:text-9xl"
            style={{ color: beatColorVar(storyKey) }}
          >
            {story.beats[beatIndex]}
          </motion.h2>
        </AnimatePresence>
        <div className="mt-10 flex gap-2" aria-hidden="true">
          {story.beats.map((_, i) => (
            <span
              key={i}
              className="h-1 w-8 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: i === beatIndex ? beatColorVar(storyKey) : 'var(--color-line)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
