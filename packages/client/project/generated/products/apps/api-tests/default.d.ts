import typia from "typia";
export declare const validateParams: (params: any) => Promise<typia.IValidation<void>>;
export declare const randParams: () => Promise<{
    by: string & typia.tags.MinLength<2> & typia.tags.MaxLength<16>;
}>;
