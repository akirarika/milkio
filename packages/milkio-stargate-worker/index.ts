import { TSON } from "@southern-aurora/tson";

export type MilkioStargateOptions = {
  postMessage: (data: any) => void;
  serialize: "native" | "tson" | "json";
};

export type Mixin<T, U> = U & Omit<T, keyof U>;

export async function createStargateWorker<
  Generated extends { routeSchema: any; rejectCode: any }
>(stargateOptions: MilkioStargateOptions) {
  //
}
