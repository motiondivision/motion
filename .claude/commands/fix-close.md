---
description: Remove current worktree and return to main repo
allowed-tools: Bash(git worktree:*), Bash(pwd:*), Bash(basename:*)
---

Close the current git worktree and return to the main repository.

## Steps

1. List all worktrees to identify the main repo: `git worktree list`
2. Get the current directory: `pwd`
3. Determine the main repo path (first entry in worktree list)
4. Tell me to close Claude and run these commands from outside:

```bash
cd <main-repo-path>
git worktree remove <current-worktree-path>
claude
```

Note: You cannot remove a worktree while inside it, so I need to close Claude first.
