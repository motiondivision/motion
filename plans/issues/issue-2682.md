# Plan issue-2682: Make onClick after a Reorder drag consistent by suppressing the post-drag click

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2682 --jq '.state'` → `open`
>    (if closed, mark DONE and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/drag/ packages/framer-motion/src/components/Reorder/`
>    If `VisualElementDragControls.ts` changed, compare the excerpts below
>    against live code; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (behavior change to all draggables — gated on maintainer decision)
- **Depends on**: none (lands cleanest after plans/issues/pr-3731.md, which also touches drag end handling — coordinate if both in flight)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2682

## Classification: FIX — with a maintainer decision gate on the approach

## Why this matters

After drag-to-reorder, the browser's native `click` event sometimes fires on
the dragged `Reorder.Item` and sometimes doesn't (reporter: dragging the
upper item below the lower one → no click; dragging the lower item over the
upper one → click fires). Users attaching `onClick` to items (select-on-click
lists) get phantom activations after drags and must hand-roll `useRef`
guards (the workaround in the issue body). Motion's own `onTap` already
suppresses itself during drag (`packages/motion-dom/src/gestures/drag/state/is-active.ts`
is checked by press/hover), but native `click` is untouched, so whether it
fires depends on browser click-target heuristics interacting with layout
animations and pointer capture — inherently inconsistent. The standard fix
(used by dnd-kit, react-dnd, SortableJS) is: when a drag session actually
entered the dragging state, swallow the next `click` in the capture phase.

## Issue facts

- Reproduction CodeSandbox (`6w76kh`) is Cloudflare-blocked from this
  environment (403 / challenge page at planning time). The issue body fully
  specifies the repro inline: a 2-item `Reorder.Group`, `onClick` alert on
  items, drag one past the other, release — click fires in one direction
  only. Build the test page from that description; this satisfies the
  "reporter's reproduction is the basis for your test" rule.
- 1 comment (a thank-you for the workaround). No fix has landed:
  `git log --oneline --grep="click" -i` shows no click-suppression commit.

## Current state

- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` —
  drag state machine. `isDragging` only becomes true in `onStart`
  (line 132), which `PanSession` fires after the pointer moves ≥ the distance
  threshold (default 3px — `packages/framer-motion/src/gestures/pan/PanSession.ts:126`
  `distanceThreshold = 3`). So "a drag actually happened" is exactly
  `this.isDragging === true` at stop time.

```ts
// VisualElementDragControls.ts:267-282
stop(event?: PointerEvent, panInfo?: PanInfo) {
    const finalEvent = event || this.latestPointerEvent
    const finalPanInfo = panInfo || this.latestPanInfo

    const isDragging = this.isDragging
    this.cancel()
    if (!isDragging || !finalPanInfo || !finalEvent) return

    const { velocity } = finalPanInfo
    this.startAnimation(velocity)

    const { onDragEnd } = this.getProps()
    if (onDragEnd) {
        frame.postRender(() => onDragEnd(finalEvent, finalPanInfo))
    }
}
```

- `packages/framer-motion/src/components/Reorder/Item.tsx:98-133` — Reorder
  items are plain draggables (`drag={axis}`, `dragSnapToOrigin`); they add no
  click handling of their own. Fixing at the drag-controls level fixes
  Reorder and all draggables at once.
- Browser ordering guarantee the fix relies on: `click` is dispatched after
  the `pointerup`/`mouseup` handlers complete, in the same task. A one-shot
  capture-phase listener registered during `stop()` (which runs from the
  pointerup handler) therefore catches exactly the post-drag click; a
  `setTimeout(..., 0)` removal prevents it from eating a later unrelated
  click if the browser skips the click (e.g. pointerup off-document).
- `getContextWindow` is already imported in `VisualElementDragControls.ts`
  (used at line 258) — use it to resolve the right window for iframes.

## Maintainer decision gate (BEFORE implementing)

This changes observable behavior for every `drag` component: today a click
*sometimes* fires after a drag; after the fix it never does (clicks without
≥3px movement are unaffected, since `isDragging` stays false). The
maintainer must edit this plan's row in `plans/issues/README.md` to
`APPROVED` before Steps 2+ run. Alternatives if REJECTED: document the
`useRef` workaround in the Reorder docs and close the issue as not_planned
(`gh api -X PATCH repos/motiondivision/motion/issues/2682 -f state=closed -f state_reason=not_planned`).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` from repo root | exit 0 |
| Drag unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="drag"` from repo root | pass |
| Lint | `yarn lint` from repo root | exit 0 |
| Cypress | recipe below | pass on React 18 AND 19 |

```bash
# React 18
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --headed --config baseUrl=http://localhost:$PORT --spec "cypress/integration/reorder-click.ts,cypress/integration/drag-to-reorder.ts,cypress/integration/drag.ts"
kill $DEV_PID

# React 19 (own port, own server)
PORT=$((10000 + RANDOM % 50000))
cd ../../dev/react-19 && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --config-file=cypress.react-19.json --config baseUrl=http://localhost:$PORT --headed --spec "cypress/integration/reorder-click.ts,cypress/integration/drag-to-reorder.ts,cypress/integration/drag.ts"
kill $DEV_PID
```

Run Cypress in the foreground only; `tail -60` the first run's output.
Note: `drag.ts` is on the repo's known-flaky list — re-run once before
treating a failure as real.

## Scope

**In scope** (only files you may modify/create):
- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
- `dev/react/src/tests/reorder-click.tsx` (create)
- `packages/framer-motion/cypress/integration/reorder-click.ts` (create)

**Out of scope**:
- `packages/motion-dom/src/gestures/press/` — `onTap` already handles drag
  via `isDragActive()`; don't touch.
- `Reorder/Item.tsx` — fix belongs at the drag level, not per-consumer.
- `PanSession.ts` — the 3px threshold and session lifecycle are unchanged.
- Any opt-out prop (e.g. `dragAllowClick`) — only add if the maintainer asks.

## Steps

### Step 1: Failing Cypress test first

Create `dev/react/src/tests/reorder-click.tsx` (auto-served at
`?test=reorder-click`), modeled on `dev/react/src/tests/drag-to-reorder.tsx`
(named `App` export). Content: `Reorder.Group axis="y"` with two fixed-size
items (`id="item-a"`, `id="item-b"`, e.g. 340×68px like drag-to-reorder),
each with `onClick` incrementing a per-item counter rendered into the DOM
(e.g. `<span id="count-a">{countA}</span>`), `transition={{ duration: 0.1 }}`.

Create `packages/framer-motion/cypress/integration/reorder-click.ts`,
following the pointerdown → pointermove (×several, `wait(50)` between) →
pointerup pattern with `{ force: true }` from
`packages/framer-motion/cypress/integration/drag-to-reorder.ts:46-50`. Tests:

1. **Plain click still fires**: `cy.get("#item-a").click()` → `#count-a`
   text is `1`. (Regression gate for over-suppression.)
2. **Drag down past the other item, release** (the reporter's gesture 1):
   pointerdown on `#item-a`, move ~80px down in 4 steps, pointerup, wait
   200ms → `#count-a` unchanged.
3. **Drag up past the other item, release** (the reporter's gesture 2 — the
   direction that fires today): pointerdown on `#item-b`, move ~80px up in 4
   steps, pointerup, wait 200ms → `#count-b` unchanged.

Use `.then()` for counter reads, not retrying `.should()` chains, when
asserting "did NOT change".

**Verify**: run the Cypress recipe (React 18 is enough for the failing
check) → test 1 passes; at least one of tests 2/3 FAILS (a counter
incremented). Record which. If BOTH 2 and 3 pass unmodified, the
inconsistency may not reproduce in Electron — try `--browser chrome`; if it
still passes, STOP (no repro → no fix; see STOP conditions).

### Step 2 (gate: row APPROVED): Suppress the post-drag click

In `VisualElementDragControls.ts`, inside `stop()`, after the
`if (!isDragging || ...) return` guard passes — i.e. only when a real drag
ended — register a one-shot capture-phase suppressor:

```ts
const win = getContextWindow(this.visualElement) || window
const suppressClick = (clickEvent: Event) => {
    clickEvent.stopPropagation()
    clickEvent.preventDefault()
}
win.addEventListener("click", suppressClick, { capture: true, once: true })
setTimeout(() => {
    win.removeEventListener("click", suppressClick, { capture: true })
}, 0)
```

Keep it inline or as a small module-level helper `suppressNextClick(win)` —
prefer whichever is smaller in output (repo rule: prioritise small file
size). Do not suppress when `stop()` is reached with `isDragging === false`
(sub-threshold press-release must keep clicking).

**Verify**: `yarn build` → exit 0. Re-run Step 1's Cypress spec on React 18 →
all 3 tests pass.

### Step 3: Full verification

**Verify**:
- Cypress recipe on React 18 AND React 19: `reorder-click.ts`,
  `drag-to-reorder.ts`, `drag.ts` all pass (both versions mandatory).
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="drag"` → pass
  (JSDOM doesn't dispatch native post-pointerup clicks, so existing unit
  tests should be unaffected — if any fail, inspect before touching them).
- `yarn lint` → exit 0.

### Step 4: PR

Branch `fix/2682-suppress-post-drag-click`; commit style: short imperative
sentence (e.g. `Suppress native click after drag gesture`). Open the PR with
`gh pr create` (body notes the behavior change and links `Fixes #2682`).
Do NOT use `gh pr edit` (broken on this repo — Projects Classic); for later
body edits use `gh api -X PATCH repos/motiondivision/motion/pulls/<n> -f body=...`.

## Test plan

- Cypress `reorder-click.ts`: plain-click-fires (over-suppression gate),
  drag-down-no-click, drag-up-no-click (the reporter's two gestures). The
  failing direction recorded in Step 1 is the regression gate.
- Existing `drag-to-reorder.ts` + `drag.ts` specs: drags still reorder/move
  (suppressor must not interfere with pointer events, only click).

## Done criteria

- [ ] Step 1 spec failed pre-fix (recorded which direction) and passes post-fix
- [ ] Cypress `reorder-click.ts`, `drag-to-reorder.ts`, `drag.ts` pass on React 18 and 19
- [ ] Drag jest suite passes; `yarn lint`, `yarn build` exit 0
- [ ] No files outside Scope modified (`git status`)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- The Step 1 test cannot be made to fail in Electron OR Chrome after 2–3
  attempts → no repro; comment on the issue asking for a current repro
  (sandbox was Cloudflare-blocked) and recommend closing as not_planned —
  closing itself gated on the README row saying APPROVED-CLOSE.
- Maintainer row not APPROVED → do not implement Step 2; report.
- Suppression breaks `drag.ts`/`drag-to-reorder.ts` on either React version
  (e.g. Cypress synthesizes clicks mid-chain that get eaten) and fixing
  requires touching out-of-scope files.
- `stop()` no longer matches the excerpt (drift — check whether pr-3731's
  capture-phase end-handling landed and re-verify ordering assumptions).

## Maintenance notes

- The suppressor is global-per-window and one-shot; simultaneous multi-touch
  drags ending in the same tick share one click anyway (browsers fire click
  for the primary pointer), but a reviewer should sanity-check multi-touch.
- If users report wanting post-drag clicks, the escape hatch is a future
  `dragAllowClick`-style prop — do not pre-build it.
- Interacts with pr-3731 (capture-phase drag end): both change end-of-drag
  event flow; whichever lands second re-runs the other's Cypress specs.
