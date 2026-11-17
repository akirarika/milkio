import { defineCookbookCommand } from "@milkio/cookbook-command";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import { stripAnsi } from "../logs/ansi";
import { progress } from "../progress";
import { execScriptOrFail } from "../utils/exec-script";
import { getRuntime } from "../utils/get-runtime";
import { pathExists } from "../utils/node-compat";
import { select } from "../utils/select";
import { selectProject } from "../utils/select-project";
import { buildDrizzleKitArgs, isFlagSet } from "../utils/drizzle/args";
import { fingerprint, parseAnswers, parseOnPrompt } from "../utils/drizzle/decisions";
import { EXIT_CODE, LockedError, UsageError } from "../utils/drizzle/errors";
import { acquireProjectLock, type ProjectLock } from "../utils/drizzle/lock";
import { readJournal, readNewMigrations, writeMilkioMigrations } from "../utils/drizzle/journal";
import {
    createReporter,
    summarizeDatabase,
    withStdoutRedirect,
    type DrizzleJsonResult,
    type Reporter,
} from "../utils/drizzle/result";
import { resolveDrizzleKitBin, runDrizzle, runMigrationScript, type DrizzleRunResult } from "../utils/drizzle/runner";

/** Subcommands `co drizzle` can run non-interactively. */
const SUPPORTED_COMMANDS = ["generate", "migrate", "push", "pull", "up", "check", "export"];
/** Subcommands where drizzle-kit itself may ask a question. */
const COMMANDS_WITH_PROMPTS = new Set(["generate", "push"]);
/** Subcommands that need `.milkio/drizzle-schema.ts` to be built first. */
const COMMANDS_NEEDING_BUILD = new Set(["generate", "push"]);
/** Subcommands that write to the database (require `--yes`). */
const COMMANDS_NEEDING_DB_AUTH = new Set(["migrate", "push"]);
/** Subcommands that must not run concurrently in the same project. */
const COMMANDS_NEEDING_LOCK = new Set(["generate", "migrate", "push"]);

type CommandOutcome = { result: DrizzleJsonResult; exitCode: number };

class CommandFailure extends Error {
    /** Partial result to merge into the JSON envelope (e.g. files already written). */
    readonly payload?: Partial<DrizzleJsonResult>;

    constructor(message: string, payload?: Partial<DrizzleJsonResult>) {
        super(message);
        this.name = "CommandFailure";
        this.payload = payload;
    }
}

export default await defineCookbookCommand(async (utils, userCommand?: string, projectUsed?: string, modeUsed?: string) => {
    const params = utils.getParams();
    const options = params.options;
    const subcommand = params.commands.at(0) ?? userCommand ?? "";
    const json = isFlagSet(options, "json");
    const reporter = createReporter(json);

    const execute = async (): Promise<CommandOutcome> => {
        // No subcommand: non-interactive callers get a usage error (never a
        // prompt); `--interactive` keeps the historical selector + drizzle-kit TUI.
        if (subcommand === "") {
            if (!isFlagSet(options, "interactive")) {
                throw new UsageError(
                    `Missing subcommand. Supported: ${SUPPORTED_COMMANDS.join(", ")}. Run "co drizzle --help" for details, e.g. "co drizzle generate --project=<name> --mode=<mode> --yes --json".`,
                );
            }
            return await runLegacyDrizzle(utils, projectUsed);
        }

        if (!SUPPORTED_COMMANDS.includes(subcommand)) {
            throw new UsageError(
                `Unsupported subcommand "${subcommand}". Supported: ${SUPPORTED_COMMANDS.join(", ")}.`,
            );
        }
        if (params.commands.length > 1) {
            throw new UsageError(
                `Unexpected argument "${params.commands.slice(1).join(" ")}". Only flags are accepted after the subcommand.`,
            );
        }

        const interactive = isFlagSet(options, "interactive");
        if (json && interactive) {
            throw new UsageError('"--json" and "--interactive" cannot be combined: interactive mode inherits stdout.');
        }
        const yes = isFlagSet(options, "yes");
        const legacyYesMigrate = isFlagSet(options, "yes-migrate");
        const force = isFlagSet(options, "force");
        const autoMigrate = !isFlagSet(options, "no-auto-migrate");

        if (legacyYesMigrate && subcommand !== "migrate") {
            throw new UsageError('"--yes-migrate" only applies to "co drizzle migrate"; use "--yes" for other commands.');
        }
        if (force && subcommand !== "push") {
            throw new UsageError('"--force" only applies to "co drizzle push".');
        }
        if (isFlagSet(options, "no-auto-migrate") && subcommand !== "generate") {
            throw new UsageError('"--no-auto-migrate" only applies to "co drizzle generate".');
        }

        const answers = options.answers === undefined ? undefined : parseAnswers(String(options.answers));
        const policy = options["on-prompt"] === undefined ? undefined : parseOnPrompt(String(options["on-prompt"]));
        if ((answers !== undefined || policy !== undefined) && !COMMANDS_WITH_PROMPTS.has(subcommand)) {
            throw new UsageError('"--answers" / "--on-prompt" only apply to "co drizzle generate" and "co drizzle push".');
        }
        if (answers !== undefined && policy !== undefined) {
            throw new UsageError('Use either "--answers" or "--on-prompt", not both.');
        }

        const cookbookToml = await utils.getCookbookToml();
        const projectsRoot = join(cwd(), "projects");

        // ---- resolve project -------------------------------------------------
        const projectNameArg = options.project !== undefined ? String(options.project) : projectUsed;
        let project: any;
        if (projectNameArg === "1") {
            throw new UsageError('"--project" needs a value: --project=<project-name>.');
        }
        if (projectNameArg) {
            const configured = (cookbookToml.projects as Record<string, any>)[projectNameArg];
            if (!configured) {
                throw new UsageError(
                    `Project '${projectNameArg}' not found in cookbook.toml. Available: ${Object.keys(cookbookToml.projects).join(", ")}.`,
                );
            }
            project = {
                ...configured,
                name: configured.name ?? configured.key,
                value: projectNameArg,
                path: join(projectsRoot, projectNameArg),
            };
        } else {
            const candidates = Object.keys(cookbookToml.projects).filter(
                (name) =>
                    existsSync(join(projectsRoot, name, "drizzle")) ||
                    existsSync(join(projectsRoot, name, "drizzle.config.ts")),
            );
            if (candidates.length === 0) {
                throw new UsageError(
                    "No project with a drizzle configuration was found under projects/. Add a drizzle = [...] entry to cookbook.toml first.",
                );
            }
            if (candidates.length === 1) {
                const name = candidates[0];
                const configured = (cookbookToml.projects as Record<string, any>)[name];
                project = {
                    ...configured,
                    name: configured.name ?? configured.key,
                    value: name,
                    path: join(projectsRoot, name),
                };
            } else if (interactive) {
                project = await utils.selectProject({
                    filter: async (item) =>
                        (await pathExists(join(projectsRoot, item.value, "drizzle"))) ||
                        (await pathExists(join(projectsRoot, item.value, "drizzle.config.ts"))),
                    projectUsed,
                });
                if (!project) exit(0);
            } else {
                throw new UsageError(
                    `"--project" is required (candidates: ${candidates.join(", ")}).`,
                );
            }
        }

        // ---- resolve mode ----------------------------------------------------
        const modes: any[] = Array.isArray(project.drizzle) ? project.drizzle : [];
        if (modes.length === 0) {
            throw new UsageError(
                `Drizzle configuration not found for project '${project.value}'. Add a drizzle = [...] entry in cookbook.toml.`,
            );
        }
        const modeNameArg = options.mode !== undefined ? String(options.mode) : modeUsed;
        let mode: any;
        if (modeNameArg === "1") {
            throw new UsageError('"--mode" needs a value: --mode=<mode-name>.');
        }
        if (modeNameArg) {
            mode = modes.find((item) => item.mode === modeNameArg);
            if (!mode) {
                throw new UsageError(
                    `Mode '${modeNameArg}' not found. Available: ${modes.map((item) => item.mode).join(", ")}.`,
                );
            }
        } else if (modes.length === 1) {
            [mode] = modes;
        } else if (interactive) {
            mode = await select("Select the mode:", modes, "mode", undefined, "To run non-interactively, add --mode=<mode>.");
        } else {
            throw new UsageError(
                `"--mode" is required (available: ${modes.map((item) => item.mode).join(", ")}).`,
            );
        }
        if (!mode?.migrateMode) {
            throw new UsageError('Drizzle configuration is incomplete: add migrateMode = "generate" or "migrate" for this mode in cookbook.toml.');
        }

        // Keep the old guard rails: a mode configured for push must never be used
        // by generate/migrate and vice versa.
        if (mode.migrateMode === "push" && (subcommand === "generate" || subcommand === "migrate")) {
            throw new UsageError(
                'The mode is configured with \'migrateMode = "push"\', but you are trying to run generate/migrate. To avoid accidental changes, this command was stopped.',
            );
        }
        if (mode.migrateMode === "generate" && (subcommand === "push" || subcommand === "pull")) {
            throw new UsageError(
                'The mode is configured with \'migrateMode = "generate"\', but you are trying to run push/pull. To avoid accidental changes, this command was stopped.',
            );
        }

        // ---- authorization ---------------------------------------------------
        const authGranted = yes || (subcommand === "migrate" && legacyYesMigrate);
        if (COMMANDS_NEEDING_DB_AUTH.has(subcommand) && !authGranted) {
            if (interactive) {
                const confirmed = await utils.prompt<boolean>(
                    `Apply ${subcommand} to project "${project.value}" (mode "${mode.mode}")?\nDatabase: ${mode.migrateDatabaseUrl}`,
                    { type: "confirm", initial: true },
                );
                if (!confirmed) {
                    reporter.log("Cancelled.");
                    exit(0);
                }
            } else {
                throw new UsageError(
                    `"--yes" is required to run "${subcommand}" without a prompt. Retry with: co drizzle ${subcommand} --project=${project.value} --mode=${mode.mode} --yes${json ? " --json" : ""}`,
                );
            }
        }

        const binPath = resolveDrizzleKitBin(project.path);
        const drizzleArgs = buildDrizzleKitArgs(subcommand, options);
        if (subcommand === "push" && force) drizzleArgs.push("--force");

        const databaseUrl: string | undefined = mode.migrateDatabaseUrl;
        const env = { DATABASE_URL: databaseUrl };
        const result: DrizzleJsonResult = {
            ok: false,
            status: "failed",
            command: subcommand,
            project: project.value,
            mode: mode.mode,
            database: summarizeDatabase(databaseUrl),
        };

        // In interactive mode a human may approve the post-generate apply step.
        let applyGranted = authGranted;
        const migrateScript = join(project.path, "drizzle.migrate.ts");
        if (subcommand === "generate" && interactive && !applyGranted && existsSync(migrateScript)) {
            applyGranted = await utils.prompt<boolean>(
                `Apply the migrations after generating them (runs drizzle.migrate.ts against "${mode.migrateDatabaseUrl}")?`,
                { type: "confirm", initial: true },
            );
        }

        let lock: ProjectLock | undefined;
        try {
            if (COMMANDS_NEEDING_LOCK.has(subcommand)) lock = await acquireProjectLock(project.path);

            if (COMMANDS_NEEDING_BUILD.has(subcommand)) {
                await buildDrizzleSchema(utils, cookbookToml, mode.mode, reporter);
            }

            if (subcommand === "generate") {
                return await runGenerate({
                    project,
                    mode,
                    result,
                    reporter,
                    binPath,
                    drizzleArgs,
                    env,
                    databaseUrl,
                    answers,
                    policy,
                    authGranted: applyGranted,
                    autoMigrate,
                    projectName: project.value,
                    modeName: mode.mode,
                    json,
                    interactive,
                });
            }

            if (subcommand === "migrate") {
                return await runMigrate({ project, mode, result, reporter, binPath, drizzleArgs, env, projectName: project.value, modeName: mode.mode, json, interactive });
            }

            if (subcommand === "push") {
                const run = await runDrizzle({
                    binPath,
                    args: ["push", ...drizzleArgs],
                    cwd: project.path,
                    env,
                    interactive,
                    promptCapable: true,
                    successMarkers: [/Changes applied/, /No changes detected/],
                    failureMarkers: [/Interactive prompts require a TTY terminal/],
                    answers,
                    policy,
                    force,
                    onOutput: reporter.childOutput,
                    timeoutMs: 10 * 60 * 1000,
                });
                if (run.aborted) return decisionsOutcome(run, result, project.value, mode.mode, json, authGranted);
                if (run.failure) throw new CommandFailure(describeFailure(run));
                if (!interactive && !run.completed) throw new CommandFailure(describeFailure(run));
                result.ok = true;
                result.status = "pushed";
                return { result, exitCode: EXIT_CODE.ok };
            }

            // pull / up / check / export never prompt.
            const run = await runDrizzle({
                binPath,
                args: [subcommand, ...drizzleArgs],
                cwd: project.path,
                env,
                promptCapable: false,
                onOutput: reporter.childOutput,
            });
            if (run.code !== 0) {
                throw new CommandFailure(`drizzle-kit ${subcommand} failed with exit code ${run.code ?? "unknown"}.`);
            }
            result.ok = true;
            result.status =
                subcommand === "pull"
                    ? "introspected"
                    : subcommand === "check"
                        ? "checked"
                        : subcommand === "up"
                            ? "upgraded"
                            : "exported";
            if (subcommand === "export") result.output = stripAnsi(run.output).trim();
            return { result, exitCode: EXIT_CODE.ok };
        } finally {
            if (lock) await lock.release();
        }
    };

    try {
        const outcome = json ? await withStdoutRedirect(execute) : await execute();
        await emitOutcome(outcome, reporter, json);
        exit(outcome.exitCode);
    } catch (error) {
        const outcome = errorOutcome(error, subcommand);
        await emitOutcome(outcome, reporter, json);
        exit(outcome.exitCode);
    }
});

async function runLegacyDrizzle(utils: any, projectUsed?: string): Promise<CommandOutcome> {
    const cookbookToml = await utils.getCookbookToml();
    const project = await selectProject(cookbookToml, {
        filter: async (item) =>
            (await pathExists(join(cwd(), "projects", item.value, "drizzle"))) ||
            (await pathExists(join(cwd(), "projects", item.value, "drizzle.config.ts"))),
        projectUsed,
    });
    if (!project) exit(0);
    await ensureDrizzleScript(project.value);
    await execScriptOrFail(`${cookbookToml.general.packageManager} run drizzle`, {
        cwd: join(cwd(), "projects", project.value),
        env: { ...process.env },
    });
    exit(0);
}

type GenerateContext = {
    project: any;
    mode: any;
    result: DrizzleJsonResult;
    reporter: Reporter;
    binPath: string;
    drizzleArgs: string[];
    env: { DATABASE_URL: string | undefined };
    databaseUrl: string | undefined;
    answers: ReturnType<typeof parseAnswers> | undefined;
    policy: ReturnType<typeof parseOnPrompt> | undefined;
    authGranted: boolean;
    autoMigrate: boolean;
    projectName: string;
    modeName: string;
    json: boolean;
    interactive: boolean;
};

async function runGenerate(context: GenerateContext): Promise<CommandOutcome> {
    const { project, result, reporter, binPath, drizzleArgs, env, authGranted, autoMigrate } = context;

    const before = await readJournal(project.path);
    const run = await runDrizzle({
        binPath,
        args: ["generate", ...drizzleArgs],
        cwd: project.path,
        env,
        interactive: context.interactive,
        promptCapable: true,
        successMarkers: [/Your SQL migration file/, /No schema changes/, /Prepared empty file/],
        failureMarkers: [/Interactive prompts require a TTY terminal/],
        answers: context.answers,
        policy: context.policy,
        onOutput: reporter.childOutput,
        timeoutMs: 10 * 60 * 1000,
    });

    if (run.aborted) {
        return decisionsOutcome(run, result, context.projectName, context.modeName, context.json, context.authGranted);
    }
    if (run.failure) throw new CommandFailure(describeFailure(run));
    // False-success guard: drizzle-kit catches prompt errors internally and can
    // exit 0 without writing anything. Require an explicit success marker.
    if (!context.interactive && !run.completed) throw new CommandFailure(describeFailure(run));

    const after = await readJournal(project.path);
    if (!after) {
        throw new CommandFailure(
            "drizzle-kit reported success but drizzle/meta/_journal.json was not found. milkio expects the drizzle.config.ts `out` option to be \"./drizzle\".",
        );
    }

    const newMigrations = await readNewMigrations(project.path, before, after);
    if (newMigrations.length === 0) {
        result.status = "no_changes";
        reporter.log("No schema changes, nothing to migrate.");
    } else {
        await writeMilkioMigrations(project.path, after);
        result.migrations = newMigrations;
        result.status = "generated";
        reporter.success(
            `Generated ${newMigrations.length} migration(s): ${newMigrations.map((migration) => migration.tag).join(", ")}`,
        );
    }
    result.ok = true;

    const migrateScript = join(project.path, "drizzle.migrate.ts");
    const hasMigrateScript = existsSync(migrateScript);
    if (autoMigrate && hasMigrateScript) {
        if (!authGranted) {
            if (newMigrations.length > 0) {
                reporter.warn('Migration files were NOT applied: "--yes" is required to apply them.');
                result.next = `co drizzle migrate --project=${context.projectName} --mode=${context.modeName} --yes --json`;
            }
        } else {
            const runtime = await getRuntime(project.runtime ?? "bun");
            reporter.log(`Applying migrations with ${runtime} drizzle.migrate.ts ...`);
            const scriptResult = await runMigrationScript({
                runtime,
                scriptPath: migrateScript,
                cwd: project.path,
                env,
                onOutput: reporter.childOutput,
            });
            result.autoMigrate = { ran: true, exitCode: scriptResult.code };
            if (scriptResult.code !== 0) {
                throw new CommandFailure(
                    `drizzle.migrate.ts failed with exit code ${scriptResult.code ?? "unknown"}.`,
                    { migrations: result.migrations, autoMigrate: result.autoMigrate },
                );
            }
            reporter.success("Migrations applied.");
        }
    } else if (autoMigrate && !hasMigrateScript && newMigrations.length > 0) {
        result.next = `co drizzle migrate --project=${context.projectName} --mode=${context.modeName} --yes --json`;
    } else if (!autoMigrate && newMigrations.length > 0) {
        result.next = `co drizzle migrate --project=${context.projectName} --mode=${context.modeName} --yes --json`;
    }

    return { result, exitCode: EXIT_CODE.ok };
}

async function runMigrate(context: {
    project: any;
    mode: any;
    result: DrizzleJsonResult;
    reporter: Reporter;
    binPath: string;
    drizzleArgs: string[];
    env: { DATABASE_URL: string | undefined };
    projectName: string;
    modeName: string;
    json: boolean;
    interactive: boolean;
}): Promise<CommandOutcome> {
    const { project, result, reporter, binPath, drizzleArgs, env } = context;
    const migrateScript = join(project.path, "drizzle.migrate.ts");

    if (existsSync(migrateScript)) {
        const runtime = await getRuntime(project.runtime ?? "bun");
        reporter.log(`Applying migrations with ${runtime} drizzle.migrate.ts ...`);
        const scriptResult = await runMigrationScript({
            runtime,
            scriptPath: migrateScript,
            cwd: project.path,
            env,
            onOutput: reporter.childOutput,
        });
        if (scriptResult.code !== 0) {
            throw new CommandFailure(`drizzle.migrate.ts failed with exit code ${scriptResult.code ?? "unknown"}.`);
        }
    } else {
        const run = await runDrizzle({
            binPath,
            args: ["migrate", ...drizzleArgs],
            cwd: project.path,
            env,
            promptCapable: false,
            onOutput: reporter.childOutput,
        });
        if (run.code !== 0) {
            throw new CommandFailure(`drizzle-kit migrate failed with exit code ${run.code ?? "unknown"}.`);
        }
    }

    result.ok = true;
    result.status = "migrated";
    reporter.success("Migrations applied.");
    return { result, exitCode: EXIT_CODE.ok };
}

function decisionsOutcome(
    run: DrizzleRunResult,
    result: DrizzleJsonResult,
    projectName: string,
    modeName: string,
    json: boolean,
    applyAuthorized: boolean,
): CommandOutcome {
    const decisions = run.decisions;
    const decisionFingerprint = fingerprint(decisions);
    const template = {
        fingerprint: decisionFingerprint,
        digests: decisions.map((decision) => decision.digest),
        choices: decisions.map(() => "<option index>"),
    };
    const flags = [`--project=${projectName}`, `--mode=${modeName}`];
    if (applyAuthorized) flags.push("--yes");
    if (json) flags.push("--json");

    result.ok = false;
    result.status = "decisions_required";
    result.fingerprint = decisionFingerprint;
    result.decisions = decisions;
    result.resume = `co drizzle ${result.command} ${flags.join(" ")} --answers='${JSON.stringify(template)}'`;
    if (run.failure === "mismatch") {
        result.note =
            "The --answers digests did not match the prompts of this run (the schema changed between runs). The decisions below are fresh; re-run with them.";
    } else if (result.command === "push") {
        result.note =
            "Push applies statements incrementally: statements executed before this prompt may already be applied. Verify the database state before retrying.";
    }
    return { result, exitCode: EXIT_CODE.decisions };
}

function describeFailure(run: DrizzleRunResult): string {
    const tail = stripAnsi(run.output).trim().split(/\r?\n/).slice(-8).join("\n");
    const suffix = tail.length > 0 ? `\n--- drizzle-kit output ---\n${tail}` : "";
    if (run.failure === undefined) {
        return `drizzle-kit exited with code ${run.code} without reporting success (no migration was produced).${suffix}`;
    }
    switch (run.failure) {
        case "decisions_required":
            return `drizzle-kit required a decision that was not supplied.${suffix}`;
        case "mismatch":
            return `The prompts drizzle-kit produced do not match the digests in --answers; the schema changed between the two runs. Re-run without --answers to get fresh decisions.${suffix}`;
        case "shim_failed":
            return `drizzle-kit refused to run its interactive prompt (the TTY shim did not take effect). As a workaround run the same command with --interactive in a terminal.${suffix}`;
        case "timeout":
            return `drizzle-kit did not finish in time and was stopped.${suffix}`;
        case "spawn":
            return `Failed to start drizzle-kit.${suffix}`;
        default:
            return `drizzle-kit failed.${suffix}`;
    }
}

function errorOutcome(error: unknown, command: string): CommandOutcome {
    const message = error instanceof Error ? error.message : String(error);
    const result: DrizzleJsonResult = { ok: false, status: "failed", command, error: message };
    if (error instanceof CommandFailure && error.payload) Object.assign(result, error.payload);
    if (error instanceof UsageError) return { result, exitCode: EXIT_CODE.usage };
    if (error instanceof LockedError) return { result, exitCode: EXIT_CODE.locked };
    return { result, exitCode: EXIT_CODE.failed };
}

/**
 * Write text to stdout and wait until a piped stdout has flushed it, so a large
 * JSON payload is never truncated by `process.exit()`.
 */
function writeStdout(text: string): Promise<void> {
    return new Promise((resolveWrite) => {
        if (process.stdout.write(text)) {
            resolveWrite();
            return;
        }
        process.stdout.once("drain", () => resolveWrite());
    });
}

async function emitOutcome(outcome: CommandOutcome, reporter: Reporter, json: boolean): Promise<void> {
    const { result, exitCode } = outcome;
    result.ok = result.ok && exitCode === EXIT_CODE.ok;

    if (json) {
        await writeStdout(`${JSON.stringify(result, null, 2)}\n`);
        return;
    }

    if (exitCode === EXIT_CODE.ok) {
        if (result.migrations && result.migrations.length > 0) {
            reporter.success(`Migration files are ready (${result.migrations.map((item) => item.tag).join(", ")}).`);
        }
        if (result.autoMigrate?.ran) reporter.success("Migrations applied.");
        if (result.next) reporter.log(`Next: ${result.next}`);
        return;
    }

    if (exitCode === EXIT_CODE.decisions) {
        reporter.error(
            "drizzle-kit needs a decision before it can continue. Nothing was written. Re-run with --answers (see the JSON below).",
        );
        await writeStdout(`${JSON.stringify(result, null, 2)}\n`);
        return;
    }

    reporter.error(result.error ?? "Drizzle command failed.");
}

async function ensureDrizzleScript(projectName: string): Promise<void> {
    const packageJsonPath = join(cwd(), "projects", projectName, "package.json");
    const parsed = JSON.parse(await readFile(packageJsonPath, "utf-8"));
    if (parsed?.scripts?.drizzle === undefined || parsed.scripts.drizzle === "") {
        if (!parsed.scripts) parsed.scripts = {};
        parsed.scripts.drizzle = "drizzle-kit";
        await writeFile(packageJsonPath, JSON.stringify(parsed, null, 2));
    }
}

async function buildDrizzleSchema(
    utils: any,
    cookbookToml: any,
    mode: string,
    reporter: Reporter,
): Promise<void> {
    if (reporter.json) reporter.log("Building drizzle schema ...");
    else progress.open("cookbook building..");
    try {
        const { initWatcher } = await import("../watcher");
        await initWatcher(cookbookToml, mode, false);
    } finally {
        if (reporter.json) reporter.log("Drizzle schema built.");
        else await progress.close("");
    }
}
