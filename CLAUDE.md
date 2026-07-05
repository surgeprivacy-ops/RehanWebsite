# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc -b`) then production build
- `npx tsc --noEmit -p tsconfig.app.json` — type-check only, faster than a full build
- `npm run lint` — oxlint (config in `.oxlintrc.json`)
- `npm run preview` — serve the production build locally

No test runner is configured in this repo.

## What this is

A single-page portfolio site (React 19 + TypeScript + Vite + Tailwind v4) built as one continuous scroll narrative: Hero → About → Work (case studies) → Contact footer, all composed in `src/App.tsx`. The whole site is one big scrollytelling piece — a 3D scene, color grading, and pinned per-project story beats are all driven off scroll position rather than being static sections.

## The z-index sandwich

`App.tsx` layers four things (see the `.mega-type-layer` / `.canvas-layer` / `SectionFrame` / `.content-layer` comment block in `index.css`):
1. `.mega-type-layer` (z0) — giant faint decorative background type
2. `.canvas-layer` (z20) — the fixed, full-viewport 3D scene
3. `SectionFrame` (z25) — a screen-space SVG overlay
4. `.content-layer` (z30) — the actual DOM content

## Scroll-driven color: `palette.ts` + `ColorDirector.tsx`

`src/lib/palette.ts` samples an OKLCH-interpolated palette (`ink`/`paper`/`muted`/`accent`/`surge`/`laffy` tokens) keyed by 0-1 page scroll progress: the site starts fully desaturated black-and-white and gains hue/chroma toward a rose "flood" by the bottom of the page. `surge` and `laffy` are separate hue tracks (teal vs. rose) so each case study gets its own color identity.

`ColorDirector.tsx` runs a single rAF loop, samples the palette every frame, and writes it onto `:root` as CSS custom properties (`--color-ink`, `--color-amber`, `--color-surge`, `--color-laffy`, etc.). Every Tailwind utility (`bg-ink`, `text-amber`, ...) resolves through these vars already, so components never need to know about scroll — they just use normal utility classes. Under `prefers-reduced-motion: reduce`, it switches to discrete per-section updates via `IntersectionObserver` instead of continuous interpolation.

## `scrollState.ts` — the shared per-frame state

`src/lib/scrollState.ts` exports a plain mutable singleton object, deliberately **not** React state, because it's written and read ~60 times a second (by `ColorDirector`, the 3D scene, and `ProjectStory`). Putting this in `useState`/context would mean a React re-render per frame. Holds: `progress`/`smoothProgress`, `isFlooded`, `palette`, `activeProject` (`'none' | 'surge' | 'laffy'`), `projectProgress`. Any new scroll-reactive feature should read/write this singleton rather than inventing a parallel scroll tracker.

## The 3D scene (`components/canvas/`)

- `BackgroundCanvas.tsx` — gates when/how the scene loads: waits for `requestIdleCallback` so first paint stays text-only, skips entirely under `prefers-reduced-motion`, and falls back to `MobileKnot` (a static SVG) if WebGL fails to initialize. Passes a `lite` flag when the viewport is under 768px, which `BackgroundScene` uses to cut geometry detail, cap `dpr`, and drop the `Companion`/`DebrisCorridor` layers — the goal is real 3D everywhere, just cheaper on phones/tablets, not a different fallback experience.
- `BackgroundScene.tsx` — the actual scene. The central shape is a circle (`CirclePath`) that morphs into a straight line as the page scrolls, per a `WAYPOINTS` array mapping scroll progress → `{x, y, scale, opacity, morph}`. It reacts to `scrollState.activeProject`: blending its material color toward that project's palette color and changing spin speed, so entering Surge vs. Laffy visibly shifts the whole 3D world. Also renders `DebrisCorridor` (instanced low-poly debris), `FinaleBloom` (particle burst near the page bottom), and `LaffyBloom` (particle burst specifically while Laffy's story is active).

## Pinned scrollytelling (`ProjectStory.tsx`)

Each case study's intro is a tall (`beats.length * 100vh`) wrapper with a `position: sticky` inner panel. `ProjectStory` computes **local** scroll progress via `getBoundingClientRect` (not global page scroll), drives which "beat" word from `CaseStudy.beats` is shown (crossfaded with Framer Motion), and writes `scrollState.activeProject`/`projectProgress` — this is how the 3D scene and `SectionFrame` know a project's story is currently pinned, without any prop drilling.

`SectionFrame.tsx` is the complementary piece: a screen-space SVG line that draws itself around the viewport edge once, triggered purely by *changes* to `scrollState.activeProject`/`isFlooded` (no independent scroll math of its own) — a one-shot transition wipe, not a persistent element.

## Content as data

`src/data/projects.ts` defines each `CaseStudy` with `beats` (the story words scrubbed through in `ProjectStory`) and `accent: 'surge' | 'laffy'` (ties the card's hover-wash color and the 3D scene's color target to the same palette token). `src/data/socials.ts` is the footer link list. Adding a new case study means adding an entry here plus a new `surge`/`laffy`-style token in `palette.ts`'s `TokenName` if it needs its own color identity.

## Reveal-on-scroll vs. pinned story — two different systems

Most static content (paragraphs, footer blocks) uses the simple `.reveal` / `.is-visible` fade-up pattern, toggled once via `useReveal()`'s `IntersectionObserver` (`src/lib/useReveal.ts`). This is unrelated to `ProjectStory`'s pinned-scroll mechanic — don't conflate the two when adding new sections. Use `.reveal` for a one-time fade-in; use the `ProjectStory` pattern only for content that should scrub through multiple states as you scroll.

## Motion conventions

- Every animated component gates on `useMediaQuery('(prefers-reduced-motion: reduce)')` (`src/lib/useMediaQuery.ts`) and either renders a static equivalent or skips animation.
- rAF-driven effects (`Cursor`, `ColorDirector`, the 3D scene, `ProjectStory`, `SectionFrame`) mutate refs/DOM/CSS vars directly inside the loop rather than calling `setState` every frame; React state is only touched for discrete changes (e.g. a beat index changing).
- `Magnetic.tsx` (cursor-attraction wrapper) and the custom `Cursor.tsx` are both fine-pointer/desktop-only (`(hover: hover) and (pointer: fine)`).

## Build gotcha

`vite.config.ts` dedupes `react`/`react-dom` and pre-bundles `@react-three/fiber`, `@react-three/drei`, and `three` in `optimizeDeps`. This is required so `@react-three/fiber`'s renderer shares the same React instance as the rest of the app — removing it reintroduces an "Invalid hook call" error from a duplicate pre-bundled React copy.
