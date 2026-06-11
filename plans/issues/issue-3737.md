# Plan issue-3737: Leave "mcp usage bug" with the maintainer (motion-studio-mcp lives outside this repo; thread is active)

> **Executor instructions**: This plan's outcome is NO executor action beyond
> verifying state. Do not close, do not comment, do not modify source. Update
> the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/3737 --jq .state`
> → expect `"open"`. If closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support (out-of-repo, maintainer-owned)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/3737

## Verdict: SUPPORT, out-of-repo — no executor action; not spam, do NOT close

Filed 2026-05-25. Not about the motion library at all: the reporter cannot run
the **Motion Studio MCP server** (`motion-studio-mcp`, installed via
`npx https://api.motion.dev/registry.tgz?package=motion-studio-mcp`) — the
`sharp` native module fails to load (`darwin-arm64` runtime, Node v25.6.1, npx
cache), and later `npx motion-ai` fails with `fetch failed` during
"Fetching skills".

Why an executor must leave this alone:

- **The code is not in this repository.** `ls packages/` at `42bfbe3ed` shows
  `config`, `framer-motion`, `motion`, `motion-dom`, `motion-utils` — no MCP
  server, no `motion-ai` installer, no `sharp` dependency anywhere in the
  workspace. The package is distributed from the private `api.motion.dev`
  registry. No failing test or fix is possible here.
- **The maintainer is actively driving it.** mattgperry has replied four times
  (2026-05-26 → 2026-05-27), shipping `5.4.4`, the `npx motion-ai` installer,
  and a cache-clearing `motion-ai@13.1.0`. The last comment (2026-05-27,
  reporter ddtch) reports a remaining `fetch failed` during "Fetching skills"
  and awaits the maintainer's next move — likely server-side at
  api.motion.dev.
- It is therefore NOT spam/stale: classify as a live support thread that simply
  has no surface in this codebase. Closing it out from under an active
  maintainer conversation would be wrong.

## Steps

### Step 1: Verify the thread is still in the same state

`gh api repos/motiondivision/motion/issues/3737/comments --jq '.[-1] | {user:.user.login, created:.created_at}'`
→ if the last comment is still ddtch's 2026-05-27 `fetch failed` report (or a
newer maintainer reply), there is nothing for an executor to do.

### Step 2: Record the outcome

Set this plan's row in `plans/issues/README.md` to
`DONE (no action — out-of-repo support thread owned by maintainer)`.

Optional, only if the maintainer asks: the actionable signal worth relaying is
that the residual failure is a `fetch failed` while "Fetching skills" in
`motion-ai@13.1.0` — i.e. an api.motion.dev/network concern, plus the original
`sharp` darwin-arm64 optional-dependency install under Node 25's npx cache.

## Done criteria

- [ ] No comment posted, issue state untouched (`gh api ... --jq .state` → `"open"` unless the maintainer closed it)
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated with the no-action rationale

## STOP conditions

- If anyone proposes closing this issue: per the gate convention, that requires
  the plans/issues/README.md row to be explicitly marked APPROVED for closure —
  and given the active maintainer thread, recommend against it; report back
  instead.
