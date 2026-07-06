/** A pinned scroll chapter: beats shown one at a time while the section is stuck. */
export interface StorySequence {
  key: 'surge' | 'laffy'
  /** Small label above the beat, e.g. "01 / 2026 — Surge". */
  meta: string
  beats: string[]
}

export interface CaseStudy {
  index: string
  name: string
  tagline: string
  description: string
  stack: string[]
  url: string
  linkLabel: string
  year: string
  accent: 'surge' | 'laffy'
  /** The story beats scrubbed through while this project's intro is pinned. */
  beats: string[]
}

export function storyOf(p: CaseStudy): StorySequence {
  return { key: p.accent, meta: `${p.index} / ${p.year} — ${p.name}`, beats: p.beats }
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    index: '01',
    name: 'Surge',
    tagline: 'Test. Review. Post.',
    description:
      'An AI-assisted video review platform for short-form videos, like Instagram Reels or TikToks. Creators upload a video before posting and get a comprehensive breakdown of how it might perform — plus clear feedback on exactly what they can do to post a stronger video.',
    stack: ['FastAPI', 'React', 'Neon Postgres', 'Gemini', 'Stripe'],
    url: 'https://surge-chi-khaki.vercel.app',
    linkLabel: 'Visit Surge',
    year: '2026',
    accent: 'surge',
    beats: ['Test.', 'Review.', 'Post.'],
  },
  {
    index: '02',
    name: 'Laffy',
    tagline: 'Scan. Personalize. Unbox.',
    description:
      'An AI skincare website that creates a personalized routine box from a skin scan and a short questionnaire. I am currently working on the licenses needed to actually sell these products in packages.',
    stack: ['React', 'Vite', 'AI Skin Scan', 'Routine Builder', 'Vercel'],
    url: 'https://laffyfinal.vercel.app/',
    linkLabel: 'Visit Laffy',
    year: '2026',
    accent: 'laffy',
    beats: ['Scan.', 'Personalize.', 'Unbox.'],
  },
]
