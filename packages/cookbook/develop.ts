#!/usr/bin/env bun

import { $ } from "bun";
import { join } from "node:path";
import { exit, cwd } from "node:process";

await $`chmod +x ./node_modules/.bin/cookbook`;
await $`bun run typia generate --input src/typia/raw --output src/typia/generated --project tsconfig.json`.cwd(join(cwd(), "packages", "cookbook"));
