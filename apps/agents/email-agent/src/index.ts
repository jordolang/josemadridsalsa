import { homedir } from 'node:os';
import { join } from 'node:path';

import { analyzeMessage } from './anthropic.js';
import { classifyEmail } from './classifier.js';
import { buildDigest, unanalyzedItem, type DigestItem } from './digest.js';
import { getMessage, searchInbox } from './gmail.js';
import { loadState, saveState, selectNewMessages } from './state.js';

const QUERY =
  process.env.EMAIL_AGENT_QUERY ??
  'in:inbox newer_than:7d -category:promotions -category:social';
const MAX_MESSAGES = Number.parseInt(process.env.EMAIL_AGENT_MAX ?? '25', 10);
// Processed mail stays in the inbox, so search a wider window than we analyze;
// otherwise the newest already-processed messages fill the cap every run.
const SEARCH_MAX = Number.parseInt(process.env.EMAIL_AGENT_SEARCH_MAX ?? '500', 10);
const STATE_PATH =
  process.env.EMAIL_AGENT_STATE_PATH ??
  join(process.env.HERMES_HOME ?? join(homedir(), '.hermes'), 'email-agent/state.json');

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const state = await loadState(STATE_PATH);
  const envelopes = await searchInbox(QUERY, Math.max(SEARCH_MAX, MAX_MESSAGES));
  const newEnvelopes = selectNewMessages(
    envelopes,
    new Set(state.processedMessageIds),
    MAX_MESSAGES,
  );

  if (newEnvelopes.length === 0) {
    process.stdout.write(
      '# José Madrid Salsa email review\n\nNo new matching customer emails. No email was sent.\n',
    );
    return;
  }

  const digestItems: DigestItem[] = [];
  const failedIds = new Set<string>();
  for (const envelope of newEnvelopes) {
    let message;
    let decision;
    try {
      message = await getMessage(envelope.id);
      const heuristic = classifyEmail({
        subject: message.subject,
        body: message.body,
        from: message.from,
      });
      decision = await analyzeMessage(message, heuristic);
    } catch (error) {
      failedIds.add(envelope.id);
      digestItems.push(unanalyzedItem(message ?? envelope, error));
      continue;
    }
    digestItems.push({
      id: message.id,
      from: message.from,
      subject: message.subject,
      disposition: decision.disposition,
      summary: decision.summary,
      draftReply: decision.draftReply,
      ownerQuestion: decision.ownerQuestion,
    });
  }

  process.stdout.write(`${buildDigest(digestItems)}\n`);

  if (!dryRun) {
    const processedMessageIds = [
      ...new Set([
        ...state.processedMessageIds,
        ...newEnvelopes
          .map((message) => message.id)
          .filter((id) => !failedIds.has(id)),
      ]),
    ].slice(-5_000);

    await saveState(STATE_PATH, {
      processedMessageIds,
      updatedAt: new Date().toISOString(),
    });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Email agent failed: ${message}\n`);
  process.exitCode = 1;
});
