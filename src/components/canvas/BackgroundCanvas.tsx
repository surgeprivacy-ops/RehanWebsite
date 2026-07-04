import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useMediaQuery } from '../../lib/useMediaQuery'
import MobileKnot from '../ui/MobileKnot'

const BackgroundScene = lazy(() => import('./BackgroundScene'))

/** Falls back to the flat SVG knot if the WebGL context fails, so the page still has *something* alive. */
class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <MobileKnot /> : this.props.children
  }
}

/**
 * Loads the traveling 3D scene once motion is allowed and the browser is idle,
 * so first paint stays text-only. Runs on every viewport now — `lite` tells
 * BackgroundScene to drop the heavier layers (debris field, companion shape)
 * and cap pixel ratio on phones/tablets, where the point is presence, not spectacle.
 */
export default function BackgroundCanvas() {
  const lite = !useMediaQuery('(min-width: 768px)')
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (reduced) return
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(() => setReady(true), { timeout: 1200 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(() => setReady(true), 300)
    return () => clearTimeout(t)
  }, [reduced])

  if (reduced) return <MobileKnot />
  if (!ready) return null

  return (
    <GLBoundary>
      <Suspense fallback={null}>
        <BackgroundScene lite={lite} />
      </Suspense>
    </GLBoundary>
  )
}
