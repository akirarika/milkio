export interface Fail {
    REQUEST_FAIL: string;
    FOO_CODE: undefined;
}

export interface Fault {
    PASSTHROUGH_FAULT: { detail: string };
}
