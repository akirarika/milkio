/// <reference types="node" />
/// <reference types="bun-types" />
import type ApiParams from "../generated/api-schema";
export declare const routerHandler: (path: string, fullurl: URL) => Promise<false | keyof (typeof ApiParams)["apiMethodsSchema"]>;
