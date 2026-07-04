import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMediaQuery } from '../../lib/useMediaQuery'

const SESSION_KEY = 'rehan-preloader-seen'

/**
 * A brief, skippable, monochrome preloader — the "unexposed film" before the
 * site starts developing color. Shown once per browser session.
 */
export default function Preloader() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(SESSION_KEY) !== '1'
  })
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    if (!visible) return
    if (reduced) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setVisible(false)
      return
    }

    let raf = 0
    const start = performance.now()
    const minDwell = 1400
    const hardCap = 2200

    const tick = (now: number) => {
      const elapsed = now - start
      const fontsDone = document.fonts?.status === 'loaded'
      const t = Math.min(elapsed / minDwell, 1)
      setPercent(Math.round(t * 100))
      if ((t >= 1 && fontsDone) || elapsed >= hardCap) {
        sessionStorage.setItem(SESSION_KEY, '1')
        setVisible(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const skip = (e: KeyboardEvent | MouseEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Escape') return
      sessionStorage.setItem(SESSION_KEY, '1')
      setVisible(false)
    }
    window.addEventListener('keydown', skip)
    window.addEventListener('click', skip)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('click', skip)
    }
  }, [visible, reduced])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="preloader"
          initial={{ clipPath: 'inset(0 0 0 0)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)' }}
          transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="preloader-mark">
            <motion.span
              initial={{ y: '110%' }}
              animate={{ y: '0%' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              Rehan
            </motion.span>
          </div>
          <div className="preloader-rule">
            <motion.div
              className="h-full bg-current"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: percent / 100 }}
              transition={{ ease: 'linear', duration: 0.1 }}
              style={{ transformOrigin: 'left' }}
            />
          </div>
          <p className="preloader-count">{String(percent).padStart(2, '0')}%</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
