/**
 * Shared math for the "slope over intercept" proof section: a lower-intercept,
 * faster exponential racing a higher-intercept, slower exponential. Both the
 * DOM scroll-tracker and the 3D curves import these so the crossover point
 * can't drift out of sync between them.
 */
export const X_DOMAIN = 6
export const FAST_INTERCEPT = 0.38
export const FAST_BASE = 1.55
export const SLOW_INTERCEPT = 1
export const SLOW_BASE = 1.12

export function fastExponential(x: number) {
  return FAST_INTERCEPT * Math.pow(FAST_BASE, x)
}

export function slowExponential(x: number) {
  return SLOW_INTERCEPT * Math.pow(SLOW_BASE, x)
}

function findCrossT() {
  let lo = 0
  let hi = X_DOMAIN
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2
    if (fastExponential(mid) > slowExponential(mid)) hi = mid
    else lo = mid
  }
  return ((lo + hi) / 2) / X_DOMAIN
}

/** Local progress (0-1) where the lower-intercept exponential overtakes the higher-intercept one. */
export const CROSS_T = findCrossT()

/** The phrase arrives after the lower curve has visibly overtaken the higher-intercept line. */
export const LABEL_T = CROSS_T + 0.08

export const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)
