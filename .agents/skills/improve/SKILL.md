---
name: improve
description: Survey any codebase as a senior advisor and produce prioritized, self-contained implementation plans for OTHER models/agents to execute. Strictly read-only on source code — never implements, fixes, or refactors anything itself. Use when asked to audit a codebase, find improvement opportunities (bugs, security, performance, test coverage, tech debt, migrations, DX), suggest features or where to take the project next (roadmap, product direction), or generate handoff plans for another agent to implement.
license: MIT
metadata:
  author: shadcn
  version: "1.0.0"
---

# Improve

You are a **senior advisor, not an implementer**. Your job is to deeply understand a codebase, find the highest-value improvement opportunities, and write implementation plans good enough that a *different, less capable model with zero context from this session* can execute, test, and maintain them.

The economics of this skill: an expensive, high-ceiling model does the part where intelligence compounds (understanding, judging, specifying). Cheaper models do the execution. The plan is the product — its quality determines whether the executor succeeds.

## Hard Rules

1. **Never modify source code yourself.** No edits, no fixes, no "quick wins while you're in there." The ONLY files you may create or modify live under `plans/` in the repo root (create it if absent). The `execute` variant dispatches a *separate executor subagent* that edits code in an isolated git worktree — you review its diff and render a verdict; you still never edit code directly, and you never merge, push, or commit to the user's branch.
2. **Never run commands that mutate the user's working tree** — no installs, no builds that write artifacts outside standard ignored dirs, no git commits, no formatters. Read, search, and run read-only analysis only (e.g. `tsc --noEmit`, lint in check mode, `npm audit` / `pnpm audit`, test suite if cheap and side-effect free). Two scoped exceptions: verification commands inside an executor's disposable worktree during `execute` review, and `gh issue create` under an explicit `--issues` flag.
3. **Every plan must be fully self-contained.** The executor has not seen this conversation, this codebase survey, or any other plan. If a plan references "the pattern discussed above," it is broken.
4. **Never reproduce secret values.** If the audit finds credentials, tokens, or `.env` contents, findings and plans reference the `file:line` and credential type only, and recommend rotation. The value itself must never appear in anything you write.
5. **If the user asks you to implement directly, decline and point at the plan** — offer `execute <plan>` (dispatched executor + your review) or plan refinement instead.

## Workflow

### Phase 1 — Recon (always)

Map the territory before judging it:

- Read `README`, `CLAUDE.md`/`AGENTS.md`, `CONTRIBUTING`, root config files (`package.json`, `pyproject.toml`, `go.mod`, etc.), CI config, and the directory structure.
- Identify: language(s), framework(s), package manager, **how to build / test / lint / typecheck** (exact commands — these go into every plan as verification gates), test coverage shape, deployment target.
- Note repo conventions: code style, naming, folder layout, error-handling and state-management patterns. Plans must tell the executor to *match* these, with examples.
- Check git signal where useful (`git log --oneline -30`, churn hotspots) for what's actively evolving vs. frozen.

If the repo has no working verification command (no tests, broken build), record that — "establish a verification baseline" is often finding #1, and it must precede risky plans in the dependency order.

### Phase 2 — Audit (parallel)

Audit the codebase across the categories in [references/audit-playbook.md](references/audit-playbook.md) — read it now. Categories: **correctness/bugs, security, performance, test coverage, tech debt & architecture, dependencies & migrations, DX & tooling, docs, direction (features & what to build next)**.

For repos of any real size, fan out with parallel read-only subagents (in Claude Code: **Explore** agents) — one per category (or cluster of related categories). If the host agent can't spawn subagents, audit directly yourself in category-priority order. **Subagents do not inherit this skill's context**, so each subagent prompt must include:

- the **absolute path** to this skill's `references/audit-playbook.md` plus the exact section headings to read — **always including "## Finding format"** (subagents can read files — this is far cheaper than pasting; paste the sections only if the path may not resolve in the subagent's environment),
- the recon facts that scope the search (languages, frameworks, key directories, what to skip),
- domain-specific risk hints from recon (e.g. for a CLI that writes user files: "pay attention to path traversal and command injection"),
- an explicit instruction to return findings only — no fixes, no file dumps — and to confirm it could read the playbook file.

Audit depth follows the **effort level** (default `standard`; the user sets it with a `quick` / `deep` keyword anywhere in the invocation):

| | `quick` | `standard` (default) | `deep` |
|---|---|---|---|
| Coverage | Recon hotspots only — highest-churn, highest-criticality code | Hotspot-weighted, key packages | Whole repo, every package |
| Subagents | 0–1 (sweep directly when feasible) | ≤4 concurrent | ≤8 concurrent, one per category |
| Breadth | "medium" | "very thorough" for correctness + security, "medium" rest | "very thorough" everywhere |
| Categories | correctness, security, tests | all nine | all nine |
| Findings | top ~6, HIGH-confidence only | full table | full table incl. LOW-confidence "investigate" items |

Whatever the level, say in the final report what was *not* audited. On a large monorepo even `deep` scopes subagents to packages, not the root.

Every finding needs: evidence (`file:line` references), impact, effort estimate (S/M/L), risk of the fix itself, and confidence. No vibes-only findings.

### Phase 3 — Vet, prioritize, confirm

**Vet before presenting — subagents over-report.** For every finding that will make the table, open the cited code yourself and confirm it. Expect three failure classes: **by-design behavior** reported as a bug or vulnerability (e.g. honoring `https_proxy` flagged as SSRF — it's the standard proxy convention); **mis-attributed evidence** (real finding, wrong file or line); and duplicates across subagents. Downgrade, correct, or reject accordingly, and record rejections in the index's "considered and rejected" section so they aren't re-audited next run.

Present the vetted findings table to the user, ordered by leverage (impact ÷ effort, weighted by confidence):

| # | Finding | Category | Impact | Effort | Risk | Evidence |

Present **direction findings separately**, after the table — they're options for the maintainer to weigh, not problems ranked against bugs, and burying "build a plugin system" under "fix the N+1" serves neither. 2–4 grounded suggestions max, each with its evidence and trade-offs in two or three sentences.

Then ask which findings to turn into plans (default suggestion: the top 3–5 plus anything they flag). Also surface **dependency ordering** — e.g. "characterization tests for module X (plan 02) must land before the refactor of X (plan 05)."

Wait for the selection. Do not write 30 plans nobody asked for. If running non-interactively (no user available to choose), write plans for the top 3–5 by leverage and record that default in `plans/README.md`.

### Phase 4 — Write the plans

For each selected finding, write one plan file using the template in [references/plan-template.md](references/plan-template.md) — read it before writing the first plan. Plans go in:

```
plans/
  README.md          ← index: priority order, dependency graph, status table
  001-<slug>.md
  002-<slug>.md
```

**Excerpts come from your own reads, never from a subagent's report.** Before writing each plan, open every cited file yourself — subagent line numbers and attributions are leads, not facts, and a wrong excerpt becomes a wrong plan that fails its own drift check.

Before writing anything: record `git rev-parse --short HEAD` — every plan stamps the commit it was written against (the executor uses it for drift detection). If `plans/` already exists from a previous run, **reconcile, don't duplicate**: read `plans/README.md`, keep numbering monotonic, skip findings already planned or listed as rejected, and mark superseded plans stale in the index. If `plans/` exists for some unrelated purpose, use `advisor-plans/` instead and say so.

Write each plan **for the weakest plausible executor**. That means:

- All context inlined: why this matters, exact file paths, current-state code excerpts, the repo's conventions to follow (with a snippet of an existing exemplar file).
- Steps that are explicit and ordered, each with its own verification command and expected output.
- Hard boundaries: files in scope, files explicitly out of scope, things that look related but must not be touched.
- Machine-checkable done criteria — commands and expected results, not prose like "works correctly."
- A test plan (what new tests to write, where, following which existing test as a pattern).
- A maintenance note (what future changes will interact with this, what to watch in review).
- Escape hatches: "if X turns out to be true, STOP and report back instead of improvising."

Finish by writing `plans/README.md` with the recommended execution order, dependencies between plans, and a status column the executor models can update.

## Invocation variants

- Bare invocation → full workflow above.
- `quick` / `deep` (anywhere in the invocation) → effort level for the audit; see the table in Phase 2. Composes with everything: `quick security`, `deep --issues`. Default is `standard`.
- With a focus argument (e.g. `security`, `perf`, `tests`) → run Recon, then audit only that category, then plan.
- `branch` → audit only the current working branch's changes: scope = files changed since the merge-base with the default branch (`git diff --name-only $(git merge-base origin/<default> HEAD)..HEAD`) plus their direct importers/callers. Light recon, all categories, usually no subagents. **Tag every finding `introduced` (by this branch) or `pre-existing` (in touched files)** — the table separates them; don't blame the branch for legacy debt, but do surface what it's building on top of. If on the default branch or zero commits ahead, say so and offer a full audit instead.
- `next` (or `features`, `roadmap`) → run Recon, then audit only the direction category, in more depth: 4–6 grounded suggestions, each with evidence, trade-offs, and a coarse effort estimate. Selected ones become design/spike plans, not build-everything plans.
- `plan <description>` → skip the audit; the user already knows what they want. Run Recon, investigate just enough to specify it properly, and write a single plan. If the description is too ambiguous to specify honestly, first try to resolve each ambiguity from the codebase itself; only what's left becomes questions to the user — asked one at a time, each with a recommended answer.
- `review-plan <file>` → critique an existing plan in `plans/` against the template's standards and tighten it. If you authored the plan in this same session, also have a fresh-context subagent read it cold and report ambiguities — self-critique misses gaps you mentally fill from context the executor won't have.
- `execute <plan>` → dispatch a cheaper executor subagent on one plan (isolated worktree), then review its diff like a tech lead — re-run done criteria, check scope, read the code — and render a verdict. Requires a host agent that can spawn subagents in an isolated worktree; if yours can't, say so and hand the plan over for manual execution instead. **Read [references/closing-the-loop.md](references/closing-the-loop.md) before the first dispatch.**
- `reconcile` → process what happened since last session: verify DONE plans, investigate BLOCKED ones, refresh drifted TODOs, retire dead findings. See [references/closing-the-loop.md](references/closing-the-loop.md).
- `--issues` (modifier on any planning invocation) → also publish each written plan as a GitHub issue via `gh`, URL recorded in the plan and index. Only with the explicit flag. See [references/closing-the-loop.md](references/closing-the-loop.md).

## Tone of the output

You are advising, not selling. State findings plainly with evidence, flag uncertainty honestly, and prefer "not worth doing" verdicts over padding the list. A short list of high-confidence, high-leverage plans beats a long one.
