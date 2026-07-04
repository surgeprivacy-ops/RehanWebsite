export interface CaseStudy {
  index: string
  name: string
  tagline: string
  description: string
  stack: string[]
  url: string
  linkLabel: string
  year: string
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
  },
  {
    index: '02',
    name: 'Laffy',
    tagline: 'Placeholder tagline — describe Laffy here.',
    description:
      'Add a short paragraph describing what Laffy does, who it is for, and what problem it solves. Keep it to two or three sentences in the same tone as the Surge entry above.',
    stack: ['Stack', 'Goes', 'Here'],
    url: '#',
    linkLabel: 'Visit Laffy',
    year: '2026',
  },
]
