# Plan issue-2338: Verify whether shared layout animations still glitch after a visibility toggle

> **Executor instructions**: Verification-first plan; repo policy is **no
> repro → no fix**. The sandbox is unreachable, but the issue states exactly
> how it was built ("the docs' Shared layout animations example plus a
> hide/show toggle"), so reconstruction fidelity is high. Honor the approval
> gate before closing. Update the row in `plans/issues/README.md` when done.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2338 --jq .state` → must be `open`.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (shares repro infrastructure with issue-2405; execute
  in the same session if possible)
- **Category**: bug (verify-fixed candidate)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2338

## Why this matters

Sept 2023 report: a `LayoutGroup` tabs row (docs "Shared layout animations"
example — tab underline with `layoutId="underline"`) is hidden then shown;
on becoming visible the underline animates in from a seemingly random
location instead of preserving its state. Reproduced by the reporter on
Chrome/Safari/Firefox/Arc at the time. Two later fixes target precisely this
state-staleness class, so the issue may be dead:

- `90a3dfbda` "Discard zero snapshots (#3030)" (2025-01): `updateSnapshot()`
  now discards measurements with zero width AND height
  (`packages/motion-dom/src/projection/node/create-projection-node.ts:885-897`)
  — kills the "animate from a 0×0 box at the viewport origin" failure mode
  that a hidden/detached element produces.
- `656a77142` + `ea1448e4b` (2026-02): `NodeStack.add()` now evicts
  disconnected members without snapshots
  (`packages/motion-dom/src/projection/shared/stack.ts:12-20`) — kills stale
  leads surviving an unmount/remount cycle.

But neither covers every hiding mechanism, and we don't know which one the
sandbox used — that's the investigation.

## Current state

- Sandbox `codesandbox.io/s/framer-motion-layout-animations-visibility-bug-37wvkh`
  unreachable at planning time (Cloudflare 403). Retry once before
  reconstructing.
- "Hide/show" has four plausible implementations, with different projection
  behavior:
  1. conditional render (unmount/remount) — exercises `NodeStack` eviction +
     `promote()` snapshot adoption (stack.ts:45-73);
  2. `display: none` toggle — element stays mounted; when hidden, any
     measurement is a zero box (now discarded per #3030), but a `didUpdate`
     while hidden may still mark layout dirty;
  3. `visibility: hidden` — element keeps its box; measurements stay valid;
  4. `hidden` attribute — same as display:none.
- The "random location" in the video most resembles mode 1 or 2 followed by a
  measurement taken in the wrong state.
- Relevant machinery for diagnosis: `updateSnapshot()` (lines 885-897),
  `unmount()` → `this.options.layoutId && this.willUpdate()` (line 609),
  `scheduleCheckAfterUnmount()` (lines 831-844), and `NodeStack.promote()`
  copying `prevLead.snapshot` (stack.ts:64-68).

## Commands you will need

Standard Cypress recipe from CLAUDE.md (Vite `dev/react` random port → spec;
then `dev/react-19` + `cypress.react-19.json`). Spec name:
`cypress/integration/layout-group-visibility-toggle.ts`.

## Scope

**In scope**:
- `dev/react/src/tests/layout-group-visibility-toggle.tsx` (create)
- `packages/framer-motion/cypress/integration/layout-group-visibility-toggle.ts` (create)
- Fix code only on confirmed repro; expected location: zero-area guard
  extension in `updateSnapshot`/`notifyLayoutUpdate`
  (`create-projection-node.ts`) or `NodeStack` eviction. Report before
  changes >30 lines (PRs #3748/#3749 own this file's future).

**Out of scope**:
- Speculative fixes / happy-path-only test PRs (repo policy).
- AnimatePresence exit interactions (that's issue #2405's territory).

## Steps

### Step 1: Reconstruct the docs example with a toggle

Test page `layout-group-visibility-toggle.tsx`: the classic tabs strip —
3 tabs, each `<motion.li>` containing, when selected,
`<motion.div layoutId="underline" id="underline" />`, wrapped in
`<LayoutGroup>`. Add `#toggle` which hides/shows the whole strip. Make the
hiding mechanism a prop cycled by the test page so one page covers all four
modes (`?mode=unmount|display|visibility|hidden` via query param — the dev
app passes search params through). Underline transition:
`{ type: "tween", ease: "linear", duration: 0.3 }`, and record
`onLayoutAnimationStart` into a `data-anim-count` attribute on the underline
so the spec can assert "NO animation happened".

### Step 2: Spec with per-mode assertions

For each mode: select tab 2 → wait for settle → capture underline rect →
toggle hide → toggle show → after `cy.wait(100)`, assert via `.then()`:
1. underline rect equals the captured rect immediately (no fly-in from
   elsewhere — sample at 2-3 points during the first 300ms);
2. `data-anim-count` did not increase across the hide/show cycle (the issue's
   expected behavior: "There should be no animation on the element becoming
   visible again").

**Verify**: run all modes on React 18. Record a verdict per mode.

### Step 3a (any mode reproduces): diagnose and fix

Instrument via `cy.window()`: dump `projection.snapshot` and stack state on
show. Expected culprits by mode: zero-area box that survives the #3030 guard
because only ONE axis is zero (`updateSnapshot` discards only when BOTH
axes have zero length — `!calcLength(x) && !calcLength(y)`, line 890-896 —
a `display:none` child of a sized parent can measure 0×N), or a stale
snapshot adopted in `promote()`. Fix narrowly; failing test goes green; HTML
projection suite + `layout-group.ts` (flaky — re-run once) stay green; run
React 18 AND 19.

### Step 3b (nothing reproduces): VERIFY-FIXED path

Comment on #2338: reconstruction at `<commit>` across four hiding modes, all
clean; likely fixed by `90a3dfbda`/`656a77142`; sandbox unreachable — ask
reporter to re-test on ≥12.34. Recommend closing. Close ONLY after the
`plans/issues/README.md` row reads `APPROVED-CLOSE`:
`gh api -X PATCH repos/motiondivision/motion/issues/2338 -f state=closed -f state_reason=not_planned`.
Do not land the never-failing test (policy); attach the test page code to the
comment instead.

## Done criteria

- [ ] Per-mode reproduction verdict recorded (unmount / display / visibility / hidden × React 18/19)
- [ ] If reproduced: failing-first spec + narrow fix, projection suite green
- [ ] If not: comment posted; close gated on README `APPROVED-CLOSE`
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- A mode reproduces only in Electron, not in Chrome (`cypress run --browser
  chrome`) — environment artifact; report instead of fixing (memory note:
  don't overstate Electron-only limits, verify in Chrome).
- Fix requires touching `promote()` snapshot adoption semantics — that path
  is shared with issues #2405/#1411; report so changes are coordinated.

## Maintenance notes

- The one-axis-zero gap in `updateSnapshot` (line 890: requires BOTH axes
  zero) is worth flagging to the maintainer even if this issue doesn't
  reproduce — cheap hardening candidate, but only with a test that proves it.
