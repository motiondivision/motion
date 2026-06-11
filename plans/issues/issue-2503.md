# Plan issue-2503: Answer popLayout + React Router as a ref-forwarding requirement; gated close (optional dev warning)

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2503 --jq .state` → expect `open`.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: maintainer decision only for the optional warning (Step 3)
- **Category**: support (usage constraint, not a Motion bug)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2503

## Why this matters

Reported Jan 2024: `<AnimatePresence mode="popLayout">` wrapping React Router
6's `<Routes>` doesn't pop the exiting route; console shows
`Warning: Function components cannot be given refs… Check the render method of
PopChild`. Root cause is structural, not a Motion bug: `popLayout` works by
cloning the immediate child with a ref so `PopChild` can measure and pin the
exiting DOM element. `<Routes>` is a plain function component that neither
forwards refs (React 18) nor passes `props.ref` to a DOM node (React 19), so
PopChild's ref never attaches, measurement never happens (`width`/`height`
stay 0) and the style injection is skipped. The right outcome is a clear
answer + (optionally) a dev-mode warning so the failure isn't silent.

## Current state

- Ref cloning — `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx:143-149`:
  ```tsx
  return (
      <PopChildMeasure isPresent={isPresent} childRef={ref} sizeRef={size} pop={pop}>
          {pop === false
              ? children
              : React.cloneElement(children as any, { ref: composedRef })}
      </PopChildMeasure>
  )
  ```
- Silent no-op when the ref never attaches —
  `PopChild.tsx:107`: `if (isPresent || pop === false || !ref.current || !width || !height) return`
  and the measurement guard at `PopChild.tsx:41`
  (`isHTMLElement(element) && …`) — no warning anywhere on this path.
- Workaround to give the reporter (standard pattern for router transitions):
  move the changing `key` onto a ref-forwarding wrapper, e.g.
  ```tsx
  <AnimatePresence mode="popLayout">
      <motion.div key={location.pathname} /* or a plain div via forwardRef */>
          <Routes location={location}>…</Routes>
      </motion.div>
  </AnimatePresence>
  ```
  so PopChild clones an element that accepts a DOM ref. (The per-route
  `initial/animate/exit` motion.divs the reporter already has keep working;
  the keyed wrapper is what enters/exits.)
- Note: issue #3745 (sibling plan `issue-3745.md`) touches adjacent PopChild
  ref code — if both land, the warning here must respect that plan's
  `pop === false` gate (only warn when pop is active).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Jest (only if warning implemented) | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence|PopChild"` | pass |
| Issue close (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2503 -f state=closed -f state_reason=not_planned` | closed |

## Steps

### Step 1: Post the answer

Comment on #2503 with: the mechanism (popLayout must attach a DOM ref to its
immediate child; `Routes` can't receive one — that's also exactly what the
React warning in their console says), the keyed-wrapper workaround above, and
that this constraint applies to any non-ref-forwarding component as
AnimatePresence's direct child in popLayout mode.

### Step 2: Gated close

Close as `state_reason=not_planned` (usage constraint, answered) ONLY if this
plan's row in `plans/issues/README.md` is APPROVED (or APPROVED-CLOSE).
Otherwise set the row to BLOCKED("awaiting maintainer close approval") and
stop.

### Step 3: Optional dev-mode warning (only on an explicit APPROVED-IMPLEMENT row)

Make the silent failure loud: in `PopChildMeasure.getSnapshotBeforeUpdate`
(`PopChild.tsx:39-62`), when `prevProps.isPresent && !this.props.isPresent &&
this.props.pop !== false` but `!isHTMLElement(element)`, emit a one-time
`process.env.NODE_ENV !== "production"` warning:
"AnimatePresence mode='popLayout' requires its child to forward its ref to a
DOM element; the exiting element can't be measured and won't pop." Follow the
codebase's small-file-size style (CLAUDE.md Code Style). Requirements:
- Failing-test-first: Jest test rendering popLayout AnimatePresence around a
  plain function component (no forwardRef), removing it, asserting the
  warning fires (spy `console.warn`/`console.error` to match the chosen
  channel) — and a companion assertion that a normal `motion.div` child does
  NOT warn.
- Full AnimatePresence Jest pattern + Cypress `animate-presence-pop*.ts`
  (React 18 AND 19, CLAUDE.md recipe) stay green.
- CHANGELOG entry.

## Done criteria

- [ ] Answer comment posted (mechanism + keyed-wrapper workaround)
- [ ] Close only under APPROVED row; else BLOCKED
- [ ] If APPROVED-IMPLEMENT: warning + failing-first test + green suites + CHANGELOG; no behavior change for valid children
- [ ] `git status` clean on the answer-only path

## STOP conditions

- README row not APPROVED at Step 2.
- Warning path: collides with the `issue-3745.md` change in working tree —
  land that one first, then rebase.
- The PopChild excerpts have drifted.
- Issue already closed at drift-check.
