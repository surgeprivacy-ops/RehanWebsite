import { useEffect, useRef } from 'react'
import { useMediaQuery } from '../../lib/useMediaQuery'

/**
 * Custom cursor: an amber dot tracking 1:1 and a ring that trails with spring lag.
 * Runs a single rAF loop and mutates transforms directly — no per-frame React renders.
 * Only mounts on fine-pointer devices with motion allowed.
 */
export default function Cursor() {
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!finePointer || reduced) return
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    document.documentElement.classList.add('cursor-none')

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let ringX = mouseX
    let ringY = mouseY
    let raf = 0

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`
    }

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const labeled = target.closest<HTMLElement>('[data-cursor-label]')
      const interactive = target.closest('a, button, [data-cursor="hover"]')
      ring.classList.toggle('is-hover', !!interactive && !labeled)
      ring.classList.toggle('has-label', !!labeled)
      if (labelRef.current) labelRef.current.textContent = labeled?.dataset.cursorLabel ?? ''
    }

    const onLeave = () => {
      dot.style.opacity = '0'
      ring.style.opacity = '0'
    }
    const onEnter = () => {
      dot.style.opacity = '1'
      ring.style.opacity = '1'
    }

    const loop = () => {
      ringX += (mouseX - ringX) * 0.18
      ringY += (mouseY - ringY) * 0.18
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)
    raf = requestAnimationFrame(loop)

    return () => {
      document.documentElement.classList.remove('cursor-none')
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
      cancelAnimationFrame(raf)
    }
  }, [finePointer, reduced])

  if (!finePointer || reduced) return null

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden="true">
        <span ref={labelRef} className="cursor-ring-label" />
      </div>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  )
}
