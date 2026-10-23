import { describe, expect, it } from 'vitest';

import { buildDigest, unanalyzedItem } from '../src/digest.js';

describe('unanalyzedItem', () => {
  it('flags a message whose analysis failed for the owner, with no draft', () => {
    const item = unanalyzedItem(
      { id: '9', from: 'Cy <cy@example.com>', subject: 'Order question' },
      new Error('Command failed: hermes chat (timed out)'),
    );

    expect(item.disposition).toBe('needs-owner');
    expect(item.draftReply).toBeNull();
    expect(item.summary).toContain('timed out');
    expect(item.summary).toContain('retried at the next review');
    expect(buildDigest([item])).toContain('Needs your decision (1)');
  });
});

describe('buildDigest', () => {
  it('produces a concise report grouped by disposition', () => {
    const digest = buildDigest([
      {
        id: '1',
        from: 'Ada <ada@example.com>',
        subject: 'Ingredients',
        disposition: 'routine-draft',
        summary: 'Asks whether mild salsa is gluten free.',
        draftReply: 'Yes, it is gluten free.',
        ownerQuestion: null,
      },
      {
        id: '2',
        from: 'Ben <ben@example.com>',
        subject: 'Late order',
        disposition: 'needs-owner',
        summary: 'Order is late.',
        draftReply: null,
        ownerQuestion: 'Should we refund or replace the order?',
      },
    ]);

    expect(digest).toContain('Replies to approve (1)');
    expect(digest).toContain('Needs your decision (1)');
    expect(digest).toContain('No email was sent');
  });
});
