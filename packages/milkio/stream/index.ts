import type { $context, $meta } from "../index.ts";

export type StreamInit = {
    meta?: $meta;
    handler: (context: $context, params: any) => AsyncGenerator<unknown>;
};

export type Stream<StreamInitT extends StreamInit> = {
    meta?: $meta;
    handler: StreamInitT["handler"];
};
