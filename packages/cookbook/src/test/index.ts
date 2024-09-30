import { join } from "node:path";
import { exit, cwd } from "node:process";
import type { CookbookOptions } from "..";
import consola from "consola";

export const initTest = async (options: CookbookOptions) => {
  //
};

export const testRunner = async (key: string) => {
  const tests = await import(join(cwd(), ".milkio", "generated", "test-schema.ts"));
  if (!(key in tests)) {
    consola.error(`The test does not exist: ${key}`);
    exit(1);
  }

  const test = tests[key];
};

// 测试怎么实现：
// 当调用 initTest 此方法时，传递一个路径，或者星号
// 如果为路径，只测试该路径，如果为星号，则测试全部
// 再写一个运行单个测试的方法，里面进行具体的测试并返回成功或失败
