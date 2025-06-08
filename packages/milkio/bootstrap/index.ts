import type { MilkioWorld } from "../index.ts";

export function bootstrap<BootstrapInitT extends BootstrapInit>(init: BootstrapInitT): BootstrapInitT {
  return init;
}

export type BootstrapInit = (world: MilkioWorld) => Promise<void> | void;
