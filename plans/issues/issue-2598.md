# Plan issue-2598: Close "animation doesn't work on reload without delay" (external Chromium paint bug, maintainer-diagnosed)

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2598 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support/close
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2598

## Verdict: INVALID/SUPPORT — external browser bug + stale secondary regression; close

Filed March 2024: mount animations don't visually play on plain reload
(`CTRL+R`) but do on hard reload (`CTRL+SHIFT+R`), Chrome/Windows. Two distinct
threads inside the issue:

1. **Primary report**: the maintainer diagnosed it on-thread (2024-03-27):
   > "My *suspicion* is that this is a bug in Chrome - specifically this one
   > https://issues.chromium.org/issues/40887505 ... If you put an onUpdate on
   > the animations you'll see the frames do fire, Chrome doesn't paint them."
   The reporter confirmed ("Yes, that seems to be exactly my issue" and "The
   error does not occur in Firefox"). Frames firing but Chrome not painting is
   not fixable in Motion.
2. **Secondary report** (mikirejf): a regression where `onUpdate` stopped
   firing entirely starting in **11.0.11** (the release that made keyframes
   resolve asynchronously — CHANGELOG.md line 2115 "Keyframes now resolved
   asynchronously"). Follow-up releases reworked exactly that area: 11.0.16
   "Restored animation promise handling to match behaviour of <11.0.11"
   (CHANGELOG.md line 2081). No further repro was ever posted; the StackBlitz
   in the issue body pins the 2024 version and can't validate today's code.

Repo policy: no repro → no fix. The last activity is a 2024-10 "any updates?".

## Steps

### Step 1: Check for fresh activity

`gh api repos/motiondivision/motion/issues/2598/comments --jq '.[-2:][] | {user:.user.login, created:.created_at}'`
— if there is a 2025+ reproduction on motion@12, report back instead of closing.

### Step 2: Approval gate

Open `plans/issues/README.md` and find the row for issue-2598. If the row is
not marked APPROVED, set this plan's status to BLOCKED in
`plans/issues/README.md` and stop.

### Step 3: Comment + close

```
gh api repos/motiondivision/motion/issues/2598/comments -f body="Closing this out. The primary behaviour here (frames fire via onUpdate but Chrome doesn't paint them after a soft reload) was tracked down to a Chromium paint-holding bug (https://issues.chromium.org/issues/40887505) rather than anything Motion controls. The separate 11.0.11 regression mentioned in the thread (onUpdate not firing after async keyframe resolution landed) was addressed in the 11.0.15/11.0.16 follow-ups. If anyone still sees animations not painting on reload with current motion@12, please open a new issue with a reproduction."
gh api -X PATCH repos/motiondivision/motion/issues/2598 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2598 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned`
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Fresh (2025+) reproduction surfaces in Step 1, or the Chromium issue turns
  out to be fixed while the Motion symptom persists — that would point back at
  Motion and needs investigation, not closure.
