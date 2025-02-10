#!/usr/bin/env bun

import { $ } from 'bun'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { cwd } from 'node:process'
import fsExtra from 'fs-extra'

await $`bun i`
await $`bun run typia generate --input src --output generated --project tsconfig.json`.cwd(join(cwd(), 'packages', 'cookbook-dto'))
let cookbookDtoTypes = (await readFile(join(cwd(), 'packages', 'cookbook-dto', 'generated', 'cookbook-dto-types.ts'))).toString()
let cookbookDtoChecks = (await readFile(join(cwd(), 'packages', 'cookbook-dto', 'generated', 'cookbook-dto-checks.ts'))).toString()
const cookbookDtoWarning = `/**
* The content of this file is automatically generated by Typia.
* It can be edited in the /packages/cookbook-dto/src/* file, and each time you run bun run dev, the generated file will be synced to another location based on the content of the /develop.ts.
*/\n\n`
cookbookDtoTypes = cookbookDtoWarning + cookbookDtoTypes
cookbookDtoChecks = cookbookDtoWarning + cookbookDtoChecks
const writePaths = [
  // cookbook
  {
    path: join(cwd(), 'packages', 'cookbook', 'src', 'utils'),
    types: true,
    checks: true,
  },
  // milkio-astra
  {
    path: join(cwd(), 'packages', 'milkio-astra', 'utils'),
    types: true,
    checks: true,
  },
  // milkio-vscode-extension
  {
    path: join(cwd(), 'packages', 'milkio-vscode-extension', 'src', 'utils'),
    types: true,
    checks: true,
  },
]

for (const writePath of writePaths) {
  fsExtra.ensureDirSync(writePath.path)
  if (writePath.types) await Bun.write(join(writePath.path, 'cookbook-dto-types.ts'), cookbookDtoTypes)
  if (writePath.checks) await Bun.write(join(writePath.path, 'cookbook-dto-checks.ts'), cookbookDtoChecks)
}

if (process.platform !== 'win32') await $`chmod +x ./node_modules/.bin/cookbook`
await $`cd ./packages/cookbook/ && bun i`
await $`cd ./packages/milkio/ && bun i`
