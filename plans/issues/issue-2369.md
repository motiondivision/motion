# Plan issue-2369: Reproduce-or-close the CSS-variable background + spring misbehaviour

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in
> `plans/issues/README.md`.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2369 --jq .state`
> → expected `open`. If closed, mark the README row DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S (M if the repro fails — then it escalates to a FIX)
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (2023-era; likely fixed — reproduce-or-close)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2369

## Why this matters

Reported Oct 2023 (framer-motion v10): using CSS variables for
`backgroundColor` while a `spring` animates an unrelated property (`scale`)
on the same element made the background "jump back to a previous value near
the animation's end" (video attached to the issue). The CSS-variable
resolution pipeline has been rewritten since (v11 keyframe resolvers), and a
directly-on-point fix landed: `ba2f48ccb` "Fixing CSS variables as final
keyframe (#2617)" (2024-04-11) — it makes the resolver store the *var token*
as `finalKeyframe` whenever the last keyframe is a CSS variable, so the
value settles on `var(--x)` instead of a stale concrete colour. The repro
sandbox (https://codesandbox.io/s/eloquent-bose-nmqklf) is
**Cloudflare-blocked** at planning time, but the issue text fully specifies
the scenario. Per repo policy: no repro on current main → close, don't fix.

## Current state

- CSS variable resolution for animation targets:
  `packages/motion-dom/src/animation/keyframes/DOMKeyframesResolver.ts:49-67`
  — each `var(--…)` keyframe is resolved via `getVariableValue`
  (`packages/motion-dom/src/animation/utils/css-variables-conversion.ts:27-54`),
  and if the LAST keyframe is a var token it is preserved as
  `this.finalKeyframe` (lines 62-64, added by `ba2f48ccb`), which the
  animation applies on completion
  (`getFinalKeyframe`, `packages/motion-dom/src/animation/keyframes/get-final.ts`).
- Springs on non-numeric values (a colour, if the user's `transition`
  applies `type: "spring"` to everything):
  `packages/motion-dom/src/animation/JSAnimation.ts:131-141` — keyframes are
  swapped for `[0, 100]` and mixed via `mix(keyframes[0], keyframes[1])`.
- Existing E2E coverage of vars: `dev/react/src/tests/css-vars.tsx` +
  `packages/framer-motion/cypress/integration/css-vars.ts` (animates
  `backgroundColor: "var(--a)"` together with `scale`/`x` vars) — but with a
  `duration: 0.1` tween, **not** a spring, and it only asserts first-frame
  resolution, not end-of-animation stability. The issue's exact combination
  (var-driven bg + long spring on scale) is untested.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress (recipe from CLAUDE.md, both React 18 & 19) | see issue-2450 plan or CLAUDE.md § "Running Cypress tests locally", spec `cypress/integration/css-var-spring.ts` | pass/fail = the verdict |
| Close issue (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2369 -f state=closed -f state_reason=not_planned` | closed |

## Scope

**In scope** (only files you may create):
- `dev/react/src/tests/css-var-spring.tsx` (create)
- `packages/framer-motion/cypress/integration/css-var-spring.ts` (create)

**Out of scope**:
- Any change to `DOMKeyframesResolver.ts`, `css-variables-conversion.ts`,
  `JSAnimation.ts` — if the repro fails, STOP and report; the fix is a
  separate effort with the pointers below.

## Git workflow

- Branch: `test/issue-2369-css-var-spring` from `main`.
- Commit: `Add repro attempt for CSS var background + spring (#2369)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Build the fixture from the issue text

`dev/react/src/tests/css-var-spring.tsx` (auto-served at
`?test=css-var-spring`). Reconstruct the report: CSS variables define two
background colours; clicking toggles `backgroundColor` between
`var(--bg-a)` / `var(--bg-b)` while `scale` toggles 1 ↔ 1.5 under
`transition={{ type: "spring", stiffness: 50, damping: 8 }}` (a soft,
long-tailed spring so "near the animation's end" is observable). Model the
var setup on `dev/react/src/tests/css-vars.tsx`. Shape:

```tsx
import { motion } from "framer-motion"
import { useState } from "react"

export function App() {
    const [on, setOn] = useState(false)
    return (
        <div style={{ "--bg-a": "#ff0000", "--bg-b": "#0000ff" } as any}>
            <motion.button
                id="toggle"
                onClick={() => setOn(!on)}
                animate={{
                    backgroundColor: on ? "var(--bg-b)" : "var(--bg-a)",
                    scale: on ? 1.5 : 1,
                }}
                transition={{ type: "spring", stiffness: 50, damping: 8 }}
                style={{ width: 200, height: 100 }}
            >
                Toggle
            </motion.button>
        </div>
    )
}
```

### Step 2: Spec asserting end-state colour stability

`packages/framer-motion/cypress/integration/css-var-spring.ts`:

1. Visit `?test=css-var-spring`, click `#toggle`.
2. Sample `getComputedStyle(el).backgroundColor` at several points through
   the spring's tail using `.then()` captures (e.g. at 500ms, 1500ms, 3000ms
   after click — the soft spring above settles in roughly 2-4s).
3. Assertions:
   - Final sample is blue: `rgb(0, 0, 255)`.
   - No *backwards* jump: once the colour has been ~blue (within a small
     channel tolerance), a later sample must not revert toward red — assert
     the red channel at 3000ms is `0` and that the 1500ms sample is not
     *more* red than the 500ms one.
4. Per CLAUDE.md: use `.then()` not `.should()` for the mid-animation
   samples (retries would mask the transient jump-back); the final settled
   assertion may use `.should()`.

### Step 3: Run on both React versions and decide

Run the spec via the CLAUDE.md Cypress recipe against React 18 and React 19.

- **Spec passes on both (expected)**: the bug is not reproducible on current
  main. If the `plans/issues/README.md` row is APPROVED: comment on #2369
  (couldn't reproduce on motion@12; CSS-var final-keyframe handling was
  fixed by `ba2f48ccb` / #2617 in 2024 and the resolver was rewritten in
  v11; attach the fixture used; please reopen with a current-version repro)
  and close with `state_reason=not_planned`. Decide with the operator
  whether to land the fixture+spec as permanent coverage or delete the
  branch — per repo policy, do NOT land happy-path tests for an
  unreproduced bug by default (memory note: "No repro → no fix, no
  speculative coverage").
- **Spec fails (colour reverts)**: bug confirmed live. STOP and report with
  the captured samples. Investigation pointers for the follow-up FIX plan:
  `DOMKeyframesResolver.readKeyframes` lines 49-67 (token kept as
  finalKeyframe), `JSAnimation.ts:131-141` (spring + non-numeric `mix`
  path — a spring applied to a colour overshoots progress past 100 and
  `mix` extrapolation may fold back), and `getFinalKeyframe` application
  order vs. still-running sibling animations.

## Test plan

- The spec IS the test: settled colour correct + no backward colour
  movement during the spring tail, on React 18 and 19.
- Exemplars: `cypress/integration/css-vars.ts` (var assertions),
  CLAUDE.md "Cypress animation testing patterns".

## Done criteria

- [ ] Fixture + spec written; run on React 18 AND 19 with captured output
- [ ] Verdict recorded: closed-with-comment (APPROVED row only) OR failure report filed; README row updated accordingly
- [ ] No files outside the in-scope list modified (`git status`)

## STOP conditions

- The spec fails on either React version — bug confirmed; report, do not fix here.
- The spring settles before the second sample on the executor's machine
  (timing flake) — re-tune stiffness/damping or sample times once; if still
  ambiguous, report rather than loosening assertions until they can't fail.
- Issue comments gain a working current-version repro that differs from the
  Step 1 fixture — use the reporter's repro instead, per CLAUDE.md.

## Maintenance notes

- If this closes as not-reproducible, the durable artefact is the closing
  comment documenting `ba2f48ccb` as the likely fix — future duplicate
  reports should be checked against motion@12 first.
- Note for reviewers: `MotionGlobalConfig`/WAAPI is irrelevant here —
  backgroundColor springs run on the JS path (`JSAnimation`), so JSDOM-vs-
  browser differences are not the blocker; the Cypress layer was chosen for
  real `getComputedStyle` var resolution.
