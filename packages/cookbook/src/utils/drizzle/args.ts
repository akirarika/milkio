import { UsageError } from "./errors";

/** Options parsed by the cookbook CLI that `co drizzle` consumes itself. */
const CO_FLAGS = new Set([
    "project",
    "mode",
    "yes",
    "yes-migrate",
    "force",
    "json",
    "interactive",
    "no-auto-migrate",
    "answers",
    "on-prompt",
]);

/** drizzle-kit options that may be forwarded verbatim, per subcommand. */
const PASSTHROUGH: Record<string, Set<string>> = {
    generate: new Set(["name", "custom", "breakpoints", "prefix", "casing"]),
    push: new Set(["verbose", "strict", "casing"]),
    pull: new Set(["introspect-casing", "breakpoints"]),
    migrate: new Set(),
    up: new Set(),
    check: new Set(),
    export: new Set(),
};

/**
 * Translate the cookbook CLI options into drizzle-kit CLI arguments.
 *
 * Only an explicit allowlist is forwarded: drizzle-kit treats unknown options as
 * fatal, and silently dropping an option (the old behaviour) makes an agent
 * believe it configured something it did not.
 */
export function buildDrizzleKitArgs(subcommand: string, options: Record<string, string | true>): string[] {
    const allowed = PASSTHROUGH[subcommand];
    if (!allowed) throw new UsageError(`Unsupported drizzle subcommand: ${subcommand}`);

    const args: string[] = [];
    for (const key of Object.keys(options)) {
        if (CO_FLAGS.has(key)) continue;
        if (!allowed.has(key)) {
            const supported = [...allowed].map((item) => `--${item}=…`).join(", ");
            throw new UsageError(
                `Unsupported option --${key} for "co drizzle ${subcommand}". Pass-through options: ${supported || "(none)"}.`,
            );
        }
        const value = options[key];
        args.push(value === true || value === "1" ? `--${key}` : `--${key}=${value}`);
    }
    return args;
}

/** Flags from `params.options` as simple booleans (the parser stores `--x` as "1"). */
export function isFlagSet(options: Record<string, string | true>, key: string): boolean {
    return options[key] === "1" || options[key] === true;
}
