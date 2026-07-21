import consola from "consola";
import { join } from "node:path";
import { exit, cwd, env } from "node:process";
import { existsSync } from "node:fs";
import type { progress } from "../progress";
import { checkPort } from "../utils/check-port";
import { killPort } from "../utils/kill-port";
import type { CookbookOptions } from "./cookbook-dto-types";
import { calcHash } from "./calc-hash";
import { withPromptTimeout } from "./prompt-timeout";

export async function getCookbookToml(cookbookToml?: string, p?: typeof progress): Promise<CookbookOptions> {
    let options: any;
    if (cookbookToml) {
        const cookbookTomlHash = calcHash(cookbookToml);
        options = Bun.TOML.parse(cookbookToml);
        options.hash = cookbookTomlHash;
    } else {
        const cookbookToml = Bun.file(join(cwd(), "cookbook.toml"));
        if (!(await cookbookToml.exists())) {
            consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`);
            consola.info(`Hint: run "co init" in an empty directory to create a new cookbook project.`);
            exit(1);
        }
        const cookbookTomlText = await cookbookToml.text();
        const cookbookTomlHash = calcHash(cookbookTomlText);
        try {
            options = Bun.TOML.parse(cookbookTomlText);
        } catch (error: any) {
            consola.error(`Failed to parse "cookbook.toml": ${error?.message ?? error}`);
            consola.info(`Hint: check the TOML syntax at the line/column indicated above. See https://toml.io for the TOML specification.`);
            exit(1);
        }
        options.hash = cookbookTomlHash;
    }
    for (const projectName in options.projects) {
        const project = options.projects[projectName];
        if (!existsSync(join(cwd(), "projects", projectName, "package.json"))) {
            consola.error(`This project "${projectName}" does not exist (directory does not exist or there is no package.json), if the project has been deleted, please edit your "cookbook.toml" and delete [projects.${projectName}].`);
            exit(1);
        }
        if (project.drizzle) {
            for (const drizzleConfig of project.drizzle) {
                if (!drizzleConfig.mode) {
                    consola.error(`This project "${projectName}" has a drizzle configuration, but the "mode" is not specified.`);
                    exit(1);
                }
                if (!drizzleConfig.migrateDatabaseUrl) {
                    consola.error(`This project "${projectName}" has a drizzle configuration, but the "migrateDatabaseUrl" is not specified.`);
                    exit(1);
                }
                if (!drizzleConfig.migrateMode) {
                    consola.error(`This project "${projectName}" has a drizzle configuration, but the "migrateMode" is not specified.`);
                    exit(1);
                }
                const validMigrateModes = ["generate", "push", "any", "migrate"];
                if (!validMigrateModes.includes(drizzleConfig.migrateMode)) {
                    consola.error(`This project "${projectName}" has a drizzle configuration, but the "migrateMode" is not one of ${JSON.stringify(validMigrateModes)}.`);
                    exit(1);
                }
            }
        }
    }
    if (existsSync(join(env.HOME || env.USERPROFILE || "/", "cookbook.toml"))) {
        const homeCookbookToml = Bun.file(join(env.HOME || env.USERPROFILE || "/", "cookbook.toml"));
        const homeOptions: any = Bun.TOML.parse(await homeCookbookToml.text());
        if (homeOptions.config) {
            if (!options.config) options.config = {};
            for (const config in homeOptions.config) {
                if (!options.config?.[config]) options.config[config] = homeOptions.config[config];
            }
        }
    }

    if (!(await checkPort(options.general.cookbookPort))) {
        if (p) p.close("");
        consola.info(`Port number ${options.general.cookbookPort} is already occupied. Another process (possibly a previously started cookbook) is using it.`);
        const confirm = await withPromptTimeout(
            consola.prompt("Do you want to try to kill the process that is using the port number?", {
                type: "confirm",
            }) as Promise<boolean>,
            "kill port process",
            "This prompt cannot be bypassed with flags. Ensure the cookbook port is free before starting, or manually kill the process occupying the port.",
        );
        if (!confirm) exit(1);
        if (confirm) {
            try {
                await killPort(options.general.cookbookPort);
                await Bun.sleep(768);
            } catch (error) {
                consola.warn(`Failed to kill the process occupying port ${options.general.cookbookPort}: ${error instanceof Error ? error.message : error}`);
            }
            if (!(await checkPort(options.general.cookbookPort))) {
                consola.error("Attempted to kill the process occupying the port number, but this appears to be ineffective.");
                consola.info(`Hint: manually kill the process. On Windows: netstat -ano | findstr :${options.general.cookbookPort} | taskkill /PID <pid> /F. On Unix: lsof -i :${options.general.cookbookPort} | kill <pid>.`);
                exit(1);
            }
            if (p) p.close("");
        }
    }

    if (!options.general.packageManager) {
        consola.error(`Please specify "packageManager" in [general] of ${join(cwd(), "cookbook.toml")}, such as "npm", "pnpm", or "bun".`);
        exit(1);
    }

    return options;
}
