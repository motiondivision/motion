# Plan issue-2260: Answer "support ref elements in sequences" — refs already work; the repro reads `ref.current` too early — and close

> **Executor instructions**: Follow this plan step by step. If anything in
> "STOP conditions" occurs, stop and report. When done, update this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2260 --jq '.state'` → `open`
> (if closed, mark DONE and stop).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (comment + gated close; no code)
- **Depends on**: none
- **Category**: support
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2260

## Classification: SUPPORT / NOT A LIBRARY GAP — answer and close (gated)

## Why this matters

The reporter (0 comments, 2023) believes sequences only accept selectors and
motion values. They accept `Element`s — and therefore refs — but the
reporter's snippet evaluates `ref.current` **during render**, before React
attaches refs, so the segments capture `null` and are silently skipped. The
fix is a one-line usage change; closing with the explanation resolves it.

## Current state (verified at 42bfbe3ed)

- `DOMSegment` subjects are typed `ElementOrSelector`
  (`packages/framer-motion/src/animation/sequence/types.ts:76-82`), and
  `ElementOrSelector` includes `Element | Element[] | NodeListOf<Element> |
  string | null | undefined`
  (`packages/motion-dom/src/utils/resolve-elements.ts:1-7`).
- `packages/framer-motion/src/animation/animate/resolve-subjects.ts:24-36` —
  runtime resolution: `null`/`undefined` subjects return `[]` (**silent
  skip** — this is why the reporter saw "only the motion value animates"
  rather than an error); strings go through `resolveElements`; a bare
  `Element` falls to the final branch and returns `[subject]`. Sequences use
  this via `sequence/create.ts:334-339`.
- Why the reporter's code failed: the sequence array is built in the
  component body —
  ```ts
  const introSeq: AnimationSequence = [
      [intro.serviceRef.current, { opacity: 0 }, ...], // .current === null at render
      [intro.progress, 1, ...],                        // motion value — works
      ...
  ]
  useEffect(() => { animate(introSeq) }, [])
  ```
  `ref.current` is `null` when the array literal is evaluated; by the time
  `useEffect` runs, the array still holds the captured `null`s. Moving the
  array construction *inside* `useEffect` (or using `useAnimate()`'s scope +
  selectors) makes every segment animate.

## Steps

### Step 1: Verify with the existing suite

Confirm sequences animate plain Elements:
`grep -rn "document.createElement\|createRef" packages/framer-motion/src/animation/animate/__tests__/animate-sequence.test.ts packages/framer-motion/src/animation/sequence/__tests__/index.test.ts 2>/dev/null | head`
— existing tests construct sequences with raw `Element`s (the sequence suite
runs on `document.createElement` fixtures). Run
`npx jest --config packages/framer-motion/jest.config.json --testPathPattern="sequence"`
→ pass. If no Element-subject test exists, run a throwaway check (do not
commit).

### Step 2 (gate: `plans/issues/README.md` row APPROVED): Answer and close

Comment on #2260: refs are supported — the subject type is
`Element | selector | MotionValue`; the snippet fails because `ref.current`
is read at render time; show the corrected pattern (build the sequence inside
`useEffect`). Mention that null subjects are skipped silently by design
(`resolve-subjects.ts`), which is why nothing errored. Close:
`gh api -X PATCH repos/motiondivision/motion/issues/2260 -f state=closed -f state_reason=completed`

## Done criteria

- [ ] Element-subject behavior confirmed via existing test or spot-check
- [ ] Comment posted; issue closed (only with APPROVED row)
- [ ] `plans/issues/README.md` row updated
- [ ] No source files modified

## STOP conditions

- Row not APPROVED → mark row BLOCKED awaiting decision.
- Spot-check shows a bare `Element` subject does NOT animate in a sequence →
  premise wrong; report with the failing case.

## Maintenance notes

- A dev-mode warning when a sequence segment's subject is `null` would have
  made this self-diagnosing. Deliberately NOT planned here (silent-skip is
  also a feature for conditional targets); note it if the maintainer wants a
  follow-up.
