# Plan issue-2504: Request a reproduction for hover stop/start slowdown; gated needs-repro close

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2504 --jq .state` → expect `open`. If closed, STOP.

## Status

- **Classification**: NEEDS-REPRO
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (no code change permitted by this plan)
- **Depends on**: none (cross-references `plans/issues/issue-2500.md` regression tests)
- **Category**: support / needs-repro
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2504

## Why this matters

Reported Jan 2024: "spam hover" on a box pauses/starts a progress-bar animation
and it "slows down"; reporter expects resume to take exactly the remaining time.
Two later +1 comments (2024-11, 2026-02). The sandbox
(`codesandbox.io/p/sandbox/framer-custom-slider-dots-forked-q1wr4`) is
**inaccessible during planning** — both the legacy API
(`codesandbox.io/api/v1/sandboxes/q1wr4`) and the page return Cloudflare
403/challenge — so the actual API usage is unknown, and it decides everything:

- If the handlers call `controls.pause()` / `controls.play()`: that path
  preserves remaining time exactly on current code (verified empirically at
  `42bfbe3ed`, and being pinned by the `#2500` regression tests in
  `plans/issues/issue-2500.md`). A 2024 version may have shown drift, fixed since.
- If the handlers call `.stop()` (or re-trigger variants/`animate()`) on
  hover-end: starting a **new** animation from the interrupted value with the
  full configured `duration` is **by design** — keyframes re-resolve from the
  current value and the full duration applies to the remaining distance, which
  reads as "slowing down". The answer is to use `pause()`/`play()`.

Repo policy: **no repro → no fix** — without the sandbox code we must not guess
a defect or land speculative coverage.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Re-try sandbox (once) | `curl -s --max-time 20 "https://codesandbox.io/api/v1/sandboxes/q1wr4" \| head -c 400` | JSON with `modules` (else Cloudflare HTML) |
| Comment | `gh issue comment 2504 --body-file <file>` | comment URL |
| Close (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2504 -f state=closed -f state_reason=not_planned` | closed |

## Scope

**In scope**: one issue comment; gated close; this plan's README row.
**Out of scope**: ANY source/test change. If the sandbox turns out to show a
real pause/play timing defect, STOP and report — that becomes a new FIX plan.

## Steps

### Step 1: One more fetch attempt

Run the curl above (and only that — don't burn time on scraping workarounds).
If it returns module sources, read the hover handlers and re-classify per the
two branches in "Why this matters"; report back instead of continuing if a real
defect is visible.

### Step 2: Comment asking for the code

Post a comment covering:
- The sandbox is no longer accessible to maintainers; ask for the relevant
  component inline (hover handlers + the `animate`/`useAnimation` call) or a
  fresh sandbox on a current `motion` release.
- Explain the expected-behavior split: `controls.pause()`/`controls.play()`
  resumes with the remaining time (now covered by regression tests); calling
  `.stop()` and re-starting creates a *new* animation that re-resolves from the
  current value with the full `duration` — by design, and the likely cause of
  the observed "slowdown".
- If pause/play is what they use and a current release still misbehaves, ask for
  version + repro and the issue will be re-triaged.

### Step 3: Gated close

ONLY after this plan's row in `plans/issues/README.md` is marked **APPROVED**:
`gh api -X PATCH repos/motiondivision/motion/issues/2504 -f state=closed -f state_reason=not_planned`
(needs-repro: no reproduction obtainable; likely usage of restart semantics).
If not APPROVED, set the row to BLOCKED("awaiting close approval") and stop.

## Done criteria

- [ ] Fetch attempted once and outcome recorded in the report
- [ ] Comment posted with both behavior branches and a repro request
- [ ] Close performed only under an APPROVED row; `git status` clean
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 1 retrieves code showing `pause()`/`play()` usage that still misbehaves
  on current code — report back for a FIX plan instead of closing.
- Issue already closed at drift-check.
