import { $meta } from "../meta/index.ts";
import { $context } from "../context/index.ts";

export type ActionInit = {
    meta?: Record<any, any>;
    handler: (context: $context, params: any) => Promise<unknown>;
};

export type Action<ActionInitT extends ActionInit> = {
    meta?: $meta;
    handler: ActionInitT["handler"];
};
