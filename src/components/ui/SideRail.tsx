import { motion, useScroll, useSpring } from 'framer-motion'

/** Small scroll-progress index fixed to the bottom-left corner (desktop only). */
export default function SideRail() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })

  return (
    <div className="side-rail" aria-hidden="true">
      <div className="side-rail-track">
        <motion.div className="side-rail-fill" style={{ scaleX, transformOrigin: 'left' }} />
      </div>
      <span className="side-rail-text">Rehan — 2026</span>
    </div>
  )
}
