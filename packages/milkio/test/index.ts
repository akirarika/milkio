import { type context, type meta } from "..";

export const test = <TestInitT extends TestInit>(init: TestInitT): Test<TestInitT> => {
  const test = init as unknown as Test<TestInitT>;
  test.$milkioType = "test";
  if (test.name === undefined) test.name = {};
  return test;
};

export type TestInit = {
  name: meta;
  handler: (test: TestTools) => Promise<unknown>;
};

export type Test<TestInitT extends TestInit> = {
  $milkioType: "test";
  name: TestInitT["name"] extends undefined ? {} : TestInitT["name"];
  handler: TestInitT["handler"];
};

export type TestTools = {};
