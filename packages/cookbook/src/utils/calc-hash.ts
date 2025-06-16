export function calcHash(buffer: Buffer) {
  return Bun.hash.xxHash3(buffer).toString(36);
}
