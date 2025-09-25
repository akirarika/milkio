import type { MilkioContext, MilkioMeta } from "../index.ts";

export type StreamInit = {
    meta?: MilkioMeta;
    handler: (context: MilkioContext, params: any) => AsyncGenerator<unknown>;
};

export type Stream<StreamInitT extends StreamInit> = {
    meta?: MilkioMeta;
    handler: StreamInitT["handler"];
};
