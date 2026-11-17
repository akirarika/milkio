/**
 * Exit codes and error types for the non-interactive `co drizzle` contract.
 *
 * The codes are part of the public AI-facing contract: an agent can branch on
 * them without parsing human output.
 */
export const EXIT_CODE = {
    /** Success, including "nothing to migrate". */
    ok: 0,
    /** A real failure (build error, drizzle-kit error, database error, ...). */
    failed: 1,
    /** Ambiguous schema change: re-run with the decisions from the JSON payload. */
    decisions: 2,
    /** Missing/invalid flags, unknown project or mode, unsupported command. */
    usage: 3,
    /** Another drizzle operation is already running for this project. */
    locked: 4,
} as const;

export type ExitCode = (typeof EXIT_CODE)[keyof typeof EXIT_CODE];

/** Invalid invocation: bad flags, unknown project/mode, unsupported command. */
export class UsageError extends Error {
    readonly exitCode: ExitCode = EXIT_CODE.usage;

    constructor(message: string) {
        super(message);
        this.name = "UsageError";
    }
}

/** Another drizzle command holds the project lock. */
export class LockedError extends Error {
    readonly exitCode: ExitCode = EXIT_CODE.locked;

    constructor(message: string) {
        super(message);
        this.name = "LockedError";
    }
}
