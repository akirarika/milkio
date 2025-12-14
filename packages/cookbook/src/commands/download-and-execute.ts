import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import { __VERSION__ } from "../../__VERSION__";
import { execScript } from "../utils/exec-script";

export default await defineCookbookCommand(async (utils, inputPackageName?: string) => {
    const params = utils.getParams();

    let packageName = inputPackageName ?? params.commands[0];
    if (!packageName) {
        consola.error("Package name is required");
        exit(1);
    }

    const cookbookToml = await utils.getCookbookToml();
    const packageManager = cookbookToml.general.packageManager;
    if (packageManager === "npm") await execScript(`npx ${packageName}`, { cwd: join(cwd(), "projects") });
    else if (packageManager === "yarn") await execScript(`yarn dlx ${packageName}`, { cwd: join(cwd(), "projects") });
    else if (packageManager === "pnpm") await execScript(`pnpm dlx ${packageName}`, { cwd: join(cwd(), "projects") });
    else if (packageManager === "bun") await execScript(`bun x ${packageName}`, { cwd: join(cwd(), "projects") });
    else {
        consola.error(`Package manager ${packageManager} is not supported`);
        exit(1);
    }
});
