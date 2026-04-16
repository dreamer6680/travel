# /pr — Create Pull Request

Automate the full Git workflow: stage changes → commit → push → open PR.

## Steps

1. Run `git status` to see all changed files.
2. Run `git diff HEAD` to review all staged and unstaged changes in detail.
3. Run `git log origin/main..HEAD --oneline` to see all commits on this branch that are not yet in main.
4. Analyze the diff and determine:
   - The nature of the change (feat / fix / refactor / chore / docs / test)
   - A concise summary (≤ 72 chars) for the commit subject
   - A short paragraph describing _why_ the change was made
5. Stage all changes: `git add -A`
6. Commit using a Conventional Commits message:

   ```
   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <subject>

   <body — why this change was necessary>
   EOF
   )"
   ```

7. Push to remote: `git push -u origin HEAD`
8. Create the PR with GitHub CLI:

   ```
   gh pr create \
     --base main \
     --title "<type>(<scope>): <subject>" \
     --body "$(cat <<'EOF'
   ## Summary
   - <bullet 1>
   - <bullet 2>
   - <bullet 3>

   ## Changes
   <brief description of what was changed and why>

   ## Test plan
   - [ ] Build passes: `mvn clean package -DskipTests`
   - [ ] Relevant tests pass: `mvn test`
   - [ ] Manually verified on local environment
   EOF
   )"
   ```

9. Print the PR URL so the user can open it immediately.

## Rules

- Never force-push to main/master.
- Never skip pre-commit hooks (`--no-verify`).
- Commit message must be in English.
- PR title and body must be in English.
- If there is nothing to commit AND no commits ahead of main, say so clearly and stop.
- Always use `--base main` when creating the PR.
