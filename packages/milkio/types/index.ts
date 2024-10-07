import { type $rejectCode } from "..";

export interface $types {
  [key: string]: Record<any, any>;
}

export type Override<P, S> = Omit<P, keyof S> & S;

export type Mixin<T, U> = U & Omit<T, keyof U>;

export type GeneratorGeneric<T> = T extends AsyncGenerator<infer I> ? I : never;

export type ExecuteId = string | "global";

// DON'T TRY TO WRITE A MORE DETAILED TYPE FOR THIS TYPE
// the role of this type is only to limit the foolproof operation when defineMilkio(...)
// the real generated type is defined by the framework user through declare module
export type GeneratedInit = {
  routeSchema: any;
  commandSchema: any;
  testSchema: any;
};

export type Results<T extends unknown> = {
  value: T;
};

export type ExecuteOptions = {
  params?: Record<any, any>;
  headers?: Record<string, string>;
};

export type Ping =
  | [
      {
        connect: false;
        delay: number;
        error: any;
      },
      null,
    ]
  | [
      null,
      {
        connect: true;
        delay: number;
        serverTimestamp: number;
      },
    ];

export type Execute = <Path extends keyof $types["generated"]["routeSchema"]["$types"]>(
  path: Path,
  options?: Mixin<
    ExecuteOptions,
    {
      headers?: Record<string, string>;
      params?: $types["generated"]["routeSchema"]["$types"][Path]["params"];
    }
  >,
) => $types["generated"]["routeSchema"]["$types"][Path]["🐣"] extends boolean
  ? // action
    Promise<[Partial<$rejectCode>, null, ExecuteResultsOption] | [null, ExecuteActionResults<Path>, ExecuteResultsOption]>
  : // stream
    Promise<[Partial<$rejectCode>, null, ExecuteResultsOption] | [null, AsyncGenerator<[Partial<$rejectCode>, null] | [null, ExecuteStreamResults<Path>], null>, ExecuteResultsOption]>;

export type ExecuteResultsOption = { executeId: string };

export type ExecuteActionResults<Path extends keyof Generated["routeSchema"]["$types"], Generated extends $types["generated"] = $types["generated"]> = Generated["routeSchema"]["$types"][Path]["result"];

export type ExecuteStreamResults<Path extends keyof Generated["routeSchema"]["$types"], Generated extends $types["generated"] = $types["generated"]> = GeneratorGeneric<Generated["routeSchema"]["$types"][Path]["result"]>;

export type MilkioResponseReject<Code extends keyof $rejectCode = keyof $rejectCode> = { success: false; code: Code; reject: $rejectCode[Code]; executeId: string };

export type MilkioResponseSuccess<Path extends keyof Generated["routeSchema"]["$types"], Generated extends $types["generated"] = $types["generated"]> = { success: true; data: Generated["routeSchema"]["$types"][Path]["result"]; executeId: string };
