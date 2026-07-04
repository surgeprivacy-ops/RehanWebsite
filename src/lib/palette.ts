const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)
const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** OKLCH triple: [lightness 0-1, chroma 0-0.4ish, hue degrees]. */
type Oklch = [number, number, number]

export type TokenName = 'ink' | 'paper' | 'muted' | 'accent' | 'surge' | 'laffy'

type TokenSet = Record<TokenName, Oklch>

interface PaletteWaypoint {
  at: number
  tokens: TokenSet
}

/**
 * The negative-to-print journey: everything starts desaturated (chroma ~0)
 * and gains hue/chroma as scroll progresses, arriving at a rose "flood".
 */
const WAYPOINTS: PaletteWaypoint[] = [
  {
    at: 0,
    tokens: {
      ink: [0.08, 0, 0],
      paper: [0.965, 0, 0],
      muted: [0.6, 0, 0],
      accent: [0.965, 0, 0],
      surge: [0.68, 0, 0],
      laffy: [0.68, 0, 0],
    },
  },
  {
    at: 0.5,
    tokens: {
      ink: [0.12, 0.02, 350],
      paper: [0.96, 0.015, 350],
      muted: [0.6, 0.035, 350],
      accent: [0.68, 0.12, 350],
      surge: [0.72, 0.07, 175],
      laffy: [0.82, 0.08, 350],
    },
  },
  {
    at: 0.88,
    tokens: {
      ink: [0.14, 0.03, 350],
      paper: [0.97, 0.02, 350],
      muted: [0.66, 0.06, 345],
      accent: [0.66, 0.16, 350],
      surge: [0.76, 0.1, 172],
      laffy: [0.83, 0.09, 345],
    },
  },
]

function sampleTokenSet(p: number): TokenSet {
  if (p <= WAYPOINTS[0].at) return WAYPOINTS[0].tokens
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i]
    const b = WAYPOINTS[i + 1]
    if (p >= a.at && p <= b.at) {
      const e = smoothstep((b.at - a.at) > 0 ? (p - a.at) / (b.at - a.at) : 1)
      const out = {} as TokenSet
      for (const key of Object.keys(a.tokens) as TokenName[]) {
        const [al, ac, ah] = a.tokens[key]
        const [bl, bc, bh] = b.tokens[key]
        out[key] = [al + (bl - al) * e, ac + (bc - ac) * e, ah + (bh - ah) * e]
      }
      return out
    }
  }
  return WAYPOINTS[WAYPOINTS.length - 1].tokens
}

/** Rough OKLCH -> sRGB, precise enough for UI tinting (not color-managed print work). */
function oklchToRgb([l, c, h]: Oklch): [number, number, number] {
  const hRad = (h * Math.PI) / 180
  const a = Math.cos(hRad) * c
  const b = Math.sin(hRad) * c

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  const toSrgb = (v: number) => {
    const clamped = clamp01(v)
    return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
  }

  r = toSrgb(r)
  g = toSrgb(g)
  bl = toSrgb(bl)

  return [clamp01(r), clamp01(g), clamp01(bl)]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export interface SampledPalette {
  ink: string
  paper: string
  muted: string
  accent: string
  surge: string
  laffy: string
  inkRgb: [number, number, number]
  paperRgb: [number, number, number]
  accentRgb: [number, number, number]
  surgeRgb: [number, number, number]
  laffyRgb: [number, number, number]
  /** 0 at the negative, 1 at full development — drives non-color effects (grain, glow). */
  dev: number
}

export function samplePalette(p: number): SampledPalette {
  const progress = clamp01(p)
  const tokens = sampleTokenSet(progress)
  const inkRgb = oklchToRgb(tokens.ink)
  const paperRgb = oklchToRgb(tokens.paper)
  const mutedRgb = oklchToRgb(tokens.muted)
  const accentRgb = oklchToRgb(tokens.accent)
  const surgeRgb = oklchToRgb(tokens.surge)
  const laffyRgb = oklchToRgb(tokens.laffy)

  return {
    ink: rgbToHex(inkRgb),
    paper: rgbToHex(paperRgb),
    muted: rgbToHex(mutedRgb),
    accent: rgbToHex(accentRgb),
    surge: rgbToHex(surgeRgb),
    laffy: rgbToHex(laffyRgb),
    inkRgb,
    paperRgb,
    accentRgb,
    surgeRgb,
    laffyRgb,
    dev: clamp01(progress / 0.88),
  }
}
