import UnpluginTypia from "@ryoppippi/unplugin-typia/bun";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun",
  plugins: [UnpluginTypia(/* options */)],
});

console.log("✅ Done");
