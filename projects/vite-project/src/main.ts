import { createStargate } from "@milkio/stargate";
import { createAstra } from "@milkio/astra";
import type { generated } from "milkio-project";

const stargate = await createStargate<typeof generated>({
  baseUrl: "http://localhost:9000",
});

const astra = await createAstra({
  stargate: stargate,
  bootstrap: async () => {
    return {
      world: "world",
    };
  },
});

const world = await astra.createMirrorWorld(import.meta.url);

const [reject, results] = await world.execute("/user", {
  params: { hello: "world" },
  generateParams: true,
});

// // action
// console.log("action");
// await (async () => {
//   const [reject, result] = await stargate.execute("/user", { params: { hello: "world", world: "hello" } });
//   if (reject) {
//     console.log("reject", reject, result);
//     return;
//   }
//   console.log("done", reject, result);
// })();

// // stream
// console.log("stream");
// await (async () => {
//   const [reject, results] = await stargate.execute("/", { params: { hello: "world", world: "hello" }, type: "stream" });
//   console.log(reject, results);
//   if (reject) {
//     console.log("reject", reject, results);
//     return;
//   }
//   let i = 0;
//   for await (const [reject, result] of results) {
//     if (++i > 10) break;
//     if (reject) {
//       console.log("reject", reject, results);
//       break;
//     }
//     console.log("result", reject, result);
//   }
//   console.log("done");
// })();

console.log("结果", JSON.stringify([reject, results]));
