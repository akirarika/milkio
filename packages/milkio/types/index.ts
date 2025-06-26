import type { $rejectCode } from "../index.ts";

export interface $types {
  [key: string]: Record<any, any>;
}

export type Override<P, S> = Omit<P, keyof S> & S;

export type Mixin<T, U> = U & Omit<T, keyof U>;

export type GeneratorGeneric<T> = T extends AsyncGenerator<infer I> ? I : never;

export type DBSelect<T extends Record<any, any>, K extends keyof T> = Omit<T, K>;

export type DBCreate<T, KO extends keyof T | never = never, TO extends Omit<T, KO> = Omit<T, KO>> = {
  [K in keyof TO]?: TO[K] extends null ? undefined : Exclude<TO[K], null>;
};

export type DBUpdate<T, KO extends keyof T | never = never, TO extends Partial<Omit<T, KO>> = Partial<Omit<T, KO>>> = {
  [K in keyof TO]?: TO[K] extends null ? undefined : Exclude<TO[K], null>;
};

export type ExecuteId = string | "global";

// DON'T TRY TO WRITE A MORE DETAILED TYPE FOR THIS TYPE
// the role of this type is only to limit the foolproof operation when defineMilkio(...)
// the real generated type is defined by the framework user through declare module
export interface GeneratedInit {
  routeSchema: any;
  handlerSchema: any;
  typiaSchema: any;
}

export interface Results<T> {
  value: T;
}

export interface ExecuteOptions {
  params?: Record<any, any>;
  headers?: Record<string, string>;
}

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

export interface ExecuteResultsOption {
  executeId: string;
}

export type ExecuteActionResults<Path extends keyof Generated["routeSchema"], Generated extends $types["generated"] = $types["generated"]> = Generated["routeSchema"][Path]["result"];

export type ExecuteStreamResults<Path extends keyof Generated["routeSchema"], Generated extends $types["generated"] = $types["generated"]> = GeneratorGeneric<Generated["routeSchema"][Path]["result"]>;

export interface MilkioResponseReject<Code extends keyof $rejectCode = keyof $rejectCode> {
  success: false;
  code: Code;
  reject: $rejectCode[Code];
  executeId: string;
}

export interface MilkioResponseSuccess<Path extends keyof Generated["routeSchema"], Generated extends $types["generated"] = $types["generated"]> {
  success: true;
  data: Generated["routeSchema"][Path]["result"];
  executeId: string;
}

export type BreadBrowse<T, U extends Record<any, any> = {}> = Omit<
  {
    data: Array<T>;
  },
  keyof U
> &
  U;

export type BreadRead<T, U extends Record<any, any> = {}> = Omit<
  {
    data: T;
  },
  keyof U
> &
  U;

export type BreadEdit<U extends Record<any, any> = {}> = U;

export type BreadAdd<U extends Record<any, any> = {}> = U;

export type BreadDelete<U extends Record<any, any> = {}> = U;
