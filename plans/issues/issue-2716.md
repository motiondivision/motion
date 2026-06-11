# Plan issue-2716: Close "jumpy scrolling" as a browser threading limitation, with mitigation guidance

> **Executor instructions**: Follow this plan step by step. Do not write any
> code for this issue. If anything in "STOP conditions" occurs, stop and
> report. When done, update the status row for this issue in
> `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2716 --jq .state` → must be `open`.
> Re-read the latest comments (`gh api repos/motiondivision/motion/issues/2716/comments`)
> — if a new reproduction or maintainer signal has appeared since 2026-06-11,
> STOP and report.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support / not-planned
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2716

## Why this matters

2024 report ("[BUG] Jumpy Scrolling", framer-motion 11.2.11, Chrome/Win11):
scroll-linked animations driven by `useScroll` occasionally jump when
scrolling with the mouse wheel but not with the scrollbar. The comment thread
itself converges on the diagnosis: scrolling runs on the compositor thread
while JS scroll handlers run on the main thread, so JS-driven scroll-synced
DOM updates can lag a frame behind the visual scroll (comments by boar-is
2024-11-06 — "correlated with Chrome behavior (try to reproduce it without
Framer Motion)" — and clementroche 2025-11-05, explaining the thread split
and pointing at Lenis). This is not a Motion defect Motion can fix in the JS
path; keeping the issue open as a `bug` misleads.

## Current state

- Repro: https://stackblitz.com/edit/stackblitz-starters-iuqre4 — fetch
  attempt at planning time returned only the project title ("Framer Motion
  Scrolling Lagging Issue"); source not retrievable headlessly. The video in
  the issue shows a sticky scroll-linked transform stuttering during wheel
  scroll.
- What changed since the report (relevant, cite in the reply):
  - v12.34.0 (`3b6dcbd77`): `useScroll` + `useTransform` pipelines
    hardware-accelerate via native ScrollTimeline where supported — the
    update happens on the compositor thread, which is the actual fix for
    main-thread lag on compatible properties (transform/opacity).
  - v12.35.0–v12.39.0 extended this to ViewTimeline target tracking
    (`3995b3408`, `6bae74ee6`, `2ffc157b4`).
  - JS fallback still measures on `scroll` events
    (`packages/framer-motion/src/render/dom/scroll/track.ts:70`,
    `const listener = () => frame.read(measureAll)`) and is inherently
    subject to compositor/main-thread desync.
- Repo policy: no repro → no fix; closing requires the maintainer gate.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Read issue | `gh api repos/motiondivision/motion/issues/2716` | JSON, state open |
| Comment | `gh api repos/motiondivision/motion/issues/2716/comments -f body="…"` | comment created |
| Close | `gh api -X PATCH repos/motiondivision/motion/issues/2716 -f state=closed -f state_reason=not_planned` | state closed |

## Scope

**In scope**: one GitHub comment + close. **Out of scope**: any source change;
re-litigating the scroll engine; `gh issue close`/`gh pr edit` (broken on
this repo — use `gh api`).

## Steps

### Step 1: Post the explanation comment

Content to cover (write it in the maintainer's voice, concise):
1. Diagnosis confirmed: browser threaded scrolling means JS-driven
   scroll-synced updates can trail the compositor by a frame; reproducible
   without Motion (per boar-is/clementroche in-thread).
2. What Motion now does: since 12.34.0, `useScroll`/`useTransform` →
   `style` pipelines hardware-accelerate onto the compositor via native
   ScrollTimeline/ViewTimeline in supporting browsers when the offset is a
   preset/named form and the animated properties are compositor-friendly
   (transform, opacity) — upgrade and prefer those patterns.
3. Mitigations when acceleration can't apply: wrap the value in
   `useSpring` (mccallofthewild's in-thread suggestion), or a JS smooth-scroll
   layer such as Lenis.
4. Closing as a browser limitation, not a Motion bug; happy to reopen with a
   repro showing Motion lagging where an equivalent vanilla
   ScrollTimeline/rAF implementation does not.

**Verify**: comment visible on the issue.

### Step 2: Close (GATED)

Only if the row for issue-2716 in `plans/issues/README.md` reads `APPROVED`
(maintainer edit). Then run the close command above with
`state_reason=not_planned`.

**Verify**: `gh api repos/motiondivision/motion/issues/2716 --jq .state` → `closed`.

## Done criteria

- [ ] Comment posted covering points 1–4
- [ ] Issue closed as not_planned **only** with the APPROVED gate satisfied
- [ ] No source files modified (`git status` clean)
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- The README row is missing or not `APPROVED` → post the comment (Step 1 is
  ungated), skip Step 2, report.
- A newer comment supplies a reproducible Motion-specific lag (vanilla
  comparison included) → reclassify as FIX candidate, report instead of
  closing.

## Maintenance notes

- If wheel-scroll jumpiness reports keep arriving, the durable answer is
  widening acceleration coverage (see plans 003/004 and the accelerated-values
  audit note in `plans/README.md`), not JS-path tweaks.
