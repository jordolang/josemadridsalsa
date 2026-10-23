import { describe, expect, it } from 'vitest';

import { parseClaudeDecision } from '../src/decision.js';

describe('parseClaudeDecision', () => {
  it('accepts a valid draft decision', () => {
    expect(
      parseClaudeDecision(
        JSON.stringify({
          disposition: 'routine-draft',
          summary: 'Customer asks about ingredients.',
          draftReply: 'Yes, our mild salsa is gluten free.',
          ownerQuestion: null,
          confidence: 0.94,
        }),
      ),
    ).toEqual({
      disposition: 'routine-draft',
      summary: 'Customer asks about ingredients.',
      draftReply: 'Yes, our mild salsa is gluten free.',
      ownerQuestion: null,
      confidence: 0.94,
    });
  });

  it('rejects malformed or unsafe model output', () => {
    expect(() => parseClaudeDecision('{"disposition":"send-now"}')).toThrow();
  });
});
