import type { MilkioWorld } from "../index.ts";

export function handler<HandlerInitT extends HandlerInit>(init: HandlerInitT): HandlerInitT {
  return init;
}

export type HandlerInit = (world: MilkioWorld) => Promise<void> | void;
