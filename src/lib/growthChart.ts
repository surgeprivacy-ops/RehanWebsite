/**
 * Shared math for the "slope over intercept" proof section: x^1.01 (starts at
 * 0, compounds) racing 1.1^x (starts at 1, grows exponentially). Both the DOM
 * scroll-tracker (GrowthProof) and the 3D curves (BackgroundScene) import
 * these so the crossover point can't drift out of sync between them.
 */
export const X_DOMAIN = 6
export const POWER_EXPONENT = 1.01
export const EXP_BASE = 1.1

function findCrossT() {
  let lo = 1
  let hi = X_DOMAIN
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2
    const power = Math.pow(mid, POWER_EXPONENT)
    const exponential = Math.pow(EXP_BASE, mid)
    if (power > exponential) hi = mid
    else lo = mid
  }
  return ((lo + hi) / 2) / X_DOMAIN
}

/** Local progress (0-1) where x^1.01 overtakes 1.1^x on this chart domain. */
export const CROSS_T = findCrossT()

/** The phrase arrives after the lower curve has visibly overtaken the exponential line. */
export const LABEL_T = CROSS_T + 0.08

export const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)
