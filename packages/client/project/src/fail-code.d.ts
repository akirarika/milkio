export declare const failCode: {
    NETWORK_ERROR: (data: undefined) => string;
    INTERNAL_SERVER_ERROR: (data: undefined) => string;
    NOT_FOUND: (data: undefined) => string;
    NOT_ALLOW_METHOD: (data: undefined) => string;
    TYPE_SAFE_ERROR: (data: {
        path: string;
        expected: string;
        value: string;
    }) => string;
    BUSINESS_FAIL: (data: string) => string;
};
