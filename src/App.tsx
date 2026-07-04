import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { CASE_STUDIES } from './data/projects'
import { SOCIALS } from './data/socials'
import { useReveal } from './lib/useReveal'
import Cursor from './components/ui/Cursor'
import Magnetic from './components/ui/Magnetic'
import ScrollProgress from './components/ui/ScrollProgress'
import BackgroundCanvas from './components/canvas/BackgroundCanvas'

function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-4 px-4 py-4 bg-ink/80 backdrop-blur-md border-b border-line sm:px-6 md:px-12 md:py-5">
      <a href="#top" className="inline-block shrink-0 font-serif text-xl tracking-tight transition-transform duration-300 hover:scale-105">
        Rehan
      </a>
      <div className="flex min-w-0 items-center gap-3 text-sm text-muted sm:gap-8">
        <a href="#work" className="hidden sm:inline-block transition-all duration-300 hover:scale-110 hover:text-paper">Work</a>
        <Magnetic strength={0.4} className="inline-block">
          <a
            href="mailto:irehan29@icloud.com"
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
    <header id="top" className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pt-24 sm:px-6 md:px-12">
      <p className="reveal mb-8 text-sm tracking-[0.2em] uppercase text-muted sm:tracking-[0.25em]">Engineer — AI-native products</p>
      <h1 className="reveal max-w-6xl font-serif text-[18vw] leading-[0.95] tracking-tight sm:text-[13vw] md:text-[8.5vw]">
        Software that ships
        <br />
        <span className="italic text-amber">and survives.</span>
      </h1>
      <p className="reveal mt-8 max-w-xl font-serif text-xl italic leading-relaxed text-muted sm:mt-10 sm:text-2xl">
        Slope over intercept.
      </p>
      <a href="#work" className="reveal mt-16 inline-flex items-center gap-3 text-sm text-muted transition-colors hover:text-paper sm:mt-20">
        <ArrowDown size={16} className="animate-bounce" />
        <span className="tracking-[0.2em] uppercase">Selected work</span>
      </a>
    </header>
  )
}

function Work() {
  return (
    <section id="work" className="border-t border-line">
      {CASE_STUDIES.map((p) => (
        <article
          key={p.name}
          className="reveal grid gap-8 border-b border-line px-4 py-16 sm:px-6 sm:py-20 md:grid-cols-12 md:gap-10 md:px-12 md:py-32"
        >
          <div className="md:col-span-2 text-sm text-muted tracking-[0.2em]">
            {p.index} / {p.year}
          </div>
          <div className="md:col-span-6">
            <h2 className="font-serif text-5xl tracking-tight sm:text-6xl md:text-7xl">{p.name}</h2>
            <p className="mt-3 font-serif text-2xl italic text-amber">{p.tagline}</p>
            <p className="mt-6 max-w-prose text-base leading-relaxed text-muted sm:mt-8 sm:text-lg">{p.description}</p>
          </div>
          <div className="md:col-span-4 flex flex-col justify-between gap-10">
            <ul className="flex flex-wrap gap-2">
              {p.stack.map((s) => (
                <li
                  key={s}
                  className="text-xs tracking-wide text-muted border border-line px-3 py-1.5"
                >
                  {s}
                </li>
              ))}
            </ul>
            <Magnetic strength={0.3} className="self-start">
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 border border-paper/30 px-6 py-3 text-sm transition-colors hover:bg-paper hover:text-ink"
              >
                {p.linkLabel}
                <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </Magnetic>
          </div>
        </article>
      ))}
    </section>
  )
}

function Footer() {
  return (
    <footer id="contact" className="border-t border-line px-4 py-20 sm:px-6 md:px-12 md:py-24">
      <h2 className="reveal font-serif text-5xl tracking-tight sm:text-6xl md:text-8xl">
        Let&rsquo;s build <span className="italic text-amber">something.</span>
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
      <p className="reveal mt-12 text-sm text-muted">© 2026 Rehan. Built and shipped by hand.</p>
    </footer>
  )
}

export default function App() {
  useReveal()
  return (
    <div className="relative bg-ink text-paper">
      <Cursor />
      {/* traveling 3D knot/line — fixed behind all content, desktop only */}
      <div className="pointer-events-none fixed inset-0 z-0 hidden lg:block">
        <BackgroundCanvas />
      </div>
      <div className="relative z-10">
        <Nav />
        <Hero />
        <Work />
        <Footer />
      </div>
    </div>
  )
}
