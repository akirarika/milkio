export declare const api: {
    meta: {
        deddos: string;
        permissions: {
            mode: string;
        };
        allowMethods: string[];
    };
    action(params: undefined, context: import("milkio").MilkioContext): Promise<{
        say: string;
    }>;
} & {
    isApi: true;
};
export declare const test: {
    getCases: () => import("milkio").ApiTestCases<{
        meta: {
            deddos: string;
            permissions: {
                mode: string;
            };
            allowMethods: string[];
        };
        action(params: undefined, context: import("milkio").MilkioContext): Promise<{
            say: string;
        }>;
    } & {
        isApi: true;
    }>[];
    isApiTest: boolean;
};
