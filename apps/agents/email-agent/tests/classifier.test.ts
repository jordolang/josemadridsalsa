import { describe, expect, it } from 'vitest';

import { classifyEmail } from '../src/classifier.js';

describe('classifyEmail', () => {
  it('escalates messages about late orders and refunds', () => {
    const result = classifyEmail({
      subject: 'Order is late',
      body: 'My shipment is delayed and I need a refund.',
      from: 'customer@example.com',
    });

    expect(result.disposition).toBe('needs-owner');
    expect(result.reasons).toContain('delivery problem');
    expect(result.reasons).toContain('refund or payment request');
  });

  it('allows routine product and policy questions to be drafted', () => {
    const result = classifyEmail({
      subject: 'Salsa ingredients',
      body: 'Is your mild salsa gluten free?',
      from: 'customer@example.com',
    });

    expect(result.disposition).toBe('routine-draft');
  });

  it('ignores automated senders', () => {
    const result = classifyEmail({
      subject: 'Security alert',
      body: 'A new sign-in was detected.',
      from: 'Google <no-reply@accounts.google.com>',
    });

    expect(result.disposition).toBe('ignore');
  });
});
