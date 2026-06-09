/**
 * Mock for @vercel/kv
 * Used in tests where Vercel KV is not available
 */

export const kv = {
  zadd: async () => 0,
  zremrangebyscore: async () => 0,
  zcard: async () => 0,
  expire: async () => 0,
  del: async () => 0,
  keys: async () => [],
}
