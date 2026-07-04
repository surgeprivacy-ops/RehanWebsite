import { motion, useScroll, useSpring } from 'framer-motion'

/** Amber progress bar pinned to the bottom edge of the nav. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })

  return (
    <motion.div
      style={{ scaleX }}
      className="absolute bottom-0 left-0 h-px w-full origin-left bg-amber"
      aria-hidden="true"
    />
  )
}
