---
description: Create a new git worktree with a feature branch
argument-hint: <branch-name>
allowed-tools: Bash(git worktree:*), Bash(pwd:*), Bash(basename:*)
---

Create a new git worktree for working on branch `$ARGUMENTS`.

## Steps

1. Get the repo name from the current directory
2. Create a new git worktree at `../<repo>-$ARGUMENTS` with branch `$ARGUMENTS`
3. Show the path and prompt me to close Claude and reopen in the new worktree

Run these commands:
```bash
REPO_NAME=$(basename $(pwd))
git worktree add ../${REPO_NAME}-$ARGUMENTS -b $ARGUMENTS
```

Then tell me to close Claude and reopen with:
```bash
cd ../<repo>-$ARGUMENTS && claude --dangerously-skip-permissions
```
