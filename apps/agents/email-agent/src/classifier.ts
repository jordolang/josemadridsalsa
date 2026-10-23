export type EmailInput = {
  subject: string;
  body: string;
  from: string;
};

export type EmailDisposition = 'routine-draft' | 'needs-owner' | 'ignore';

export type Classification = {
  disposition: EmailDisposition;
  reasons: string[];
};

const DELIVERY_TERMS = [
  'late',
  'delay',
  'delayed',
  'missing',
  'never arrived',
  'not arrived',
  'lost',
  'damaged',
];

const PAYMENT_TERMS = [
  'refund',
  'chargeback',
  'charged twice',
  'wrong charge',
  'payment problem',
];

const HUMAN_ACTION_TERMS = [
  'cancel my order',
  'change my order',
  'change the address',
  'replacement',
  'wholesale account',
  'legal',
  'allergy reaction',
];

function containsAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function classifyEmail(email: EmailInput): Classification {
  const sender = email.from.toLowerCase();
  if (
    sender.includes('no-reply') ||
    sender.includes('noreply') ||
    sender.includes('mailer-daemon')
  ) {
    return { disposition: 'ignore', reasons: ['automated sender'] };
  }

  const content = `${email.subject}\n${email.body}`.toLowerCase();
  const reasons: string[] = [];

  if (containsAny(content, DELIVERY_TERMS)) {
    reasons.push('delivery problem');
  }
  if (containsAny(content, PAYMENT_TERMS)) {
    reasons.push('refund or payment request');
  }
  if (containsAny(content, HUMAN_ACTION_TERMS)) {
    reasons.push('requires real-world action or judgment');
  }

  if (reasons.length > 0) {
    return { disposition: 'needs-owner', reasons };
  }

  return { disposition: 'routine-draft', reasons: ['routine customer question'] };
}
