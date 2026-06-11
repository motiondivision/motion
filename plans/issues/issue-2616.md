# Plan issue-2616: Request a current reproduction for layoutId + AnimatePresence enter/exit blinking (needs-repro)

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2616 --jq .state` → expect `open`.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (no source changes authorized)
- **Depends on**: none
- **Category**: bug (needs-repro)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2616

## Why this matters

Reported April 2024 (v11.0.25): elements with `layoutId` inside
`AnimatePresence` "blink" (a frame of wrong opacity / momentary disappearance)
on enter and exit. A Feb 2026 comment reports the same symptom and that
removing `layoutId` stops it — so the report may still be live. But: the
linked CodeSandbox is inaccessible, the issue contains no inline code, the
symptom is a transient one-frame visual artifact (the hardest class to assert),
and shared-element `layoutId` blinking is highly sensitive to exact markup
(crossfade pairs, `LayoutGroup`, sibling order). Per repo policy — **no repro
→ no fix, no speculative coverage** — the honest plan is: one bounded attempt
to obtain/reconstruct the repro, then a needs-repro request with a gated
close. Guessing at projection-crossfade changes without a failing case risks
breaking real shared-element behavior.

## Current state

- Repro link: `https://codesandbox.io/p/sandbox/frosty-fast-dc5lt8` —
  **Cloudflare-blocked from the planning environment (403)**. Retry once via
  WebFetch (also try `https://codesandbox.io/api/v1/sandboxes/dc5lt8`).
- Described UI: a list of items; clicking an item selects it and a detail view
  animates via shared `layoutId`; blinking on both enter and exit. The 2026
  comment confirms only "layoutId inside AnimatePresence blinks", version
  unstated.
- Relevant subsystem: projection crossfade
  (`packages/framer-motion/src/projection/` — shared `layoutId` nodes hand off
  opacity during crossfade) interacting with `PresenceChild`/exit. Numerous
  projection and presence fixes have landed since v11.0.25 — version drift
  alone makes the 2024 sandbox weak evidence even if recovered.
- Exemplar fixture style for an attempted reconstruction:
  `dev/react/src/tests/animate-presence-layout.tsx` + spec
  `packages/framer-motion/cypress/integration/animate-presence-layout.ts`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Cypress (only if reconstructing) | CLAUDE.md § "Running Cypress tests locally" | — |
| Issue close (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2616 -f state=closed -f state_reason=not_planned` | closed |

## Steps

### Step 1: One bounded reconstruction attempt (max ~1 hour)

Retry the sandbox URLs. If blocked, build
`dev/react/src/tests/animate-presence-layout-id-blink.tsx` (uncommitted):
grid of items each with `layoutId={id}`; clicking renders a detail card with
the same `layoutId` inside `<AnimatePresence>`; exit on dismiss. Detection
spec idea: sample `getComputedStyle(card).opacity` every frame for the first
~10 frames after toggle via `requestAnimationFrame` loop injected in the page,
assert the sequence is monotonic (no 1→0→1 dip) — run it in the CLAUDE.md
Cypress recipe (React 18). Limit to 2–3 markup variations (with/without
`mode="popLayout"`, with/without a wrapping `LayoutGroup`).

**Verify**: record outcome of each run.

- **Blink reproduced** (non-monotonic opacity / element missing for a frame):
  STOP and report with the fixture + spec — this graduates to a FIX plan with
  evidence attached. Do not attempt a projection fix under this plan.
- **No blink**: proceed to Step 2.

### Step 2: Needs-repro comment

Comment on #2616: the original sandbox is inaccessible and was against
11.0.25; describe the reconstruction attempted at 12.40.0 (`42bfbe3ed`) and
that no blinking was observed; ask the reporter (and the 2026 commenter,
@Ammar1999y, who confirmed the symptom recently) for a minimal repro against
`motion@12.40.0`, ideally CodeSandbox/StackBlitz plus exact browser. Note
that `layoutId` blinking reports need exact markup to be actionable.

### Step 3: Gated close

Per repo policy, an unreproducible report without a working repro link is
closed as needs-repro — but ONLY if this plan's row in
`plans/issues/README.md` is APPROVED (or APPROVED-CLOSE). Otherwise set the
row to BLOCKED("awaiting maintainer close approval — needs-repro comment
posted") and stop. If closing, use `state_reason=not_planned` and invite
reopening with a fresh repro. Discard the uncommitted fixture (no speculative
happy-path coverage).

## Done criteria

- [ ] Sandbox retry + bounded reconstruction attempted; outcomes recorded
- [ ] Needs-repro comment posted (or STOP if blink reproduced)
- [ ] Close only under APPROVED row; else BLOCKED
- [ ] `git status` clean

## STOP conditions

- Blink reproduces in Step 1 → report, don't fix here.
- Sandbox becomes fetchable and shows markup meaningfully different from the
  reconstruction → restart Step 1 with the real code (once), then re-branch.
- README row not APPROVED at Step 3.
- Issue already closed at drift-check.
