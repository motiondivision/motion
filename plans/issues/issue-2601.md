# Plan issue-2601: Verify LazyMotion late-feature-load animations run (v12.28.2) and close with a design note on `initial`

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2601 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop. Confirm
> the excerpt below still matches
> `packages/framer-motion/src/motion/utils/use-visual-element.ts`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / verify-fixed (+ one decision-gated design question)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2601

## Verdict: VERIFY-FIXED for the functional bug; the remaining ask is a design decision

The issue (2024-03-29, 0 comments) bundles two things:

1. **Functional bug**: with async `LazyMotion` features,
   `<m.div initial={{opacity: 0}} animate={{opacity: 1}}>Hello</m.div>` stayed
   at `opacity: 0` — "there's no Hello printed" — i.e. the animation did not
   run when features resolved. The reporter's CodeSandbox (32vhxp) is behind
   Cloudflare and could not be fetched, but the inline description is complete.
2. **Design request**: don't apply `initial` styles at all until features load
   (FCP concern), and skip `initial` if the element mounted before features
   resolved.

Item 1 was addressed by commit `d8b7f5f2e` ("Fix LazyMotion animation not
firing when state changes before features load", fixes #2759, released
**v12.28.2**, 2026-01). It tracks whether the component committed before the
VisualElement existed and forces the mount animation:

`packages/framer-motion/src/motion/utils/use-visual-element.ts:84-86`:
```ts
if (hasMountedOnce.current && visualElementRef.current) {
    visualElementRef.current.manuallyAnimateOnMount = true
}
```
Existing coverage: `dev/react/src/tests/lazy-motion-fast-state.tsx` +
`packages/framer-motion/cypress/integration/lazy-motion-fast-state.ts` (uses
variants + a pre-load state change). The exact issue-2601 shape (plain
`initial`/`animate` objects, no state change) is *not* directly covered — Step 1
verifies it.

Item 2 is **by design**: `initial` is rendered into the `style` attribute
during render (server- and client-side) so the first paint never flashes the
animated end state; skipping it when features load late would introduce a
flash/hydration mismatch. That trade-off is inherent to code-splitting the
animation runtime and should be ruled on by the maintainer (expected ruling:
working as intended; users who need instant content should not put
`opacity: 0` in `initial`, or should load features synchronously).

## Steps

### Step 1: Verify the exact reported shape with a Cypress test

Create `dev/react/src/tests/lazy-motion-initial.tsx` (exporting `App`):
async `LazyMotion` (`features={() => new Promise(r => setTimeout(() =>
r(domAnimation), 100))}`) wrapping
`<m.div id="box" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
transition={{ duration: 0.1 }}>Hello</m.div>`. Model on
`dev/react/src/tests/lazy-motion-fast-state.tsx` (set a
`data-animation-complete` attribute in `onAnimationComplete`).

Create `packages/framer-motion/cypress/integration/lazy-motion-initial.ts`
asserting: initially opacity is `0`; after the features delay + animation,
`#box` has `data-animation-complete` and computed opacity `1`.

Run on **both React 18 and React 19** using the CLAUDE.md recipe (start Vite
directly in `dev/react` / `dev/react-19` on a random port, `cypress run
--headed --spec cypress/integration/lazy-motion-initial.ts`, React 19 with
`--config-file=cypress.react-19.json`).

**Verify**: spec passes on both React versions. If it fails → STOP and report:
the functional bug is NOT fully fixed and this issue needs a FIX plan rooted in
`use-visual-element.ts` / `AnimationFeature.mount`.

### Step 2: Keep the test, open a PR for it (regression coverage)

Branch `issue-2601-verify`, commit the two test files only. PR title:
"Add LazyMotion async-load initial animation test (closes #2601)". Note in the
body that the fix landed in v12.28.2 via #3501. (`gh pr edit` is broken on
this repo — if you need to edit, use `gh api -X PATCH repos/motiondivision/motion/pulls/<n>`.)

### Step 3: Approval gate

Open `plans/issues/README.md`, find the issue-2601 row. If not APPROVED, mark
this plan BLOCKED and stop.

### Step 4: Comment + close

```
gh api repos/motiondivision/motion/issues/2601/comments -f body="The functional part of this (animations not firing when LazyMotion features resolve after mount) was fixed in v12.28.2 — elements that mounted before features loaded now run their mount animation when features arrive, so content with initial={{opacity:0}} animate={{opacity:1}} becomes visible as soon as the bundle loads. Applying initial styles on first render is intentional: they must be present at first paint (and in SSR markup) to avoid a flash of the animated end state, which is the inherent trade-off of code-splitting the animation runtime. If first contentful paint matters more than the entrance animation, either load features synchronously or avoid hiding content via initial."
gh api -X PATCH repos/motiondivision/motion/issues/2601 -f state=closed -f state_reason=completed
```

**Verify**: state → `"closed"`.

## Done criteria

- [ ] Cypress spec passes on React 18 and 19
- [ ] Test files committed on a branch + PR opened
- [ ] Issue commented and closed (only after APPROVED)
- [ ] No files modified other than the two new test files
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Step 1 spec fails on either React version → report; do not close.
- README row not APPROVED → BLOCKED (close step only; Steps 1-2 may proceed).
