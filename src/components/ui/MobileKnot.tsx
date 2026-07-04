/**
 * Line-art stand-in for the 3D knot on viewports where WebGL doesn't mount.
 * Purely decorative SVG — the color-transition still applies via the
 * `--color-amber` CSS var, so mobile still gets the black-to-rose journey.
 */
export default function MobileKnot() {
  return (
    <div className="mobile-knot-wrap" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path
          className="mobile-knot-path"
          d="M100 30
             C 140 30, 170 60, 170 100
             C 170 140, 140 170, 100 170
             C 60 170, 30 140, 30 100
             C 30 70, 50 45, 80 38
             C 95 34, 108 40, 112 55
             C 116 70, 105 82, 90 80
             C 78 78, 72 66, 80 58"
        />
      </svg>
    </div>
  )
}
