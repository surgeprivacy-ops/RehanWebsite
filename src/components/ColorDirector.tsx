import { useEffect } from 'react'
import { updateScrollState } from '../lib/scrollState'

const VAR_MAP = {
  ink: '--color-ink',
  paper: '--color-paper',
  muted: '--color-muted',
  accent: '--color-amber',
  surge: '--color-surge',
  laffy: '--color-laffy',
} as const

/**
 * Single rAF loop that samples scroll progress into a palette and writes it
 * onto :root as CSS custom properties. Every existing Tailwind utility
 * (bg-ink, text-paper, border-line, etc.) already resolves through these
 * vars, so the whole site develops color with zero component changes.
 */
export default function ColorDirector() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = document.documentElement
    const last: Partial<Record<keyof typeof VAR_MAP, string>> = {}
    let raf = 0
    let flooded = false

    const applyStrings = (hexByToken: Record<keyof typeof VAR_MAP, string>) => {
      for (const key of Object.keys(VAR_MAP) as (keyof typeof VAR_MAP)[]) {
        const value = hexByToken[key]
        if (last[key] !== value) {
          root.style.setProperty(VAR_MAP[key], value)
          last[key] = value
        }
      }
    }

    if (reduced) {
      // Discrete, section-based updates instead of continuous animation.
      const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-act]'))
      const io = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
          if (!visible) return
          const at = Number(visible.target.getAttribute('data-act-progress') ?? '0')
          const state = updateScrollState(at, 1)
          applyStrings(state.palette)
          root.classList.toggle('is-flooded', state.isFlooded)
        },
        { threshold: [0.5] },
      )
      sections.forEach((el) => io.observe(el))
      return () => io.disconnect()
    }

    const tick = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const raw = max > 0 ? window.scrollY / max : 0
      const state = updateScrollState(raw)
      applyStrings(state.palette)
      if (state.isFlooded !== flooded) {
        flooded = state.isFlooded
        root.classList.toggle('is-flooded', flooded)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return null
}
