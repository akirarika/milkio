import type typia from "typia";
export declare const api: {
    meta: {};
    action(params: string & typia.tags.MinLength<3> & typia.tags.MaxLength<16>, context: import("milkio").MilkioContext): Promise<any>;
} & {
    isApi: true;
};
