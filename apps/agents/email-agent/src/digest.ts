export type DigestItem = {
  id: string;
  from: string;
  subject: string;
  disposition: 'routine-draft' | 'needs-owner' | 'ignore';
  summary: string;
  draftReply: string | null;
  ownerQuestion: string | null;
};

export function unanalyzedItem(
  message: Pick<DigestItem, 'id' | 'from' | 'subject'>,
  error: unknown,
): DigestItem {
  const reason = error instanceof Error ? error.message : String(error);
  return {
    id: message.id,
    from: message.from,
    subject: message.subject,
    disposition: 'needs-owner',
    summary: `Could not be analyzed this run (${reason.slice(0, 200)}). It will be retried at the next review.`,
    draftReply: null,
    ownerQuestion: 'Read this one yourself if it cannot wait for the next review.',
  };
}

function formatItem(item: DigestItem): string {
  const details = [
    `- **${item.subject}** — ${item.from}`,
    `  - Summary: ${item.summary}`,
  ];

  if (item.draftReply) {
    details.push(`  - Proposed reply: ${item.draftReply}`);
  }
  if (item.ownerQuestion) {
    details.push(`  - Decision needed: ${item.ownerQuestion}`);
  }

  return details.join('\n');
}

export function buildDigest(items: DigestItem[]): string {
  const routine = items.filter((item) => item.disposition === 'routine-draft');
  const owner = items.filter((item) => item.disposition === 'needs-owner');
  const ignored = items.filter((item) => item.disposition === 'ignore');

  const sections = [
    '# José Madrid Salsa email review',
    '',
    `## Replies to approve (${routine.length})`,
    routine.length > 0 ? routine.map(formatItem).join('\n') : '- None',
    '',
    `## Needs your decision (${owner.length})`,
    owner.length > 0 ? owner.map(formatItem).join('\n') : '- None',
    '',
    `## Automated/no-action messages (${ignored.length})`,
    ignored.length > 0 ? ignored.map(formatItem).join('\n') : '- None',
    '',
    '**No email was sent.** This agent remains in draft-only mode.',
  ];

  return sections.join('\n');
}
