import { MilkioMeta } from "../meta/index.ts";
import { MilkioContext } from "../context/index.ts";

export type ActionInit = {
    meta?: Record<any, any>;
    handler: (context: MilkioContext, params: any) => Promise<unknown>;
};

export type Action<ActionInitT extends ActionInit> = {
    meta?: MilkioMeta;
    handler: ActionInitT["handler"];
};
