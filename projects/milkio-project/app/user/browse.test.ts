import { expect, test } from "vitest";
import { astra } from "/.milkio/test";

test("adds 1 + 2 to equal 3", async () => {
  const [world, reject] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/user", {
    params: { hello: "world" },
    generateParams: true,
  });
  if (error) throw reject("出现了异常", error);
  console.log("这段代码运行在 Vitest 中，是使用 Node.js 运行的");
});
