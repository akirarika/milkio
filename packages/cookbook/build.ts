#!/usr/bin/env bun

import { $ } from "bun";
import "./develop";

await $`bun build ./src/index.ts --compile --minify --sourcemap --target=bun-linux-arm64 --outfile ./dist/milkio-linux-arm64`;
await $`bun build ./src/index.ts --compile --minify --sourcemap --target=bun-linux-x64 --outfile ./dist/milkio-linux-x64 -baseline`;
await $`bun build ./src/index.ts --compile --minify --sourcemap --target=bun-linux-arm64 --outfile ./dist/milkio-linux-arm64`;
await $`bun build ./src/index.ts --compile --minify --sourcemap --target=bun-windows-x64 --outfile ./dist/milkio-windows-x64 -baseline`;
await $`bun build ./src/index.ts --compile --minify --sourcemap --target=bun-darwin-x64 --outfile ./dist/milkio-darwin-x64`;
await $`bun build ./src/index.ts --compile --minify --sourcemap --target=bun-darwin-arm64 --outfile ./dist/milkio-darwin-arm64`;
