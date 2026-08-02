import type { $context, $meta } from "../index.ts";

export type RawInit = {
    meta?: $meta;
    handler: (context: $context, request: Request) => Promise<Response>;
};

export type Raw<RawInitT extends RawInit> = {
    meta?: $meta;
    handler: RawInitT["handler"];
};
