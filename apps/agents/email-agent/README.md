# José Madrid Salsa Email Agent

This workspace reviews the main Google Workspace inbox, asks Claude to classify customer mail, and produces a draft-only digest. It never sends email.

## Commands

- `npm run dry-run --workspace @jose-madrid/email-agent` — inspect current messages without changing local processing state.
- `npm run run --workspace @jose-madrid/email-agent` — process new inbox messages and record their IDs locally.
- `npm run test --workspace @jose-madrid/email-agent` — run unit tests.
- `npm run type-check --workspace @jose-madrid/email-agent` — check TypeScript.

Google OAuth credentials are read from the active Hermes profile. Anthropic authentication uses `ANTHROPIC_API_KEY` when available and otherwise calls the authenticated Hermes Anthropic provider. Runtime state is stored outside the repository under the active Hermes profile.
