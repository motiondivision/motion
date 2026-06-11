# Plan issue-2204: Support time offsets from labels in sequence `at` (`at: "label+0.2"`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2204 --jq '.state'` → `open`
>    (if closed, mark DONE and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/animation/sequence/`
>    — any drift in `utils/calc-time.ts` ⇒ re-read it against the excerpt
>    below; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (additive parsing in one pure function; full unit coverage)
- **Depends on**: none
- **Category**: feature / dx
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2204

## Classification: FEATURE — small, real gap; maintainer decision gate on syntax, then implement

## Why this matters

Sequence labels exist, and relative offsets exist for "current time" (`"+0.5"`,
`"-0.5"`) and "previous segment" (`"<+0.5"`), but **not for labels**: `at:
"myLabel"` works, `at: "myLabel+0.2"` silently falls through to `currentTime`.
The reporter building intricate staggered timelines has to hand-compute
absolute playhead times — exactly the math labels exist to avoid. GSAP
supports `"label+=0.2"`; this is table-stakes timeline ergonomics, and the fix
is a few lines in one pure function with an existing dedicated test file.

This is distinct from plan 005 (grid/distance `stagger()`), which is about
stagger functions, not `at` label arithmetic — no overlap.

## Current state (verified at 42bfbe3ed)

`packages/framer-motion/src/animation/sequence/utils/calc-time.ts` (whole
file, 24 lines):

```ts
export function calcNextTime(
    current: number,
    next: SequenceTime,
    prev: number,
    labels: Map<string, number>
): number {
    if (typeof next === "number") {
        return next
    } else if (next.startsWith("-") || next.startsWith("+")) {
        return Math.max(0, current + parseFloat(next))
    } else if (next === "<") {
        return prev
    } else if (next.startsWith("<")) {
        return Math.max(0, prev + parseFloat(next.slice(1)))
    } else {
        return labels.get(next) ?? current
    }
}
```

- Callers: `sequence/create.ts:76` (label-with-time definitions) and
  `create.ts:88-93` (segment `at` resolution). Both pass the shared
  `timeLabels` map (`create.ts:53`).
- `SequenceTime` type (`sequence/types.ts:47-52`) already includes
  `${string}`, so `"label+0.2"` type-checks today — it just resolves wrong.
- Unit tests: `packages/framer-motion/src/animation/sequence/utils/__tests__/calc-time.test.ts`
  (single `describe` covering absolute/label/relative/`<` forms).
- Integration tests: `packages/framer-motion/src/animation/sequence/__tests__/index.test.ts`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build (once, repo root) | `yarn build` | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="calc-time"` | pass |
| Sequence suite | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="sequence"` | pass |
| Lint | `yarn lint` | exit 0 |

## Maintainer decision gate (BEFORE implementing)

Syntax decision — record in this plan's README row and wait for `APPROVED`:

- **Recommended**: `at: "label+0.2"` / `at: "label-0.2"` (matches the
  issue's ask and Motion's existing `"<+0.2"` flavor; no `=` like GSAP's
  `"label+=0.2"`).
- Resolution rule: exact label match wins first (a label literally named
  `"step+1"` keeps working); only when exact lookup fails, split a trailing
  `+number`/`-number` and look up the base label; if the base label doesn't
  exist either, keep today's fallback (`current`).

If `REJECTED`: comment on the issue that label-relative offsets are
declined, suggest computing via a label-only `at` plus segment-level `delay`,
and close as not_planned
(`gh api -X PATCH repos/motiondivision/motion/issues/2204 -f state=closed -f state_reason=not_planned`)
— only with an APPROVED-CLOSE row.

## Steps

### Step 1 (gate: row APPROVED): Failing tests first

Extend `calc-time.test.ts` (existing `labels.set("foo", 2)` fixture):

```ts
// Label with offset
expect(calcNextTime(4, "foo+1", 100, labels)).toBe(3)
expect(calcNextTime(4, "foo-1", 100, labels)).toBe(1)
expect(calcNextTime(4, "foo+0.25", 100, labels)).toBe(2.25)
expect(calcNextTime(4, "foo-3", 100, labels)).toBe(0)      // clamped to 0
expect(calcNextTime(4, "bar+1", 100, labels)).toBe(4)       // unknown label → current (unchanged fallback)
// Exact-match precedence
labels.set("baz+1", 9)
expect(calcNextTime(4, "baz+1", 100, labels)).toBe(9)
```

Run the calc-time filter → the new assertions FAIL on current code (e.g.
`"foo+1"` returns `4`, not `3`). This is the bug-shaped failure required
before implementing.

### Step 2: Implement in `calcNextTime`

Replace the final `else` branch only. Target shape (keep it byte-light per
repo style):

```ts
} else {
    const labelTime = labels.get(next)
    if (labelTime !== undefined) return labelTime

    const match = next.match(/^(.+)([+-]\d*\.?\d+)$/)
    if (match) {
        const base = labels.get(match[1])
        if (base !== undefined) {
            return Math.max(0, base + parseFloat(match[2]))
        }
    }

    return current
}
```

Notes: `(.+)` is greedy so `"a+b+0.2"` resolves base `"a+b"` first — correct,
since the offset must be the trailing numeric part. Don't support whitespace
(`"foo + 0.2"`) — keep parity with the strict `"<+0.2"` parsing above.

**Verify**: calc-time filter → all pass, including Step 1's new cases.

### Step 3: Integration test

In `sequence/__tests__/index.test.ts`, add one test modeled on the existing
label tests there: a sequence `[[el, {...}, {duration: 1}], "mid", [el2, {...},
{duration: 1}], [el3, {...}, { at: "mid+0.5", duration: 1 }]]` built via
`createAnimationsFromSequence`, asserting the third subject's computed
`times`/`duration` place its start at 1.5s (inspect the returned definition's
`transition[key].times` against `duration` the same way neighboring tests
do — copy their assertion style).

**Verify**: sequence filter → all pass.

### Step 4: Full gates

`yarn build` → exit 0; `yarn lint` → exit 0; full framer-motion client suite
once: `cd packages/framer-motion && yarn test-client` → no new failures
(pre-existing SSR/use-velocity failures noted in repo memory don't count).

### Step 5: Answer the issue

Comment on #2204 with the shipped syntax + example, referencing the release
it will go out in. Close as completed
(`gh api -X PATCH repos/motiondivision/motion/issues/2204 -f state=closed -f state_reason=completed`)
— or leave open until release per maintainer preference stated in the row.

## Scope

**In scope**:
- `packages/framer-motion/src/animation/sequence/utils/calc-time.ts`
- `packages/framer-motion/src/animation/sequence/utils/__tests__/calc-time.test.ts`
- `packages/framer-motion/src/animation/sequence/__tests__/index.test.ts`

**Out of scope**:
- `sequence/types.ts` — `SequenceTime` already admits `${string}`; adding a
  template-literal type for `label+n` is impossible to express usefully.
- GSAP-style `"+=0.2"` aliases; percentage offsets; `"<label"` combinations.
- motion-dom — sequences live in framer-motion.

## Git workflow

- Branch: `feature/sequence-label-offset`
- Conventional message, e.g. `feat: support time offsets from labels in sequence 'at' option`
- Do not push/PR unless the operator instructed it.

## Done criteria

- [ ] Row APPROVED before any code
- [ ] New calc-time cases existed and failed before the fix (state this in the PR/report)
- [ ] calc-time + sequence filters pass; `yarn build` + `yarn lint` exit 0
- [ ] Only in-scope files modified
- [ ] Issue answered/closed per gate; `plans/issues/README.md` row updated

## STOP conditions

- Row not APPROVED → stop before Step 1.
- `calcNextTime` no longer matches the excerpt (drifted) → STOP.
- The integration test in Step 3 can't pin the expected 1.5s start using the
  neighboring tests' assertion style after 2 attempts → STOP and report
  (don't invent a new assertion mechanism).

## Maintenance notes

- If label→time lookup is ever exposed publicly (see issue #2608's
  limitation note), reuse this same parse so `seek("label+0.2")` behaves
  identically.
- Reviewer should scrutinize the regex's exact-match precedence and the
  `Math.max(0, ...)` clamp (consistent with the other relative forms).
