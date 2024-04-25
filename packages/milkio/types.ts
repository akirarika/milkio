/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any */

import { type createMilkioApp } from "."
import type { failCode } from "../../src/fail-code"

export type MilkioApp = Awaited<ReturnType<typeof createMilkioApp>>

export type ExecuteId = string | "global"

export type FailEnumerates = typeof failCode

export type HTTPRequest = Request

export type HTTPResponse = Override<ResponseInit & { body: string | null | undefined }, { headers: NonNullable<ResponseInit["headers"]> }>

export type Fail<FailCode extends keyof FailEnumerates> = {
  code: FailCode
  message: string
  data: Parameters<FailEnumerates[FailCode]>[0]
}

export type MilkioMeta = {
  //
}

export type Cookbook = Record<string, CookbookItem>

export type CookbookItem = {
  title?: string;
  desc?: string;
  params: string;
  cases: Array<{
    name: string;
    handler: string;
  }>
}

export type Override<P, S> = Omit<P, keyof S> & S

export type Mixin<T, U> = U & Omit<T, keyof U>

export type MilkioConfig = {
  generate?: {
    significant?: Array<string>;
    insignificant?: Array<string>;
  },
  menubar?: {
    commands?: Array<{ name?: string, script?: string, icon?: string }>;
  }
};