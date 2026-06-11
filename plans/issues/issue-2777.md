# Plan issue-2777: Close "motion custom component throws Cannot convert undefined or null to object" as needs-repro

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2777 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / needs-repro
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2777

## Verdict: NEEDS-REPRO — no sandbox, error signature comes from a removed code path, dependency is EOL

Reported 2024-08-29, 0 comments, **no CodeSandbox** (the template's "Without
one, this bug report won't be accepted" line is still in the body). The user
wraps NextUI v1's `Button` (`@nextui-org/react`) in `React.forwardRef` and
passes it to `motion(...)`; rendering throws:

```
TypeError: Cannot convert undefined or null to object
    at Function.assign  ←  Object.assign(...)
    at HTMLVisualElement.renderHTML [as renderInstance] (render.mjs:6:12)
```

Analysis against the working tree:

- The stack points at the old `renderHTML` which used
  `Object.assign(element.style, style)`. Current
  `packages/motion-dom/src/render/html/utils/render.ts:10-15` no longer calls
  `Object.assign`; it assigns style keys in a loop. The reported error
  *as written* cannot occur on motion@12.
- The underlying condition — the forwarded ref resolving to something without
  a `.style` (a component instance or a non-DOM "DOMRef" object, which NextUI
  v1 used in places) — would still crash today, just with a different message
  (`Cannot set properties of undefined`). `VisualElement.mount(instance)` and
  `renderHTML` do not guard against non-Element instances.
- NextUI v1 is end-of-life (project became HeroUI; v1 unmaintained since
  2023), so reproducing the exact original environment has little value.

Repo policy: no repro → no fix, and no speculative defensive guards landed
without a failing test. If a repro materialises on motion@12, the likely fix
shape is a dev-only invariant in `VisualElement.mount` (warn when `instance`
is not an `Element`) rather than guards inside `renderHTML`'s hot path — note
this for the future, do not implement now.

## Steps

### Step 1: Approval gate

Open `plans/issues/README.md`, find the issue-2777 row. If not APPROVED, mark
this plan BLOCKED and stop.

### Step 2: Comment + close

```
gh api repos/motiondivision/motion/issues/2777/comments -f body="Closing as this never received the minimal reproduction the template requires, and the stack trace points at a code path (Object.assign in renderHTML) that no longer exists in motion@12. The error means the ref your wrapper forwarded did not resolve to a DOM element — motion components need the ref to reach the underlying DOM node. NextUI v1 is unmaintained now; if you (or anyone) can reproduce a crash like this with motion@12 and a current UI library, please open a new issue with a CodeSandbox/StackBlitz and we'll take a look."
gh api -X PATCH repos/motiondivision/motion/issues/2777 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2777 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned` (only after APPROVED)
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- README row not APPROVED → BLOCKED.
- Do NOT write a speculative fix or test — per repo policy a fix requires a
  test that fails on a real reproduction.
