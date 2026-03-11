---
name: push
description: Add all uncommitted changes, commit with a message, and push to main branch. Quick way to save all work to GitHub.
---

# /push - Commit and Push All Changes

Quickly commit all uncommitted changes and push to GitHub.

## Workflow

### Step 0: Ensure API points to production server

Before committing, check `Components/ApiCalls.jsx`. The `sendWallDetectionRequest` function must use `server_urls.server` (not `server_urls.localhost`). If it references `localhost`, change it to `server` before staging.

### Step 1: Check Status

Run `git status` to see all modified and untracked files.

### Step 2: Stage All Changes

Run `git add -A` to stage all changes (modified, deleted, and untracked files).

### Step 3: Generate Commit Message

Look at the staged changes with `git diff --cached --stat` and generate a concise commit message that:
- Summarizes what changed in 1-2 lines
- Uses imperative mood ("Add", "Fix", "Update")
- Mentions key files or features affected

If $ARGUMENTS is provided, use that as the commit message instead of generating one.

### Step 4: Commit

Commit with the message, appending the co-author line:

```bash
git commit -m "$(cat <<'EOF'
<commit message here>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Step 5: Push

Push to the current branch:

```bash
git push origin HEAD
```

### Step 6: Confirm

Show the user:
- Commit hash
- Files changed
- Confirmation that push succeeded

## Usage Examples

- `/push` - Auto-generate commit message from changes
- `/push Fix bug in draft storage` - Use provided message
