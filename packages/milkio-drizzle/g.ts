#!/usr/bin/env bun

/* eslint-disable no-console */

import ejs from "ejs"
import { join } from "node:path"
import { existsSync, mkdirSync } from "node:fs"
import { exit } from "node:process"
import { cwd } from "node:process"
import { writeFile } from "node:fs/promises"
import { Glob } from "bun"

export async function generate() {
  // Make sure that the existing directories are all present
  existsSync(join("generated")) || mkdirSync(join("generated"))
  existsSync(join("generated", "raw")) || mkdirSync(join("generated", "raw"))
  existsSync(join("generated", "raw", "apps")) || mkdirSync(join("generated", "raw", "apps"))

  if (existsSync(join(cwd(), "src", "databases"))) {
    if (!existsSync(join("generated", "database-schema.ts"))) {
      await writeFile(join("generated", "database-schema.ts"), ``)
    }
    const filePath = join(cwd(), "generated", "database-schema.ts")
    const glob = new Glob("**/*.ts")
    const databaseFiles = await Array.fromAsync(glob.scan({ cwd: join(cwd(), "src", "databases") }))
    const template = `<% for (const path of ${"databaseFiles"}) { %>export * from '${"../src/databases"}/<%= path.slice(0, -3) %>'
<% } %>`
    await writeFile(filePath, ejs.render(template, { databaseFiles }))
  }
}

console.log("Milkio Database Generating..")

await generate()

console.log("\n✅ Milkio Database Generated!\n")

exit(0)
