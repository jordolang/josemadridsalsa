'use client';

import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

type Vote = 'good' | 'bad' | null;

interface RateProps {
  /**
   * Callback fired when a user submits a rating. Implement this to send the
   * vote to your analytics provider.
   */
  onRateAction?: (vote: Exclude<Vote, null>) => void | Promise<void>;
}

export function Rate({ onRateAction }: RateProps) {
  const [vote, setVote] = useState<Vote>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleVote(next: Exclude<Vote, null>) {
    setVote(next);
    setSubmitted(true);
    try {
      await onRateAction?.(next);
    } catch {
      // Swallow — the UI has already thanked the user.
    }
  }

  return (
    <div className="mt-12 flex flex-col items-start gap-3 rounded-xl border border-fd-border bg-fd-card/50 p-5">
      <p className="text-sm font-semibold text-fd-foreground">
        How is this guide?
      </p>
      {submitted ? (
        <p className="text-sm text-fd-muted-foreground">
          {vote === 'good'
            ? 'Thanks for the feedback!'
            : 'Thanks — we will work on making this better.'}
        </p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleVote('good')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-fd-border px-3 py-1.5 text-sm text-fd-foreground transition-colors',
              'hover:bg-fd-accent hover:text-fd-accent-foreground',
            )}
            aria-label="Rate this guide as good"
          >
            <ThumbsUp className="size-4" aria-hidden />
            Good
          </button>
          <button
            type="button"
            onClick={() => handleVote('bad')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-fd-border px-3 py-1.5 text-sm text-fd-foreground transition-colors',
              'hover:bg-fd-accent hover:text-fd-accent-foreground',
            )}
            aria-label="Rate this guide as bad"
          >
            <ThumbsDown className="size-4" aria-hidden />
            Bad
          </button>
        </div>
      )}
    </div>
  );
}
