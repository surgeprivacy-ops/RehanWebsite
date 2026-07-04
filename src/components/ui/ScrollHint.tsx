import { useEffect, useState } from 'react'

/** "Scroll to start" affordance that fades out after the visitor's first scroll. */
export default function ScrollHint() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 40) setDismissed(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="scroll-hint" style={{ opacity: dismissed ? 0 : 1 }} aria-hidden="true">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em]">Scroll to start</span>
      <div className="scroll-hint-line" />
    </div>
  )
}
