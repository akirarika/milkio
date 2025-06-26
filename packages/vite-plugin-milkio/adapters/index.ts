import type { UserConfig } from "vite";
import { edgeOneAdapter } from "./edge-one.ts";

export type ViteInput = Exclude<Exclude<UserConfig["build"], undefined>["rollupOptions"], undefined>["input"];
export type ViteOutput = Exclude<Exclude<UserConfig["build"], undefined>["rollupOptions"], undefined>["output"];

export type MilkioAdapter = {
  name: string;
  adapter: (options: {}) => Promise<{
    input: ViteInput;
    output: ViteOutput;
  }>;
};

export const adapters: Array<MilkioAdapter> = [edgeOneAdapter()];
