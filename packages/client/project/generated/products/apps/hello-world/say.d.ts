import typia from "typia";
export declare const validateParams: (params: any) => Promise<typia.IValidation<{
    by?: (string & typia.tags.MinLength<2> & typia.tags.MaxLength<16>) | undefined;
}>>;
export declare const validateResults: (results: any) => Promise<string>;
export declare const randParams: () => Promise<{
    by?: (string & typia.tags.MinLength<2> & typia.tags.MaxLength<16>) | undefined;
}>;
