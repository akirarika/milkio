// fail-code: expected business rejection (warn level, no stack, data is returned to clients).
// fault-code: unexpected/internal failure (error level, stack kept, hidden from clients).

export interface Fail {
    DATA_NOT_FOUND: undefined;
}

export interface Fault {
    INTERNAL_EXAMPLE_FAULT: { message: string };
}
