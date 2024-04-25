import typia from "typia";
export declare const validateParams: (params: any) => Promise<typia.IValidation<{
    commands: string[];
    options: Record<string, string | true>;
}>>;
export declare const validateResults: (results: any) => Promise<string>;
export declare const randParams: () => Promise<{
    commands: string[];
    options: Record<string, string | true>;
}>;
