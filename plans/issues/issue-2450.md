# Plan issue-2450: Verify `animate()` on plain SVG elements applies transforms; add the missing regression spec

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update
> the status row for this plan in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2450 --jq .state` → expected `open`. If closed, STOP.
> 2. `git log --oneline 42bfbe3ed..HEAD -- packages/motion-dom/src/render/svg/` —
>    if PR #3749 (`worktree-style-effect`) has merged, SVG rendering moved to
>    `packages/motion-dom/src/effects/svg/`; the verification below is MORE
>    important then, but the fixture/spec design is unchanged.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: re-test after plans/issues/pr-3749.md lands (the PR
  rewrites `SVGVisualElement` rendering; run this plan's verification on
  whichever pipeline is on main when executed — and ideally on both sides of
  that merge)
- **Category**: bug (believed fixed on main — verification + regression test + close)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2450

## Why this matters

Reported 2024: SVG child elements animated via `animate()`/`useAnimate()`
(i.e. *not* created as `motion.*` components) never received CSS transforms.
The reporter correctly diagnosed the then-root-cause: `build-attrs.ts` only
copied transforms into `style` "if the dimensions are defined", and
dimensions were only supplied by the React `motion` pipeline
(`config-motion.ts`), never by `createDOMVisualElement`. Both halves of that
mechanism have since been removed, so the bug is *believed* fixed — but
there is no regression test covering `animate()` + plain SVG element +
transform, which is exactly the combination that broke. The CodeSandbox
repro (https://codesandbox.io/p/sandbox/framer-motion-enter-animation-forked-8fzrpg)
is Cloudflare-blocked at planning time; the issue text fully specifies the
repro.

## Current state

- The dimension gate is gone: current
  `packages/motion-dom/src/render/svg/utils/build-attrs.ts:57-73`
  unconditionally moves any built `transform` from attrs into `style` and
  sets `transformBox: "fill-box"` + `transformOrigin` defaults. Relevant
  history: `b5586d076` "Removing types related to dimensions in SVG",
  `c550c9b48`/`44d2f467e` (transform-box fixes).
- `animate()` element path:
  `packages/framer-motion/src/animation/animate/subject.ts:129-141` →
  `createDOMVisualElement`
  (`packages/framer-motion/src/animation/utils/create-visual-element.ts:10-33`)
  creates an `SVGVisualElement` for non-root SVG elements — no dimensions
  involved anymore.
- WAAPI routing bug with the same symptom was fixed by `86907d130` ("Fix SVG
  transform animations not applied without other SVG attributes (#3081)",
  v12.36.0) — `isHTMLElement()` no longer matches SVG elements, so SVG
  transforms take the JS path through the SVG render pipeline.
- Existing E2E coverage (`dev/react/src/tests/svg-transform-animation.tsx` +
  `packages/framer-motion/cypress/integration/svg-transform-animation.ts`)
  only exercises `motion.*` components — NOT `useAnimate()` on plain
  elements. That gap is what this plan fills.
- Interaction with PR #3749: the branch rewrites `SVGVisualElement` (+46/-46)
  and moves attr building to `packages/motion-dom/src/effects/svg/build.ts`;
  SVG values render as styles where supported. The new spec from this plan
  doubles as the regression gate for that migration.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress React 18 | recipe below | spec passes |
| Cypress React 19 | recipe below (react-19 variant) | spec passes |
| Close issue (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2450 -f state=closed -f state_reason=completed` | closed |

Cypress recipe (from repo CLAUDE.md — run from repo root, foreground):

```bash
# React 18
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/svg-animate-plain.ts
kill $DEV_PID

# React 19 — same, from dev/react-19, plus --config-file=cypress.react-19.json
```

## Scope

**In scope** (only files you may create/modify):
- `dev/react/src/tests/svg-animate-plain.tsx` (create)
- `packages/framer-motion/cypress/integration/svg-animate-plain.ts` (create)

**Out of scope**:
- Any change under `packages/motion-dom/src/render/svg/` or
  `packages/framer-motion/src/render/svg/` — if verification fails, that is a
  STOP condition, not a license to fix here.
- The existing `svg-transform-animation` fixture/spec.

## Git workflow

- Branch: `test/issue-2450-svg-animate-plain` from `main`.
- Commit: `Add regression test for animate() transforms on plain SVG elements (#2450)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the fixture mirroring the issue

`dev/react/src/tests/svg-animate-plain.tsx` — named `App` export
(auto-served at `?test=svg-animate-plain`). Mirror the issue: a plain
(non-motion) SVG child animated with `useAnimate`:

```tsx
import { useAnimate } from "framer-motion"
import { useEffect } from "react"

export function App() {
    const [scope, animate] = useAnimate()

    useEffect(() => {
        animate(
            "#target",
            { x: 100, rotate: 45 },
            { type: "tween", ease: "linear", duration: 10 }
        )
    }, [])

    return (
        <svg ref={scope} width={300} height={300}>
            <rect id="target" x={0} y={0} width={50} height={50} fill="#09f" />
        </svg>
    )
}
```

Long duration + linear easing so a mid-animation computed-style check
detects a wrong/missing target proportionally (per CLAUDE.md testing
patterns).

### Step 2: Create the Cypress spec

`packages/framer-motion/cypress/integration/svg-animate-plain.ts`:

- Visit `?test=svg-animate-plain`, wait 5000ms (50% through).
- `.then()` (NOT `.should()`) on `#target`: read
  `getComputedStyle(el).transform` — expect a `matrix(...)` whose translate
  component is ~50px (allow ±10 for timing) and which is NOT `"none"`.
- Also assert `getComputedStyle(el).transformBox === "fill-box"` (the SVG
  pipeline marker — this is what the old bug skipped).
- Do not use `el.getAnimations()` — transform here runs on the JS path for
  SVG.

### Step 3: Run on both React versions

Run the Cypress recipe for React 18 AND React 19 (both must pass — CI runs
both).

**Verify**: both runs report the spec passing. Capture output with
`tail -60` on the first run.

### Step 4: Disposition

- **If both pass** (expected): the issue is fixed on main. If the
  `plans/issues/README.md` row is APPROVED, comment on #2450 (fixed by the
  removal of the SVG dimensions gate and by `86907d130`, v12.36.0; regression
  spec added) and close via the gated command above. Otherwise mark the row
  BLOCKED ("verified fixed; awaiting close approval").
- **If the spec fails**: the bug still exists on the current pipeline. STOP —
  report the failing assertion and computed transform value. This plan then
  becomes the failing-test-first half of a FIX plan; the investigation
  starting points are `build-attrs.ts` (or `effects/svg/build.ts` post-#3749)
  and `supportsBrowserAnimation` routing.

## Test plan

- New Cypress spec: mid-animation transform applied (~50px at 50%),
  `transformBox: fill-box` present, transform not `none`.
- Pattern exemplars: `packages/framer-motion/cypress/integration/svg-transform-animation.ts`
  (assertion style), `dev/react/src/tests/svg-transform-animation.tsx`
  (fixture style).

## Done criteria

- [ ] Fixture + spec exist; spec green on React 18 AND React 19 locally
- [ ] Issue commented + closed (only with APPROVED row), or row BLOCKED
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- The spec fails on either React version — bug present; report, do not fix here.
- The spec passes on one React version and fails on the other — investigate
  per CLAUDE.md, do not skip.
- `?test=svg-animate-plain` doesn't load (fixture registration changed —
  check how sibling tests in `dev/react/src/tests/` are picked up).

## Maintenance notes

- After PR #3749 merges, re-run this spec once on the new pipeline (it is
  exactly the kind of behaviour the PR's SVG rewrite could disturb).
- Follow-up explicitly deferred: same verification for the `motion/mini`
  `animate()` (no VisualElement; uses `svgEffect`) — separate surface, out
  of scope here.
