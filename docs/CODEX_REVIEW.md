# Codex Pull Request Reviews

Codex is an automated reviewer that keeps pull requests honest by checking that the described intent matches the code that was actually changed.

## When the bot runs

- **Automatically** when a PR is opened, reopened, marked ready for review, or updated with new commits.
- **On demand** when any collaborator comments `@codex` inside the PR conversation. This is handy after force-pushes or when you want a fresh verdict without pushing new code.

Each run installs dependencies, executes `npm run lint` and `npm run type-check`, and then leaves (or updates) a single comment titled “Codex Review”.

## What the review includes

The comment contains:

1. **Trigger + author** – whether it was automatic or requested manually and who opened the PR.
2. **Intent block** – a quoted snippet from the PR body, or a warning if the PR description is empty.
3. **Change summary** – number of files/additions/deletions plus the base ➜ head branch labels.
4. **Impacted areas** – top directories touched by the diff so reviewers can jump straight to the interesting folders.
5. **Intent vs. changes** – highlights when the described intent never mentions impacted folders so authors know to update their summary.
6. **Automated checks** – pass/fail status for linting and type-checking (the workflow still posts its findings even when a command fails).

> ℹ️ The bot does **not** run the full test suite yet. Tests remain part of the regular CI workflow.

## Requesting another review

1. Push your updates (or amend commits).
2. Comment `@codex` on the PR.
3. Wait for the workflow to finish—if the comment does not appear, check the **Actions → Codex PR Review** run for errors.

Codex overwrites its previous comment, keeping PR threads tidy while preserving a history inside the Actions tab.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| No comment appears | Ensure the **Codex PR Review** workflow ran and completed. Draft PRs still run, but closed PRs are ignored. |
| Workflow fails before posting | Inspect the failing step (often `npm ci`). Fix the underlying issue and rerun with `@codex`. |
| Intent mismatch warning feels noisy | Update the PR body to mention the main directories or modules you touched. This helps human reviewers too. |

For questions or enhancements, open an issue or update this document with the desired behavior.
