import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';

const StateSchema = z.object({
  processedMessageIds: z.array(z.string()).default([]),
  updatedAt: z.string().nullable().default(null),
});

export type AgentState = z.infer<typeof StateSchema>;

export function selectNewMessages<T extends { id: string }>(
  messages: T[],
  processed: ReadonlySet<string>,
): T[] {
  return messages.filter((message) => !processed.has(message.id));
}

export async function loadState(path: string): Promise<AgentState> {
  try {
    return StateSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { processedMessageIds: [], updatedAt: null };
    }
    throw error;
  }
}

export async function saveState(path: string, state: AgentState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
}
