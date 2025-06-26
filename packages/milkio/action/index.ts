import type { $context, $meta } from "../index.ts";

export function action<ActionInitT extends ActionInit>(init: ActionInitT): Action<ActionInitT> {
  const action = init as unknown as Action<ActionInitT>;
  action.$milkioType = "action";
  if (action.meta === undefined) action.meta = {};
  return action;
}

export type ActionInit = {
  meta?: $meta;
  handler: (context: $context, params: any) => Promise<unknown>;
};

export type Action<ActionInitT extends ActionInit> = {
  $milkioType: "action";
  meta: ActionInitT["meta"] extends undefined ? {} : ActionInitT["meta"];
  handler: ActionInitT["handler"];
};
