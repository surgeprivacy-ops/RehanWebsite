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
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    index: '01',
    name: 'Surge',
    tagline: 'Review. Test. Improve.',
    description:
      'An AI-assisted craft review platform for short-form video. Creators upload a cut before posting and get a retention-focused analysis — hook, pacing, text, tension, sync, ending — plus one editing hypothesis to test in the next version.',
    stack: ['FastAPI', 'React', 'Neon Postgres', 'Gemini', 'Stripe'],
    url: 'https://surge-chi-khaki.vercel.app',
    linkLabel: 'Visit Surge',
    year: '2026',
    accent: 'surge',
  },
  {
    index: '02',
    name: 'Laffy',
    tagline: 'Scan. Personalize. Unbox.',
    description:
      'A premium AI skincare flow that turns a consent-based skin scan and short questionnaire into a personalized routine box. The homepage frames the product as a four-chapter system: scan, goals, routine, and box.',
    stack: ['React', 'Vite', 'AI Skin Scan', 'Routine Builder', 'Vercel'],
    url: 'https://laffyfinal.vercel.app/',
    linkLabel: 'Visit Laffy',
    year: '2026',
    accent: 'laffy',
  },
]
