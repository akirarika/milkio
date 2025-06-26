export function calcHash(buffer: Buffer | string) {
  return Bun.hash.xxHash3(buffer).toString(36);
}
