# Plan issue-2319: Decide and (if approved) make PopChild style injection target the rendered element's ownerDocument

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update
> (or add) this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2319 --jq .state` → expect `open`.
> Re-read the PopChild excerpts below against the live file; mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (fallback-only change; `root` prop keeps precedence)
- **Depends on**: maintainer decision (Step 1 gate)
- **Category**: feature
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2319

## Why this matters

Feature request (2023-08): apps that render React trees into a separate
window via `window.open()` get broken `popLayout`, because `PopChild` injects
its `<style>` element into the *main* window's `document.head`, which can't
affect elements living in the other window's document. The reporter proposed
using the element's `ownerDocument` and offered a PR.

**Key fact discovered during planning**: since the issue was filed, commit
`c1f485cf3` (2024-10-26) added a `root` prop to `AnimatePresence` —
`packages/framer-motion/src/components/AnimatePresence/types.ts:55-59`:
```ts
/**
 * Root element to use when injecting styles, used when mode === `"popLayout"`.
 * This defaults to document.head but can be overridden e.g. for use in shadow DOM.
 */
root?: HTMLElement | ShadowRoot;
```
A user can already pass the external window's `document.head` as `root`,
which likely satisfies the request manually. The remaining delta is making it
*automatic* via `ownerDocument`. So this plan starts with a decision gate.

## Current state

- `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx:115-121`:
  ```tsx
  ref.current.dataset.motionPopId = id

  const style = document.createElement("style")
  if (nonce) style.nonce = nonce

  const parent = root ?? document.head
  parent.appendChild(style)
  ```
  Both the `createElement` call and the `document.head` fallback use the
  module-global `document`. `ref.current` is guaranteed non-null at this point
  (guard at line 107).
- Reporter's prototype (may be stale, 2023):
  https://github.com/derekcicerone/motion/commit/fa699c8f578781427e1b1169fd29d1066958be68
- Shadow-DOM exemplars for the `root` prop: Cypress spec
  `packages/framer-motion/cypress/integration/animate-presence-pop-shadow-root.ts`
  + page `dev/react/src/tests/animate-presence-pop-shadow-root.tsx`.
- Note: modern browsers auto-adopt a node created in one document when it is
  appended into another, but using `ownerDocument.createElement` is the
  correct, explicit form.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| Jest | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence|PopChild"` | pass |
| Cypress | CLAUDE.md § "Running Cypress tests locally", specs `animate-presence-pop.ts`, `animate-presence-pop-shadow-root.ts`, React 18 AND 19 | pass |

## Scope

**In scope** (only on APPROVED-IMPLEMENT):
- `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx` (lines 115–121 only)
- `packages/framer-motion/src/components/AnimatePresence/__tests__/PopChild-owner-document.test.tsx` (create)
- `CHANGELOG.md`

**Out of scope**: any `StyleSheetManager`/provider-style API (reporter listed
alternatives; the `root` prop already covers explicit control); changing
`root` precedence; portal handling elsewhere in the library.

## Steps

### Step 1: Decision gate

Check this plan's row in `plans/issues/README.md`:
- `APPROVED-IMPLEMENT` → Steps 2–4.
- `APPROVED-CLOSE` → Step 5 (answer + close).
- Anything else → set row to `BLOCKED("awaiting maintainer decision:
  implement ownerDocument default vs close as satisfied by root prop")`,
  post nothing, stop.

Recommendation for the maintainer: implement. It is ~2 lines, strictly more
correct (`root ?? ownerDocument.head` preserves the explicit override), and
also fixes iframes for free.

### Step 2 (implement): Failing test first

JSDOM can host a second document: `document.implementation.createHTMLDocument()`
or an `<iframe>`'s `contentDocument`. New Jest test
`PopChild-owner-document.test.tsx`:
- Render `<AnimatePresence mode="popLayout">` content via
  `ReactDOM.createPortal` (or directly with a container) into an element that
  belongs to an iframe's `contentDocument` appended to the main DOM.
- Trigger an exit (remove the child, `act` + frame flush per existing
  AnimatePresence tests).
- Assert a `<style>` element containing `data-motion-pop-id` rule text exists
  in the **iframe document's** head, and none was added to the main
  `document.head`.

**Verify**: fails on unmodified main (style lands in main `document.head`).
If JSDOM's iframe document proves unusable after 2–3 attempts, fall back to
`createHTMLDocument` + manually mounting; if that also can't host a React
render, STOP and report (a Cypress page with a same-origin iframe is the
escalation, modeled on `animate-presence-pop-shadow-root.tsx`).

### Step 3 (implement): Change

```tsx
const doc = ref.current.ownerDocument || document
const style = doc.createElement("style")
if (nonce) style.nonce = nonce

const parent = root ?? doc.head
parent.appendChild(style)
```
(`root` keeps precedence; behavior is identical for the 99% case where
`ownerDocument === document`.)

**Verify**: Step 2 test passes; full Jest pattern passes; Cypress
`animate-presence-pop.ts` + `animate-presence-pop-shadow-root.ts` green on
React 18 and 19; `yarn build` exit 0. Add CHANGELOG entry under
`## Unreleased` → `### Added` (or `### Fixed`, match file style).

### Step 4 (implement): PR

`gh pr create` referencing #2319 and crediting the reporter's original
prototype commit. (`gh pr edit` is broken — `gh api -X PATCH .../pulls/<n>`.)

### Step 5 (close path): Answer + gated close

Comment: the `root` prop (shipped after this issue, `c1f485cf3`) lets you pass
the external window's `document.head`/container —
`<AnimatePresence mode="popLayout" root={externalDoc.head}>` — and link the
shadow-root example. Then close with
`gh api -X PATCH repos/motiondivision/motion/issues/2319 -f state=closed -f state_reason=completed`
(fallback if `gh issue close` fails). Only with APPROVED-CLOSE on the README
row — otherwise BLOCKED, stop.

## Done criteria

- [ ] Decision gate honored (no action without an APPROVED-* row)
- [ ] Implement path: new test fails pre-change / passes post-change; suites + build green; CHANGELOG updated
- [ ] Close path: comment posted, issue closed as completed
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- README row has no APPROVED-* marking (gate above).
- The excerpt at PopChild.tsx:115-121 has drifted.
- JSDOM cannot host the second-document render after the documented fallbacks.
- Any existing pop/shadow-root test breaks.

## Maintenance notes

- If a future "render into portal window" guide is written for motion.dev,
  document both `root` and the automatic `ownerDocument` behavior.
- `PopChildMeasure` reads `getComputedStyle(element)` (global) at
  `PopChild.tsx:50` — JSDOM tolerates cross-document elements there, but if
  separate-window users report measurement bugs later, switch it to
  `element.ownerDocument.defaultView.getComputedStyle` in a follow-up.
