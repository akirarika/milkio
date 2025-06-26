import { $ } from "bun";
import consola from "consola";

export async function gitUserCheck() {
  let userEmail = undefined;
  let userName = undefined;
  try {
    userEmail = (await $`git config user.email`.text()).trim();
  } catch (error) {}
  try {
    userName = (await $`git config user.name`.text()).trim();
  } catch (error) {}
  if (!userEmail || !userName || userEmail === "" || userName === "" || userName === "You") {
    consola.info("Git Configuration Required");
    consola.warn("No git user configured for this repository");
    consola.log("┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈");
    consola.info("For public repositories:");
    consola.success("• GitHub users should enable email privacy to get a masked email");
    consola.log("• Example: 33272184+akirarika@users.noreply.github.com");

    userEmail = (await consola.prompt("📧 Enter email", {
      type: "text",
      placeholder: "your@example.com",
    })) as string;

    if (typeof userEmail !== "string" || !userEmail?.trim()) {
      consola.error("Email cannot be empty");
      process.exit(1);
    }

    consola.info("Username Guidelines");
    consola.warn("Important notes for GitHub users");
    consola.log("┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈");
    consola.success("• Must match your GitHub profile username (not display name)");
    consola.log("• Check your GitHub profile URL for correct username");

    userName = (await consola.prompt("👤 Enter username", {
      type: "text",
      placeholder: "your name",
    })) as string;

    if (typeof userName !== "string" || !userName?.trim()) {
      consola.error("Username cannot be empty");
      process.exit(1);
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(userEmail)) {
      consola.error("❌ Invalid email format");
      process.exit(1);
    }
    if (!/^[a-zA-Z0-9._%+-]+$/.test(userName)) {
      consola.error("❌ Invalid username format");
      process.exit(1);
    }

    await $`git config user.email ${userEmail}`;
    await $`git config user.name ${userName}`;
    await $`git config --global pull.rebase true`;
    await $`git config --global merge.strategy recursive`;

    consola.info("\n✅ Git configuration updated successfully");
  }

  return {
    userEmail,
    userName,
  };
}
