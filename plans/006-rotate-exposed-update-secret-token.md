# Plan 006: Rotate the exposed UPDATE_SECRET_TOKEN and add a secret-scanning CI gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- .circleci/config.yml scripts/notify-slack.js .gitignore`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **NEVER print, echo, cat, or commit the contents of `.env` or any secret
> value while executing this plan.** Reference key names only.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (the code changes are additive CI config; the rotation itself is a human/ops action)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `42bfbe3ed`, 2026-06-10

## Why this matters

A `.env` file containing `UPDATE_SECRET_TOKEN` was committed to this **public** repository in commit `42eefee25` ("Updating notify slack", 2025-12-10) and removed in commit `5e2dd4c50` ("Remove exposed .env file and add to .gitignore", 2026-01-05). The value remained in public git history for ~26 days and is still there permanently (history rewrites on a public repo with many forks are not practical — the token must be treated as burned).

The advisor verified by hash comparison (without printing values) that the `UPDATE_SECRET_TOKEN` in the maintainer's current local `.env` is **identical** to the exposed value — the token was never rotated. Anyone who saw the history can POST to `https://api.motion.dev/slack/update` with `Authorization: Bearer <token>` (see `scripts/notify-slack.js`) and push fake release notifications to the Motion Slack.

This plan has two parts: (1) a **human action** — rotate the token server-side (the executor cannot do this; it requires access to the motion-api backend); (2) an **executor action** — add a secret-scanning job to CI so a future `.env`/credential commit is caught before it lands.

## Current state

- `.env` — exists locally, untracked, correctly listed in `.gitignore` (lines containing `.env`). Holds `UPDATE_SECRET_TOKEN`, `FRAMER_API_KEY`, `FRAMER_PROJECT_ID` (key names only; never print values).
- `scripts/notify-slack.js:4` — `require("dotenv").config()`; around lines 80–95 it reads `process.env.UPDATE_SECRET_TOKEN` and sends it as a Bearer token to `https://api.motion.dev/slack/update` (or `http://localhost:8787/slack/update` in dev mode where the token defaults to `"test"`).
- `.circleci/config.yml` — jobs: `setup` (yarn install + build, persists workspace), `test`, `test-react`, `test-react-19`, `test-html`. Workflow `build` at the bottom of the file wires them together. There is **no** secret-scanning or lint job.
- Git history: `git log --all --oneline -- .env` → `5e2dd4c50` (removal), `42eefee25` (exposure). Do not attempt to rewrite or remove these commits.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Validate CircleCI YAML | `npx yaml-lint .circleci/config.yml` or `python3 -c "import yaml,sys; yaml.safe_load(open('.circleci/config.yml'))"` | exit 0 |
| Run gitleaks locally (if installed) | `gitleaks detect --source . --no-git --redact` | exit 0, no leaks in working tree |
| Confirm .env untracked | `git ls-files .env` | empty output |

## Scope

**In scope** (the only files you should modify):
- `.circleci/config.yml` — add a secret-scan job
- `.gitleaks.toml` (create) — scanner config/allowlist
- `plans/README.md` — status update

**Out of scope** (do NOT touch):
- `.env` — never read, print, move, or delete it.
- Git history — no rebase, no filter-branch, no BFG. The token is burned; rotation is the remedy.
- `scripts/notify-slack.js` — its env-var handling is fine; do not "improve" it.
- The motion-api backend (separate repo/service) — token rotation happens there, by the maintainer.

## Git workflow

- Branch: `advisor/006-secret-scan-ci`
- Single commit, message style matching repo (short imperative, e.g. "Add gitleaks secret scan to CI")
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0 (HUMAN — maintainer, not executor): Rotate the token

Generate a new `UPDATE_SECRET_TOKEN` in the motion-api service (the backend behind `api.motion.dev/slack/update`), update the local `.env`, and revoke the old value. Until this happens, the exposure is live. The executor should record in its final report that this step is pending human action unless told otherwise. Consider rotating `FRAMER_API_KEY` as well out of caution (it was in the same `.env` pattern, though only `UPDATE_SECRET_TOKEN` was confirmed in the exposed commit — verify with `git show 42eefee25:.env | sed 's/=.*/=<redacted>/'`, which prints key names only).

### Step 1: Add a gitleaks config

Create `.gitleaks.toml` at the repo root:

```toml
[extend]
useDefault = true

[allowlist]
description = "Known-burned historical exposure; remediation is rotation (plan 006), not history rewrite"
commits = ["42eefee25"]
```

**Verify**: `python3 -c "import tomllib; tomllib.load(open('.gitleaks.toml','rb'))"` → exit 0 (or visually confirm valid TOML if tomllib unavailable).

### Step 2: Add a secret-scan job to CircleCI

In `.circleci/config.yml`, add a job alongside the existing jobs (match the file's 4-space indentation style):

```yaml
    secret-scan:
        docker:
            - image: zricethezav/gitleaks:latest
        working_directory: ~/repo
        steps:
            - checkout
            - run:
                  name: Scan for committed secrets
                  command: gitleaks detect --source . --redact --verbose
```

And add it to the `workflows: build: jobs:` list (no `requires:` — it should run in parallel with `setup`):

```yaml
            - secret-scan
```

Note: `gitleaks detect` scans git history; the `.gitleaks.toml` allowlist from Step 1 prevents the known-burned commit from failing every build. If the gitleaks image entrypoint conflicts with CircleCI's expectations (CircleCI requires an image that can run a shell), use this fallback instead: a `cimg/base:current` image with an install step (`curl -sSfL https://github.com/gitleaks/gitleaks/releases/latest/download/... `) — or simplest reliable fallback, run gitleaks via Docker is not possible inside CircleCI docker executor, so prefer: image `cimg/go:1.22` with `go install github.com/zricethezav/gitleaks/v8@latest` then `gitleaks detect --source . --redact`. Pick whichever you can verify with the YAML check; document the choice in your report.

**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.circleci/config.yml'))"` → exit 0.

### Step 3: Local dry run (best effort)

If `gitleaks` is installed locally (`which gitleaks`), run `gitleaks detect --source . --redact`. Expected: exit 0 (the allowlisted commit is skipped; nothing else fires). If gitleaks is not installed locally, skip — CI will be the gate — and note the skip in your report.

**Verify**: command exits 0, or step explicitly skipped.

## Test plan

No unit tests — this is CI configuration. The verification gates are the YAML/TOML validity checks plus (if available) the local gitleaks dry run.

## Done criteria

- [ ] `.gitleaks.toml` exists with the `42eefee25` allowlist entry
- [ ] `.circleci/config.yml` parses as valid YAML and contains a `secret-scan` job wired into the `build` workflow
- [ ] `git ls-files .env` → empty (still untracked)
- [ ] No secret values appear in any file you created or in your report (`grep -rn "UPDATE_SECRET_TOKEN=" plans/ .gitleaks.toml` matches nothing with a value after `=`)
- [ ] Final report explicitly states whether Step 0 (rotation) was confirmed done by a human or remains pending
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any command output would display a secret value — kill the command and report.
- `git ls-files .env` is non-empty (the file became tracked again — that's a new incident, not part of this plan).
- The CircleCI config has drifted to a different structure (e.g. workflows renamed) and you cannot confidently place the new job.
- You find evidence of additional exposed credentials in history beyond commit `42eefee25` — report locations and credential types only.

## Maintenance notes

- The allowlist pins one commit. If gitleaks flags new historical commits after a future default-ruleset update, evaluate each: real leak → rotate + allowlist; false positive → add a targeted rule-level allowlist, not a blanket disable.
- When the maintainer rotates the token (Step 0), nothing in this repo needs changing — the value lives only in the untracked `.env` and the motion-api backend.
- A reviewer should scrutinize: that the CI job actually fails on a planted dummy secret (can be tested in a throwaway branch), and that no scan output prints raw values (`--redact` flag present).
