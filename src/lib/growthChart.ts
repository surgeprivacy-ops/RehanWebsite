/**
 * Shared math for the "slope over intercept" proof section: x^1.01 (starts at
 * 0, compounds) racing a flat 1^x (starts at 1, never moves). Both the DOM
 * scroll-tracker (GrowthProof) and the 3D curves (BackgroundScene) import
 * these so the crossover point can't drift out of sync between them.
 */
export const X_DOMAIN = 6
export const POWER_EXPONENT = 1.01

/** Local progress (0-1) at which the drawn curve reaches x=1 — where x^1.01 meets 1^x. */
export const CROSS_T = 1 / X_DOMAIN

export const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)
