export declare const failCode: {
    NETWORK_ERROR: () => string;
    INTERNAL_SERVER_ERROR: () => string;
    NOT_FOUND: () => string;
    NOT_ALLOW_METHOD: () => string;
    TYPE_SAFE_ERROR: (params: {
        path: string;
        expected: string;
        value: string;
    }) => string;
    BUSINESS_FAIL: (message: string) => string;
};
