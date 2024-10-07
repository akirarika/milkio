import typia from "typia";
export declare const validateParams: (params: any) => Promise<
  typia.IValidation<{
    by: string & typia.tags.MinLength<2> & typia.tags.MaxLength<16>;
  }>
>;
export declare const generateParams: () => Promise<{
  by: string & typia.tags.MinLength<2> & typia.tags.MaxLength<16>;
}>;
