import { createHash } from "node:crypto";

/**
 * Deterministic, URL/filename-safe hash used for cookbook.toml cache keys and
 * the cookbook-server access key. Replaces Bun.hash.xxHash3 after the
 * Bun -> Node migration; any stable hash works here as it is only compared
 * against values produced by this same function.
 */
export function calcHash(buffer: Buffer | string) {
  return createHash("sha256").update(buffer).digest("base64url");
}
