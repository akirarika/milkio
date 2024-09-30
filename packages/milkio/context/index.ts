import { $types } from "..";

export interface $context {
  foo: string;
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
