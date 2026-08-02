# Implementation Plan: Portfolio Website

## Overview

This plan builds the Portfolio_Site incrementally: project scaffolding first, then the side-effect-free pure logic layer (fully covered by property-based tests for the 15 correctness properties), then the Zod-validated content layer, the `AnimationEngine` facade, the document shell and navigation, each hero/content section, responsive and asset-loading behavior, and finally cross-device integration/e2e coverage.

Each step builds on prior steps and ends by wiring new code into the composed page so there is no orphaned code. Implementation language is **TypeScript** (Astro 4 + React islands + Tailwind CSS), matching the approved design.

Property-based tests use **fast-check + Vitest** (minimum 100 iterations each, tagged `// Feature: portfolio-website, Property {n}: {text}`). Each of the 15 correctness properties is its own optional sub-task placed next to the code it validates.

## Tasks

- [x] 1. Set up project scaffolding and tooling
  - [x] 1.1 Initialize Astro 4 project with React islands, TypeScript, and Tailwind CSS
    - Create Astro project structure (`src/`, `src/lib/logic`, `src/lib/animation`, `src/content`, `src/components`, `src/pages`)
    - Add and configure `@astrojs/react`, TypeScript (strict), Tailwind with 360–2560px breakpoints and `motion-reduce:` variants
    - Add GSAP + ScrollTrigger and Zod as dependencies
    - _Requirements: 10.5_

  - [x] 1.2 Configure testing infrastructure
    - Set up Vitest with fast-check for property tests, @testing-library/react for component tests, and Playwright for integration/e2e
    - Add test scripts (single-run, non-watch) and a build-time content-validation hook stub
    - _Requirements: 8.1, 9.1_

- [x] 2. Implement pure logic: responsive image selection and cover-fit geometry
  - [x] 2.1 Implement `selectImageAsset(viewportWidth)`
    - Return `small` for width ≤480, `medium` for 481–1024, `large` for >1024 in `src/lib/logic/selectImageAsset.ts`
    - _Requirements: 10.2_

  - [x]* 2.2 Write property test for image tier selection
    - **Property 6: Image tier selection matches viewport width boundaries**
    - Generate arbitrary widths including boundaries 480/481/1024/1025
    - **Validates: Requirements 10.2**

  - [x] 2.3 Implement `computeCoverTransform(intrinsic, box, focal)`
    - Compute uniform cover-fit scale + offsets preserving the 3000:3878 aspect ratio, honoring the (center-x, top 25%) focal point in `src/lib/logic/computeCoverTransform.ts`
    - _Requirements: 1.2, 1.3_

  - [x]* 2.4 Write property test for cover-fit aspect ratio
    - **Property 1: Cover-fit preserves aspect ratio**
    - Generate arbitrary intrinsic sizes and boxes; assert rendered ratio equals intrinsic ratio (no skew)
    - **Validates: Requirements 1.2**

  - [x]* 2.5 Write property test for cover-fit coverage and focal visibility
    - **Property 2: Cover-fit fully covers the box with the focal point visible**
    - Generate arbitrary boxes; assert rendered dims ≥ box, non-positive offsets, focal point inside box
    - **Validates: Requirements 1.3**

- [x] 3. Implement pure logic: hotspot projection, motion resolution, fluid typography
  - [x] 3.1 Implement `mapHotspotToViewport(norm, intrinsic, box, focal)`
    - Project a normalized [0,1] hotspot coordinate into a pixel point inside the rendered image box in `src/lib/logic/mapHotspotToViewport.ts`
    - _Requirements: 2.1, 2.7_

  - [x]* 3.2 Write property test for hotspot projection bounds
    - **Property 3: Hotspots project inside the rendered image box**
    - Generate arbitrary normalized coords and boxes; assert returned point lies within the rendered box bounds
    - **Validates: Requirements 2.1, 2.7**

  - [x] 3.3 Implement `resolveMotion(spec, prefersReducedMotion)`
    - Collapse motion kinds to immediate (0ms) or fade (≤200ms) when reduced motion is set, in `src/lib/logic/resolveMotion.ts`
    - _Requirements: 1.5, 3.5, 4.7, 8.2_

  - [x]* 3.4 Write property test for reduced-motion collapse
    - **Property 4: Reduced motion collapses all motion animations**
    - Generate arbitrary `MotionSpec`; assert `resolveMotion(spec, true)` mode ≠ full, kind never translate/scale/rotate/parallax, duration 0 or ≤200ms
    - **Validates: Requirements 1.5, 3.5, 4.7, 8.2**

  - [x] 3.5 Implement fluid body typography function
    - Compute `clamp()`-based body font size across viewport widths in `src/lib/logic/fluidTypography.ts`
    - _Requirements: 9.2_

  - [x]* 3.6 Write property test for minimum fluid font size
    - **Property 7: Fluid body typography never drops below 14px**
    - Generate arbitrary widths in 360–2560; assert computed body font size ≥ 14px
    - **Validates: Requirements 9.2**

- [x] 4. Checkpoint - Ensure all pure-logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement content layer with Zod schemas and validated data modules
  - [x] 5.1 Implement HeroContent + Hotspots schemas and data module
    - Define schemas (name literal, tagline 1–160, intrinsic 3000×3878, focal, asset tiers, ≥2 hotspots incl. PC + soldering) and seed data in `src/content/hero.ts`
    - _Requirements: 1.2, 1.3, 1.7, 2.1_

  - [x]* 5.2 Write property test for hero tagline bounds
    - **Property 8: Hero content validation enforces tagline bounds**
    - Generate valid/mutated hero content; assert parse succeeds only for tagline length 1–160
    - **Validates: Requirements 1.7**

  - [x] 5.3 Implement NavTargets schema and data module
    - Define schema requiring exactly one target per section and seed the five nav targets in `src/content/navigation.ts`
    - _Requirements: 1.8_

  - [x]* 5.4 Write property test for navigation target coverage
    - **Property 9: Navigation targets bijectively cover the five sections**
    - Generate candidate arrays; assert parse succeeds iff exactly one target per section
    - **Validates: Requirements 1.8**

  - [x] 5.5 Implement Hobbies schema and data module
    - Define schema (exactly 3 entries, unique style+animation combos) and seed Homelabbing/PCB designing/3D modelling in `src/content/hobbies.ts`
    - _Requirements: 3.1, 3.2_

  - [x]* 5.6 Write property test for hobbies validation
    - **Property 10: Hobbies validation enforces exactly three distinct entries**
    - Generate candidate arrays; assert parse succeeds iff three entries with unique style+animation combinations
    - **Validates: Requirements 3.1, 3.2**

  - [x] 5.7 Implement Homelab + Services schemas and data module
    - Define homelab component schema and Services schema (exactly Jellyfin/Immich/Seafile/qBittorrent/WireGuard, purpose 1–280) and seed TrueNAS, mini-PC cluster, master/worker nodes content in `src/content/homelab.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x]* 5.8 Write property test for homelab services validation
    - **Property 11: Homelab services validation enforces the exact five services**
    - Generate candidate arrays; assert parse succeeds iff exactly the five named services (each once) with valid purpose
    - **Validates: Requirements 4.4**

  - [x] 5.9 Implement PcComponents schema and data module
    - Define schema (exactly 11 unique categories, non-empty values) and seed all 11 components with exact values in `src/content/pcSpecs.ts`
    - _Requirements: 5.1_

  - [x]* 5.10 Write property test for PC components validation
    - **Property 12: PC components validation enforces eleven unique components**
    - Generate candidate arrays; assert parse succeeds iff exactly 11 unique-category, non-empty-value entries
    - **Validates: Requirements 5.1**

  - [x] 5.11 Implement Resume schema and data module
    - Define schema (headline, ≥3 years, 3 employers with role+period, ≥4 achievements, 2 projects with 20–300 char descriptions, formal resume URL) and seed data in `src/content/resume.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [x]* 5.12 Write property test for resume validation
    - **Property 14: Resume employers and projects validation**
    - Generate candidate content; assert parse succeeds only with exactly 3 employers (role + start/end) and exactly 2 projects (20–300 char descriptions)
    - **Validates: Requirements 6.2, 6.4**

  - [x] 5.13 Implement Certifications schema and data module
    - Define schema (exactly the 3 named AWS certs, distinct, one image + non-empty alt each) and seed data in `src/content/certifications.ts`
    - _Requirements: 7.1, 7.2_

  - [x]* 5.14 Write property test for certifications validation
    - **Property 15: Certifications validation enforces three distinct certs each with one image**
    - Generate candidate arrays; assert parse succeeds iff exactly the three named certs, each distinct with one image and non-empty alt text
    - **Validates: Requirements 7.1, 7.2**

  - [x] 5.15 Wire build-time content validation
    - Parse every content module through its Zod schema during build so a violation fails the build
    - _Requirements: 3.1, 3.2, 4.4, 5.1, 6.2, 6.4, 7.1, 7.2_

- [x] 6. Checkpoint - Ensure content-layer tests and build validation pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the AnimationEngine facade
  - [x] 7.1 Implement `AnimationEngine` over GSAP + ScrollTrigger
    - Implement `heroEntrance`, `reveal`, `highlight`/`removeHighlight`, `transition` in `src/lib/animation/AnimationEngine.ts`
    - Centralize reduced-motion resolution via `resolveMotion` and the fallback-to-final-state contract (targets default to final visible CSS; entrance offset applied only after engine confirmed live; asset/animation failures caught and logged, never surfaced)
    - _Requirements: 1.4, 1.5, 2.2, 2.3, 3.3, 3.5, 4.5, 4.6, 4.7, 8.2, 8.3, 8.4, 8.5_

  - [x]* 7.2 Write property test for animation final-state guarantee
    - **Property 5: Animations always end in the fully visible final state**
    - Generate arbitrary targets/specs, force start/asset failure; assert target ends flagged fully visible with content and interactivity retained
    - **Validates: Requirements 3.6, 4.6, 8.4**

  - [x]* 7.3 Write unit tests for engine reduced-motion and timing bounds
    - Test reduced-motion collapse, once-per-load reveal, and start/complete timing wiring
    - _Requirements: 1.4, 1.5, 3.3, 8.2, 8.3, 8.5_

- [x] 8. Implement document shell and navigation
  - [x] 8.1 Implement `Layout.astro` and `index.astro` static shell
    - Document shell (fonts, meta, global CSS), section ordering, and above-the-fold static HTML (name, tagline, nav, hero placeholder)
    - _Requirements: 1.1, 10.5_

  - [x] 8.2 Implement Navigation island
    - Inline links at ≥768px, single toggle expand/collapse below 768px, one target per section, scroll-into-view within 1000ms; wire through AnimationEngine
    - _Requirements: 1.8, 1.9, 9.3, 9.4_

  - [x]* 8.3 Write unit tests for navigation behavior
    - Test toggle expand/collapse and per-section targets at breakpoint boundaries
    - _Requirements: 9.3, 9.4_

- [x] 9. Implement hero section
  - [x] 9.1 Implement `HeroImage.astro`
    - Responsive `<picture>` with srcset/sizes (small/medium/large), base64 LQIP placeholder held until decode, 5s load-failure fallback background, cover-fit via `computeCoverTransform`
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 10.1, 10.2, 10.4_

  - [x] 9.2 Implement `HotspotLayer` island
    - Render hotspots via `mapHotspotToViewport`; ≥44×44px `<button>`s with aria-labels; pointer/touch/keyboard activation and highlight; PC hotspot surfaces scroll-to-PC-specs control, soldering hotspot reveals PCB content; reveal-failure keeps hero interactive with "unavailable" indication
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 9.3 Compose `HeroSection` with `HeroIntro` and entrance wiring
    - Add name + tagline, compose HeroImage + HotspotLayer, wire `heroEntrance` (start <200ms, complete <2000ms, reduced-motion final state)
    - _Requirements: 1.4, 1.5, 1.7_

  - [x]* 9.4 Write unit tests for hero fallback and hotspot interactions
    - Test hero load-failure fallback, hotspot hover/leave/activate/keyboard, and reveal-failure handling
    - _Requirements: 1.6, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9_

- [x] 10. Implement hobbies section
  - [x] 10.1 Implement `HobbiesSection.astro`
    - Render 3 distinct hobby entries with per-entry style+animation; scroll-reveal once-per-load via AnimationEngine; Homelabbing entry navigates to Homelab within 2s; reduced-motion/fallback final state
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x]* 10.2 Write unit tests for hobbies reveal and navigation
    - Test once-only reveal, navigate-to-homelab, and reveal-failure final state
    - _Requirements: 3.3, 3.4, 3.6_

- [x] 11. Implement homelab section
  - [x] 11.1 Implement `HomelabSection.astro`
    - Render TrueNAS, mini-PC cluster + 8-port switch, i5 master/worker k3s+Proxmox nodes, and the five services with purposes; scroll-reveal within 200ms/complete 1000ms; reduced-motion/final-state handling
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x]* 11.2 Write unit tests for homelab content presence
    - Assert all required hardware and the five services with descriptions render
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 12. Implement PC specs showcase
  - [x] 12.1 Implement `PcSpecsShowcase` island
    - Render 11 keyboard/pointer/touch-activatable components; active state changes ≥1 visible attribute and shows detail (category + value); transition begins <200ms; deactivation restores state and hides detail; grid reflows without horizontal scroll at ≥360px
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x]* 12.2 Write property test for PC component detail rendering
    - **Property 13: PC component detail rendering includes category and value**
    - Generate valid `PcComponent`s; assert rendered active detail contains both category label and stated value
    - **Validates: Requirements 5.3**

  - [x]* 12.3 Write unit tests for PC component activation
    - Test active-state visual change, transition timing, and deactivation restore/hide
    - _Requirements: 5.2, 5.4, 5.5_

- [x] 13. Implement resume section
  - [x] 13.1 Implement `ResumeSection.astro`
    - Present role/headline, 3 employers with periods, achievements, 2 projects, in a narrative non-tabular layout; provide formal resume download within 3s with "temporarily unavailable" fallback that retains section content
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x]* 13.2 Write unit tests for resume content and retrieval failure
    - Test headline/achievements presence, narrative layout, and resume-retrieval-failure message
    - _Requirements: 6.1, 6.3, 6.5, 6.7_

- [x] 14. Implement certifications section
  - [x] 14.1 Implement `CertificationsSection.astro` and `CertificationCard` island
    - Render the 3 named certs each with one image; hover/focus/activation transform within 200ms and revert within 200ms; image-load-failure shows cert name + "image unavailable"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x]* 14.2 Write unit tests for certification interactions and image fallback
    - Test hover/activation transform + revert timing and image-load-failure label
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 15. Implement responsive behavior and asset-loading wiring
  - [x] 15.1 Wire fluid typography and responsive layout globally
    - Apply `fluidTypography` output and Tailwind breakpoints so all sections render 360–2560px without horizontal scroll/overlap/truncation and reflow within 500ms on resize
    - _Requirements: 9.1, 9.2, 9.5_

  - [x] 15.2 Implement shared image error-fallback component/handler
    - `onerror` swap to a styled alt-text box sized to the reserved aspect-ratio slot (no broken-image icon, no layout shift); reuse across hero, cert, and content images
    - _Requirements: 10.4, 7.5_

  - [x] 15.3 Implement lazy loading of below-fold non-critical media
    - Begin loading a section's non-critical media when it comes within one viewport height of scroll position
    - _Requirements: 10.3_

- [x] 16. Checkpoint - Ensure all component and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Cross-device integration and e2e coverage (Playwright)
  - [x]* 17.1 Write responsive sweep e2e tests
    - Sweep 360–2560px: no horizontal scroll, no overlap, no truncation, body font ≥14px
    - _Requirements: 9.1, 9.2, 9.5_

  - [x]* 17.2 Write animation/interaction timing e2e tests
    - Assert nav-to-section <1000ms, scroll transition begins <100ms/completes 300–800ms, hobby/homelab reveal timing, hero entrance start <200ms/complete <2000ms
    - _Requirements: 1.4, 1.9, 4.5, 8.3_

  - [x]* 17.3 Write frame-rate tracing e2e tests
    - Trace reveal/transition animations for sustained ≥60fps, never below 30fps
    - _Requirements: 8.1_

  - [x]* 17.4 Write touch-target and pointer/touch activation e2e tests
    - Assert every interactive element ≥44×44px and activatable by both pointer and touch
    - _Requirements: 9.6, 9.7_

  - [x]* 17.5 Write asset-loading and above-the-fold e2e tests
    - Assert hero placeholder ≤500ms, lazy media loading, and above-the-fold render within 3s over ≥5Mbps throttled connection
    - _Requirements: 10.1, 10.3, 10.5_

  - [x]* 17.6 Write reduced-motion e2e tests
    - With prefers-reduced-motion set, assert hero and section content render in final state with motion replaced by immediate/fade ≤200ms
    - _Requirements: 1.5, 3.5, 4.7, 8.2_

- [x] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP.
- Each of the 15 correctness properties maps to exactly one property-based test placed next to the code it validates.
- The pure logic layer (Section 2–3) is built and property-tested before any UI so correctness guarantees exist before wiring.
- The AnimationEngine (Section 7) is the single motion entry point; the final-state-by-default rule is what makes Property 5 hold under failure.
- Checkpoints ensure incremental validation before moving to the next layer.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.3", "3.1", "3.3", "3.5"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.5", "3.2", "3.4", "3.6", "5.1", "5.3", "5.5", "5.7", "5.9", "5.11", "5.13"] },
    { "id": 3, "tasks": ["5.2", "5.4", "5.6", "5.8", "5.10", "5.12", "5.14", "5.15", "7.1"] },
    { "id": 4, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 5, "tasks": ["8.2", "9.1", "9.2", "10.1", "11.1", "12.1", "13.1", "14.1"] },
    { "id": 6, "tasks": ["8.3", "9.3", "9.4", "10.2", "11.2", "12.2", "12.3", "13.2", "14.2", "15.1", "15.2", "15.3"] },
    { "id": 7, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5", "17.6"] }
  ]
}
```
