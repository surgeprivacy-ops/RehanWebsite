import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useMediaQuery } from '../../lib/useMediaQuery'

const BackgroundScene = lazy(() => import('./BackgroundScene'))

/** Renders nothing if the WebGL context fails, so the page degrades cleanly. */
class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Loads the traveling 3D scene only when it can pay off: desktop viewport,
 * motion allowed, and after the browser is idle so first paint stays text-only.
 */
export default function BackgroundCanvas() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isDesktop || reduced) return
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(() => setReady(true), { timeout: 1200 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(() => setReady(true), 300)
    return () => clearTimeout(t)
  }, [isDesktop, reduced])

  if (!isDesktop || reduced || !ready) return null

  return (
    <GLBoundary>
      <Suspense fallback={null}>
        <BackgroundScene />
      </Suspense>
    </GLBoundary>
  )
}
