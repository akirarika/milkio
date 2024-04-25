import typia from "typia";
export declare const validateParams: (params: any) => Promise<typia.IValidation<string & typia.tags.MinLength<3> & typia.tags.MaxLength<16>>>;
export declare const validateResults: (results: any) => Promise<string>;
export declare const randParams: () => Promise<string & typia.tags.MinLength<3> & typia.tags.MaxLength<16>>;
