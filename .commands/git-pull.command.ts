import { defineCookbookCommand } from "@milkio/cookbook-command";
import { gitUserCheck } from "./utils/git-user-check.ts";
import { $ } from "bun";
import consola from "consola";

export default await defineCookbookCommand(async (utils) => {
  const cookbookToml = await utils.getCookbookToml();
  await gitUserCheck();

  let branch: any;
  try {
    branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
  } catch (error) {
    branch = await utils.inputString({
      env: "branch",
      message: "Enter Git branch name",
      placeholder: "feature/your-feature-name",
    });
  }
  try {
    consola.start(`Syncing code from origin/${branch}`);
    await $`git pull origin ${branch}:${branch}`;
  } catch (error) {
    consola.warn("Git pull failed: Common causes include uncommitted local changes. Check the logs above for details.");
    process.exit(0);
  }

  consola.success(`Code pull completed for branch '${branch}'.`);
});
