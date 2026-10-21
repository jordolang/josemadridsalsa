import { describe, expect, it } from 'vitest';

import { selectNewMessages } from '../src/state.js';

describe('selectNewMessages', () => {
  it('returns only messages not previously processed', () => {
    const messages = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];

    expect(selectNewMessages(messages, new Set(['one', 'three']))).toEqual([
      { id: 'two' },
    ]);
  });
});
