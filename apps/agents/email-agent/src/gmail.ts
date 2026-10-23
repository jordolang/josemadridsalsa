import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

const EnvelopeSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  date: z.string(),
  snippet: z.string(),
  labels: z.array(z.string()),
});

const MessageSchema = EnvelopeSchema.omit({ snippet: true }).extend({
  body: z.string(),
});

export type GmailEnvelope = z.infer<typeof EnvelopeSchema>;
export type GmailMessage = z.infer<typeof MessageSchema>;

function googleApiScript(): string {
  const hermesHome = process.env.HERMES_HOME ?? join(homedir(), '.hermes');
  return join(
    hermesHome,
    'skills/productivity/google-workspace/scripts/google_api.py',
  );
}

async function runGoogleApi(args: string[]): Promise<unknown> {
  const { stdout } = await execFileAsync(
    process.env.PYTHON_BIN ?? 'python',
    [googleApiScript(), ...args],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  return JSON.parse(stdout);
}

export async function searchInbox(
  query: string,
  maxResults: number,
): Promise<GmailEnvelope[]> {
  return z
    .array(EnvelopeSchema)
    .parse(await runGoogleApi(['gmail', 'search', query, '--max', String(maxResults)]));
}

export async function getMessage(id: string): Promise<GmailMessage> {
  return MessageSchema.parse(await runGoogleApi(['gmail', 'get', id]));
}
