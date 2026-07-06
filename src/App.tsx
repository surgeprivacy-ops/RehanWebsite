import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { ABOUT_STORY, CASE_STUDIES, storyOf } from './data/projects'
import { SOCIALS } from './data/socials'
import { useReveal } from './lib/useReveal'
import Cursor from './components/ui/Cursor'
import Magnetic from './components/ui/Magnetic'
import ScrollProgress from './components/ui/ScrollProgress'
import SideRail from './components/ui/SideRail'
import ScrollHint from './components/ui/ScrollHint'
import Preloader from './components/ui/Preloader'
import StoryBeats from './components/ui/StoryBeats'
import SectionFrame from './components/ui/SectionFrame'
import ColorDirector from './components/ColorDirector'
import BackgroundCanvas from './components/canvas/BackgroundCanvas'

function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-4 px-4 py-4 bg-ink/80 backdrop-blur-md border-b border-line sm:px-6 md:px-12 md:py-5">
      <a href="#top" className="inline-block shrink-0 font-serif text-xl tracking-tight transition-transform duration-300 hover:scale-105">
        Rehan
      </a>
      <div className="flex min-w-0 items-center gap-3 text-sm text-muted sm:gap-8">
        <a href="#about" className="hidden sm:inline-block transition-all duration-300 hover:scale-110 hover:text-paper">About</a>
        <a href="#work" className="hidden sm:inline-block transition-all duration-300 hover:scale-110 hover:text-paper">Work</a>
        <Magnetic strength={0.4} className="inline-block">
          <a
            href="#contact"
            className="inline-block whitespace-nowrap border border-paper/30 px-3 py-2 text-paper transition-colors hover:bg-paper hover:text-ink sm:px-4"
          >
            Get in touch
          </a>
        </Magnetic>
      </div>
      <ScrollProgress />
    </nav>
  )
}

function Hero() {
  return (
    <header
      id="top"
      data-act="hero"
      data-act-progress="0"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pt-24 sm:px-6 md:px-12"
    >
      <div className="mega-type-layer" aria-hidden="true">
        <span className="mega-type" style={{ top: '8%', left: '38%' }}>
          PORTFOLIO
        </span>
      </div>
      <p className="reveal relative z-[2] mb-8 text-sm tracking-[0.2em] uppercase text-muted sm:tracking-[0.25em]">
        Engineer — AI-native products
      </p>
      <h1 className="reveal relative z-[2] max-w-6xl font-serif text-[18vw] leading-[0.95] tracking-tight sm:text-[13vw] md:text-[8.5vw]">
        Software that ships
        <br />
        <span className="italic text-amber">and survives.</span>
      </h1>
      <p className="reveal relative z-[2] mt-8 max-w-xl font-serif text-xl italic leading-relaxed text-muted sm:mt-10 sm:text-2xl">
        Slope over intercept.
      </p>
      <a href="#work" className="reveal relative z-[2] mt-16 inline-flex items-center gap-3 text-sm text-muted transition-colors hover:text-paper sm:mt-20">
        <ArrowDown size={16} className="animate-bounce" />
        <span className="tracking-[0.2em] uppercase">Selected work</span>
      </a>
      <ScrollHint />
    </header>
  )
}

function About() {
  return (
    <>
      {/* Rehan's own pinned chapter — the working loop, told like the projects' intros. */}
      <StoryBeats story={ABOUT_STORY} />
      <section
        id="about"
        data-act="about"
        data-act-progress="0.2"
        className="reveal border-t border-line px-4 py-20 sm:px-6 md:px-12 md:py-32"
      >
        <p className="text-sm tracking-[0.2em] uppercase text-muted sm:tracking-[0.25em]">About</p>
        <h2 className="mt-4 max-w-4xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl md:text-6xl">
          I design, build, and ship products <span className="italic text-amber">solo</span> — front end, back end, and everything in between.
        </h2>
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          I&rsquo;m an engineer who cares more about what survives contact with real users than what looks good in a demo. Surge and Laffy were both taken from a blank page to production by me — product decisions, infrastructure, and the unglamorous parts in between. I&rsquo;m happiest shipping something small, watching how it&rsquo;s actually used, and iterating from there.
        </p>
      </section>
    </>
  )
}

function Work() {
  return (
    <section id="work" data-act="work" data-act-progress="0.45" className="border-t border-line">
      {CASE_STUDIES.map((p) => (
        <div key={p.name}>
          <StoryBeats story={storyOf(p)} />
          <article
            className={`work-card accent-${p.accent} reveal grid gap-8 border-b border-line px-4 py-16 sm:px-6 sm:py-20 md:grid-cols-12 md:gap-10 md:px-12 md:py-32`}
          >
            <div className="md:col-span-2 text-sm text-muted tracking-[0.2em]">
              {p.index} / {p.year}
            </div>
            <div className="md:col-span-6">
              <h2 className="font-serif text-5xl tracking-tight sm:text-6xl md:text-7xl">{p.name}</h2>
              <p className="mt-3 font-serif text-2xl italic text-amber">{p.tagline}</p>
              <p className="mt-6 max-w-prose text-base leading-relaxed text-muted sm:mt-8 sm:text-lg">{p.description}</p>
            </div>
            <div className="md:col-span-4 flex flex-col justify-end gap-10">
              <Magnetic strength={0.3} className="self-start">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  data-cursor-label="Visit"
                  className="group inline-flex items-center gap-2 border border-paper/30 px-6 py-3 text-sm transition-colors hover:bg-paper hover:text-ink"
                >
                  {p.linkLabel}
                  <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </Magnetic>
            </div>
          </article>
        </div>
      ))}
    </section>
  )
}

function Footer() {
  return (
    <footer id="contact" data-act="finale" data-act-progress="1" className="act-finale border-t border-line">
      <div className="act-finale-bloom" aria-hidden="true" />
      <div className="act-finale-inner px-4 py-20 sm:px-6 md:px-12 md:py-24">
        <p className="reveal text-sm tracking-[0.2em] uppercase text-muted">Contact</p>
        <h2 className="reveal mt-4 font-serif text-5xl tracking-tight sm:text-6xl md:text-8xl">
          Let&rsquo;s talk<span className="italic text-amber">.</span>
        </h2>
        <Magnetic strength={0.25} className="inline-block">
          <a
            href="mailto:irehan29@icloud.com"
            className="reveal group mt-12 inline-flex items-center gap-2 break-all border-b border-paper/40 pb-1 text-lg transition-colors hover:border-amber hover:text-amber sm:text-xl"
          >
            irehan29@icloud.com
            <ArrowUpRight size={20} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </Magnetic>
        <div className="reveal mt-16 grid grid-cols-1 border-t border-l border-line sm:grid-cols-2 md:grid-cols-4">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="group border-b border-r border-line p-6 transition-transform duration-300 hover:scale-[1.03] hover:bg-paper/5"
            >
              <p className="text-xs tracking-[0.25em] uppercase text-muted transition-colors group-hover:text-amber">
                {s.label}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm">
                {s.handle}
                <ArrowUpRight size={14} className="text-muted transition-transform duration-300 group-hover:rotate-45 group-hover:text-paper" />
              </p>
            </a>
          ))}
        </div>
        <p className="reveal mt-12 text-sm text-muted">© 2026 Rehan. Developed in full color.</p>
      </div>
    </footer>
  )
}

export default function App() {
  useReveal()
  return (
    <div className="relative bg-ink text-paper">
      <Preloader />
      <ColorDirector />
      <Cursor />
      <SideRail />
      {/* traveling 3D world — fixed between the mega-type layer and content, all viewports */}
      <div className="canvas-layer">
        <BackgroundCanvas />
      </div>
      <SectionFrame />
      <div className="content-layer">
        <Nav />
        <Hero />
        <About />
        <Work />
        <Footer />
      </div>
    </div>
  )
}
