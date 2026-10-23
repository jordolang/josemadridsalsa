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

describe('selectNewMessages with a limit', () => {
  it('skips processed messages before applying the limit', () => {
    const messages = [{ id: 'one' }, { id: 'two' }, { id: 'three' }, { id: 'four' }];

    expect(selectNewMessages(messages, new Set(['one', 'two']), 1)).toEqual([
      { id: 'three' },
    ]);
  });
});
