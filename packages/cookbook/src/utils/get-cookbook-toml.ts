import consola from "consola";
import { join } from "node:path";
import { exit, cwd, env } from "node:process";
import { existsSync } from "node:fs";
import type { progress } from "../progress";
import { checkPort } from "../utils/check-port";
import { killPort } from "../utils/kill-port";
import type { CookbookOptions } from "./cookbook-dto-types";
import { calcHash } from "./calc-hash";

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
            exit(0);
        }
        const cookbookTomlText = await cookbookToml.text();
        const cookbookTomlHash = calcHash(cookbookTomlText);
        options = Bun.TOML.parse(cookbookTomlText);
        options.hash = cookbookTomlHash;
    }
    if (Object.keys(options.projects ?? []).length === 0) {
        consola.error(`For at least one project, check your "cookbook.toml".`);
        exit(0);
    }
    for (const projectName in options.projects) {
        const project = options.projects[projectName];
        if (!existsSync(join(cwd(), "projects", projectName, "package.json"))) {
            consola.error(`This project "${projectName}" does not exist (directory does not exist or there is no package.json), if the project has been deleted, please edit your "cookbook.toml" and delete [projects.${projectName}].`);
            exit(0);
        }
        if (project.drizzle) {
            for (const key in project.prisma) {
                const prisma = project.prisma[key];
                if (!prisma.mode) {
                    consola.error(`This project "${projectName}" has a prisma configuration, but the "mode" is not specified.`);
                    exit(0);
                }
                if (!prisma.migrateDatabaseUrl) {
                    consola.error(`This project "${projectName}" has a prisma configuration, but the "migrateDatabaseUrl" is not specified.`);
                    exit(0);
                }
                if (!prisma.migrateMode) {
                    consola.error(`This project "${projectName}" has a prisma configuration, but the "migrateMode" is not specified.`);
                    exit(0);
                }
                if (prisma.migrateMode !== "migrate" && prisma.migrateMode !== "push") {
                    consola.error(`This project "${projectName}" has a prisma configuration, but the "migrateMode" is not specified as "migrate" or "push".`);
                    exit(0);
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
        consola.info(`Port number ${options.general.cookbookPort} is already occupied. You may have started Cookbook.`);
        const confirm = await consola.prompt("Do you want to try to kill the process that is using the port number?", {
            type: "confirm",
        });
        if (!confirm) exit(0);
        if (confirm) {
            try {
                await killPort(options.general.cookbookPort);
                await Bun.sleep(768);
            } catch (error) { }
            if (!(await checkPort(options.general.cookbookPort))) {
                consola.error("Attempted to kill the process occupying the port number, but this appears to be ineffective.");
                await exit(0);
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
