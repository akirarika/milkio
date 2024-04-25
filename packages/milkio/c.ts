#!/usr/bin/env bun

/* eslint-disable no-constant-condition, @typescript-eslint/no-misused-promises, no-console, @typescript-eslint/no-explicit-any */

import { argv, exit } from "node:process"
import { $ } from "bun"

const method = argv[2] as keyof typeof commands
const params = argv.slice(3) as Parameters<(typeof commands)[keyof typeof commands]>

const commands = {
  async gen() {
    console.log("🥛 Milkio Generating..\n")
    await (await import('./scripts/gen-significant')).default()
    await (await import('./scripts/gen-insignificant')).default()
    console.log("\n✅ Milkio Generated!")
  },
  async "gen:significant"() {
    console.log("🥛 Milkio Significant Generating..\n")
    await (await import('./scripts/gen-significant')).default()
    console.log("\n✅ Milkio Significant Generated!")
  },
  async "gen:insignificant"() {
    console.log("🥛 Milkio Insignificant Generating..\n")
    await (await import('./scripts/gen-insignificant')).default()
    console.log("\n✅ Milkio Insignificant Generated!")
  },
  async EAR(commandBase64ed: string) {
    try { await $`clear` } catch (e) {}
    const command = Buffer.from(commandBase64ed, 'base64').toString('utf-8')
    console.log('\x1B[2m%s\x1B[0m', `$ ${command}`)
    console.log(``)
    await $`${{ raw: command }}`
    process.on('SIGINT', () => {}) // prevent users from exiting by pressing ctrl + c
    while (true) await new Promise((resolve) => process.stdin.on('keypress', resolve))
  },
}

if (method === undefined || !(method in commands)) {
  console.log("Command does not exist, Supported commands are:")
  console.log("  " + Object.keys(commands).join(", "))
  exit(1)
}

// @ts-ignore
await commands[method](...params)

exit(0)
