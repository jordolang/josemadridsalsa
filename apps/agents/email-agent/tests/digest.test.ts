import { describe, expect, it } from 'vitest';

import { buildDigest } from '../src/digest.js';

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
