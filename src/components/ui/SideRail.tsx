import { motion, useScroll, useSpring } from 'framer-motion'

/** Vertical wordmark + scroll-progress track fixed to the left edge (desktop only). */
export default function SideRail() {
  const { scrollYProgress } = useScroll()
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })

  return (
    <div className="side-rail" aria-hidden="true">
      <div className="side-rail-track">
        <motion.div className="side-rail-fill" style={{ scaleY }} />
      </div>
      <span className="side-rail-text">REHAN — PORTFOLIO — 2026</span>
    </div>
  )
}
