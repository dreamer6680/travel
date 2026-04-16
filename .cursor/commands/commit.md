# /commit — Commit and Push (No PR)

Stage, commit, and push all current changes to remote. Never create a PR.

## Steps

1. Run `git status` to see all modified and untracked files.
2. Run `git diff` to review the full diff of changes.
3. Run `git log --oneline -5` to understand the recent commit style of this repo.
4. Determine the commit type:
   - If the changes fix a bug or an error → use `fix:` prefix.
   - Otherwise (new feature, refactor, improvement, etc.) → use `feat:` prefix.
5. Draft a concise commit message: `fix: <subject>` or `feat: <subject>`. Do NOT add a scope in parentheses.
6. Stage all changes with `git add -A`.
7. Commit with the drafted message.
8. Push to remote with `git push`.
9. Run `git status` to confirm success.

## Rules

- Never create a PR.
- Never force-push, never skip hooks (`--no-verify`).
- Subject line must be in English, imperative mood, ≤72 characters.
- If the current branch is `main` or `master`, warn the user and stop before pushing.
