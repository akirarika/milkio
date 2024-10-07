import { type $types, type Logger } from "..";

export interface $context {
  executeId: string;
  path: string;
  logger: Logger;
  http?: ContextHttp<Record<any, any>>;
}

export type ContextHttp<ParamsParsed> = {
  url: URL;
  ip: string;
  path: { string: keyof $types["generated"]["routeSchema"]["$types"]; array: Array<string> };
  params: {
    string: string;
    parsed: ParamsParsed;
  };
};
