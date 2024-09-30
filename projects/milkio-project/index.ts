import { env, argv, exit } from "node:process";
import { defineMilkioWorld, type $types, type GeneratorGeneric } from "milkio";
import { generated } from "./.milkio/generated";

declare module "milkio" {
  interface $types {
    generated: typeof generated;
  }
  interface context {
    fancyFormat(): string;
  }
}

import typia, { tags } from "typia";
import { v4 } from "uuid";

typia.assert<IMember>({
  id: v4(),
  email: "samchon.github@gmail.com",
  age: 23, // wrong, must be greater than 19
});

interface IMember {
  id: string & tags.Format<"uuid">;
  email: string & tags.Format<"email">;
  age: number & tags.Type<"uint32"> & tags.ExclusiveMinimum<19> & tags.Maximum<100>;
}

const world = await defineMilkioWorld(generated, {
  port: { app: 9000, develop: env.NODE_ENV ? "disabled" : 8000 },
  argv: process.argv,
});

const a = undefined as any as GeneratorGeneric<$types["generated"]["routeSchema"]["$types"]["/"]["result"]>;

// await world.commander(argv);

const server = Bun.serve({
  port: world.listener.port,
  fetch: world.listener.fetch,
});

// action
(async () => {
  const [reject, result] = await world.execute("/user", { params: { hello: "world", world: "hello" } });
  if (reject) {
    console.log("reject", reject, result);
    exit(0);
  }
  console.log("success", reject, result);
})();

// stream
(async () => {
  const [reject, results] = await world.execute("/", { params: { hello: "world", world: "hello" } });
  if (reject) {
    console.log("reject", reject, results);
    exit(0);
  }
  let i = 0;
  for await (const [reject, result] of results) {
    if (++i > 10) break;
    if (reject) {
      console.log("reject", reject, results);
      break;
    }
    console.log("result", reject, result);
  }
})();
