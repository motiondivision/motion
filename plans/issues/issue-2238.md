# Plan issue-2238: Verify swapped injected motion values now rebind correctly, add regression test, close

> **Executor instructions**: Follow step by step; run every verification
> command. If anything in "STOP conditions" occurs, stop and report. When
> done, update the status row for this plan in `plans/issues/README.md`
> (NOT `plans/README.md`).
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2238 --jq .state` → expect `"open"`. If closed, mark DONE and stop.
> 2. Confirm `packages/motion-dom/src/render/VisualElement.ts:538-541` still reads exactly:
>    ```ts
>    private bindToMotionValue(key: string, value: MotionValue) {
>        if (this.valueSubscriptions.has(key)) {
>            this.valueSubscriptions.get(key)!()
>        }
>    ```
>    Mismatch = STOP.

## Status

- **Classification**: VERIFY-FIXED
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (historical; verifying fix + regression coverage)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2238

## Verdict and evidence

The reporter (July 2023) diagnosed a double subscription: `addValue` bound a
motion value, then `mount()` called `bindToMotionValue` again for the same
key without removing the first subscription. The map
(`valueSubscriptions`) kept only the second; on a later swap
(`style={{ x: swap ? x2 : x1 }}`), `addValue` → `removeValue` unsubscribed
only the tracked one — the leaked subscription kept driving the element from
the **old** value.

The reporter's exact fix shape landed in commit `828b8d9e5`
("Removing double update listenrs on externall provided motion values (#2773)",
2024-08-23, shipped in **v11.4.0**, verified via
`git merge-base --is-ancestor 828b8d9e5 27b4d704b`). It added the guard now at
`packages/motion-dom/src/render/VisualElement.ts:538-541` (quoted in the drift
check): any rebind first tears down the existing subscription, so no
subscription can leak regardless of `addValue`/`mount` ordering. The swap path
itself (`addValue`, `VisualElement.ts:800-810`) removes the old value before
binding the new one, and `updateMotionValuesFromProps`
(`packages/motion-dom/src/render/utils/motion-values.ts:19-24`) routes swapped
props through `addValue`.

`828b8d9e5` added a listener-count test
(`animate-prop.test.tsx`, "Doesn't double-add listeners to externally-provided
motion values") but **not** the issue's swap scenario — this plan adds that as
the verification + regression gate. The issue's CodeSandbox (`sw4zn5`) is not
needed; the body describes the scenario completely.

## Commands

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Targeted tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-motion-value"` | all pass |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope**: `packages/framer-motion/src/value/__tests__/use-motion-value.test.tsx` (add one test).
**Out of scope**: any change to `VisualElement.ts` (the fix already exists). If verification fails, report — do not patch.

## Steps

### Step 1: Add the swap regression test

In `use-motion-value.test.tsx`, model on the existing `"accepts new motion values"`
test (it shows the `rerender` + `nextMicrotask` pattern; `nextMicrotask` is
imported from `../../gestures/__tests__/utils` — also import `nextFrame`):

```tsx
test("tracks the newly injected motion value after a swap (issue #2238)", async () => {
    const x1 = motionValue(0)
    const x2 = motionValue(100)
    const Component = ({ swap }: { swap: boolean }) => (
        <>
            <motion.div style={{ x: swap ? x2 : x1 }} />
            <motion.div style={{ x: swap ? x1 : x2 }} />
        </>
    )
    const { container, rerender } = render(<Component swap={false} />)
    rerender(<Component swap={false} />)
    rerender(<Component swap={true} />)
    await nextMicrotask()

    const [box1, box2] = Array.from(container.childNodes) as HTMLElement[]

    // box2 is now bound to x1; box1 to x2
    x1.set(50)
    await nextFrame()
    expect(box2).toHaveStyle("transform: translateX(50px)")
    expect(box1).toHaveStyle("transform: translateX(100px)")

    x2.set(75)
    await nextFrame()
    expect(box1).toHaveStyle("transform: translateX(75px)")
    expect(box2).toHaveStyle("transform: translateX(50px)")

    // Exactly one element subscription per value — no leaked binding
    expect((x1 as any).events.change.getSize()).toBe(1)
    expect((x2 as any).events.change.getSize()).toBe(1)
})
```

**Verify**: targeted test command → all pass, including the new test.

### Step 2: Prove the test can fail (repro gate — required by repo policy)

Temporarily delete the guard at `VisualElement.ts:539-541`
(`if (this.valueSubscriptions.has(key)) { this.valueSubscriptions.get(key)!() }`)
and re-run the targeted tests.

**Verify**: the new test (or the existing `"Doesn't double-add listeners..."`
test in `animate-prop.test.tsx`) FAILS. Then **restore the guard exactly**
(`git checkout -- packages/motion-dom/src/render/VisualElement.ts`) and re-run
→ all pass. If nothing fails with the guard removed, the double-bind path no
longer exists in current mount ordering — note that in your report; the test
still stands as coverage of the swap behavior, but say so honestly in the PR.

### Step 3: PR + gated close

Run `cd packages/framer-motion && yarn test-client` (no new failures vs main;
pre-existing: SSR `TextEncoder`, `use-velocity`) and `yarn lint`. Open a PR
with just the test, titled "Add regression test for swapped injected motion
values (#2238)" (footer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`).
Note: `gh pr edit` is broken on this repo — don't retry it; use
`gh api -X PATCH` if PR metadata must change.

**Only after the row for this plan in `plans/issues/README.md` is marked
APPROVED**:

```bash
gh api repos/motiondivision/motion/issues/2238/comments -f body="This was fixed in v11.4.0 (#2773): rebinding a motion value to a component now removes any existing subscription for that key first, so swapping which motion value is injected into a component rebinds correctly — including while animating. Verified with a regression test reproducing the swap scenario from this issue. Please reopen if you can still reproduce on motion@12."
gh api -X PATCH repos/motiondivision/motion/issues/2238 -f state=closed -f state_reason=completed
```

Otherwise set status `BLOCKED (awaiting approval)` after the PR.

## Done criteria

- [ ] New test exists, passes on `main`, and was observed failing with the guard removed (or the report documents that the double-bind path is gone).
- [ ] `VisualElement.ts` untouched (`git status`).
- [ ] PR opened; issue closed only per the APPROVED gate.
- [ ] `plans/issues/README.md` row updated.

## STOP conditions

- The new test FAILS on unmodified `main` → this is not fixed; reclassify as FIX and report (likely suspects: `addValue` at `VisualElement.ts:800-810` vs `bindToMotionValue` interplay).
- Drift check excerpt mismatch (the effects/VisualElement unification branch may have reshaped binding — see memory note on `worktree-style-effect`).
- Step 2's restored run leaves any test failing (incomplete restore).
