import typia from "typia";
export declare const validateParams: (params: any) => Promise<typia.IValidation<void>>;
export declare const validateResults: (results: any) => Promise<string>;
export declare const randParams: () => Promise<any>;
