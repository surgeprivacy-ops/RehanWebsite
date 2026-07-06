/**
 * Line-art stand-in for the 3D slope on viewports where WebGL doesn't mount
 * (context failure or reduced motion). Purely decorative SVG — the
 * color-transition still applies via the `--color-amber` CSS var, so the
 * fallback still gets the black-to-rose journey. Mirrors the scene's
 * "slope over intercept" curve: shallow start, steepening climb.
 */
export default function MobileKnot() {
  return (
    <div className="mobile-knot-wrap" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path
          className="mobile-knot-path"
          d="M20 170
             C 70 165, 110 150, 140 110
             C 160 83, 172 55, 180 30"
        />
        <circle className="mobile-knot-tip" cx="180" cy="30" r="5" />
      </svg>
    </div>
  )
}
