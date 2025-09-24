import type { MilkioContext } from "../index.ts";

export function action<ActionInitT extends ActionInit>(init: ActionInitT): Action<ActionInitT> {
    const action = init as unknown as Action<ActionInitT>;
    action.$milkioType = "action";
    if ((action as any).meta === undefined) (action as any).meta = {};
    return action;
}

export type ActionInit = {
    meta?: Record<any, any>;
    handler: (context: MilkioContext, params: any) => Promise<unknown>;
};

export type Action<ActionInitT extends ActionInit> = {
    $milkioType: "action";
    // meta: ActionInitT["meta"] extends undefined ? {} : ActionInitT["meta"]; 
    meta: any; // There is a bug in Typia. When meta exists and contains internally auto-inferred complex types, the entire action will be inferred as any, resulting in the failure of type checking.
    handler: ActionInitT["handler"];
};
