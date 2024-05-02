import { join } from "node:path";
import { cwd } from "node:process";
import { platform } from "node:os";
import { exists } from "node:fs/promises";
import { useInteractiveCli } from "./uses/interactive-cli";

export const commands: Record<string, () => any> = {
	"Publish: Milkio": () => import("./commands/publish-milkio"),
	"Publish: Milkio Static": () => import("./commands/publish-static"),
};

console.log("----------------");
console.warn("Currently, the maintainers mainly come from Shanghai and Singapore, so for the time being, Chinese will be used as the language for the release notes.");
console.warn(
	"Please note that using this script requires you to configure a lot of things, including some services that can only be registered and accessed properly if you understand Chinese. It is highly recommended to contact warehouse administrators located in Shanghai or Singapore to help you run it, instead of attempting to run it yourself.",
);
console.log("----------------");

if (platform() === "win32") {
	console.log("目前，Windows 没有适配版本。请在 WSL 中运行，帮助我们进行适配");
	console.log("Currently, there is no adaptation for Windows. Please run it in WSL or help us with the adaptation");
	process.exit(0);
}

if (!(await exists(join(".publish", "config.ts")))) {
	console.log("该脚本需要进行一些配置，包括Github和MiniMax的密钥以及其他内容。请复制文件“/.publish/config.template.ts”，并将其重命名为“/.publish/config.ts”，然后填写相关配置信息。如果您缺少某些配置信息，可以联系存储库管理员，他们应该乐意为您提供一份副本");
	console.log(
		"The script requires some configurations, including keys for Github and MiniMax and others. Please copy the file /.publish/config.template.ts and rename it to /.publish/config.ts, then fill in the relevant configurations. If you are missing some configurations, you can contact the repository manager, who should be happy to provide you with a copy",
	);
	process.exit(0);
}

if (cwd().includes(".publish")) {
	console.log("The script should be run in the root of the repository, not in the /.publish directory");
	process.exit(0);
}

const interactiveCli = await useInteractiveCli();
const command = await interactiveCli.autocomplete("🦄 Which one should I publish?", Object.keys(commands));

await (await commands[command]()).default();

process.exit(0);
