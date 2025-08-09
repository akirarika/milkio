import { join } from "node:path";
import { exit, cwd } from "node:process";
import consola from "consola";
import type { CookbookOptions } from "../utils/cookbook-dto-types";

export async function initTest(options: CookbookOptions) {
  //
}

export async function testRunner(key: string) {
  const tests = await import(join(cwd(), ".milkio", "test-schema.ts"));
  if (!(key in tests)) {
    consola.error(`The test does not exist: ${key}`);
    exit(1);
  }
}
