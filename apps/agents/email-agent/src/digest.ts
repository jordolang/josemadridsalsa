export type DigestItem = {
  id: string;
  from: string;
  subject: string;
  disposition: 'routine-draft' | 'needs-owner' | 'ignore';
  summary: string;
  draftReply: string | null;
  ownerQuestion: string | null;
};

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
