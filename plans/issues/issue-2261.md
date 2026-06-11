# Plan issue-2261: Close Electron `webSecurity: false` slow-animation report (Electron/Chromium environment, not Motion)

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2261 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support/close
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2261

## Verdict: INVALID/SUPPORT — close

Filed July 2023: in an Electron app, setting `webSecurity: false` makes
framer-motion (and, per the reporter, **Motion One as well**) animations slow
and start ~400ms late in production builds. The reporter says "I'm not sure if
this is due to Framer Motion / Motion or Electron". Why this is not a Motion
issue:

- The single toggled variable is an **Electron BrowserWindow flag**.
  `webSecurity: false` flips Chromium command-line switches that are documented
  to affect renderer scheduling/compositing behaviour. Two independent
  animation libraries degrading identically under the same flag means the
  regression sits below both — in Electron/Chromium — not in either library.
- Motion has no code path that reads or reacts to web-security settings; there
  is nothing in this repo to change, and no failing test can be written
  (repo policy: no repro implicating Motion → no fix; we have no Electron
  BrowserWindow harness).
- Zero comments since filing (2023); Electron 25 is long EOL.

## Steps

### Step 1: Approval gate

Open `plans/issues/README.md` and find the row for issue-2261. If the row is
not marked APPROVED, set this plan's status to BLOCKED in
`plans/issues/README.md` and stop.

### Step 2: Comment + close

```
gh api repos/motiondivision/motion/issues/2261/comments -f body="Closing: the only variable here is Electron's webSecurity flag, and per your own repro it affects Framer Motion and Motion One identically — which places the regression in Electron/Chromium's renderer behaviour under that flag rather than in either library. There's no Motion code path that interacts with web-security settings, so there's nothing actionable in this repo; this would be worth raising against Electron with a vanilla WAAPI/rAF benchmark. If a current Electron + motion@12 combination shows Motion specifically misbehaving (e.g. vanilla element.animate is fine but Motion is slow), please open a new issue."
gh api -X PATCH repos/motiondivision/motion/issues/2261 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2261 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned`
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- New evidence that vanilla WAAPI/rAF animations are unaffected under
  `webSecurity: false` while Motion's are — that would implicate Motion's
  driver/WAAPI selection and reopen this as a real investigation.
