import { type $context, type $meta } from "..";

export const middleware = <MiddlewareInitT extends MiddlewareInit>(init: MiddlewareInitT): Middleware<MiddlewareInitT> => {
  const middleware = init as unknown as Middleware<MiddlewareInitT>;
  middleware.$milkioType = "middleware";
  if (middleware.meta === undefined) middleware.meta = {};
  return middleware;
};

export type MiddlewareInit = {
  meta?: $meta;
  handler: (context: $context, params: any) => Promise<unknown>;
};

export type Middleware<MiddlewareInitT extends MiddlewareInit> = {
  $milkioType: "middleware";
  meta: MiddlewareInitT["meta"] extends undefined ? {} : MiddlewareInitT["meta"];
  handler: MiddlewareInitT["handler"];
};
