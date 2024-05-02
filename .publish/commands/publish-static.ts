import { $ } from "bun";
import { join } from "node:path";
import { useInteractiveCli } from "../uses/interactive-cli";
import { exists, readdir, readFile, writeFile } from "node:fs/promises";

export default async function () {
	const npmPackage = "milkio-static";

	const checkGitStatus = await $`git status --porcelain`.text();
	if (checkGitStatus.trim() !== "") {
		return console.log("请先提交所有更改，再执行此命令");
	}

	const interactiveCli = await useInteractiveCli();

	console.log("上个版本号:", JSON.parse(await readFile(join("packages", npmPackage, "package.json"), "utf8")).version);
	const newVersion = await interactiveCli.input("要发布的新版本号是");
	if (!/^(\d+)\.(\d+)\.(\d+)(-rc|-beta|-alpha)?$/.test(newVersion)) {
		return console.log("错误的版本号，未能满足正则表达式的校验");
	}

	console.clear();

	try {
		await $`npm view ${npmPackage}@${newVersion} --json`.quiet();
		console.log("该版本已存在，不进行 npm 发布");
	} catch (error) {
		const packageJson = await readFile(join("packages", npmPackage, "package.json"), "utf8");
		await writeFile(join("packages", npmPackage, "package.json"), packageJson.replace(/"version": ".*"/, `"version": "${newVersion}"`));
		await $`cd ${join("packages", npmPackage)} && npm publish --access public`;
	}

	console.log("\n\n🎉 发布成功\n");
	console.log(`- npm: https://www.npmjs.com/package/${npmPackage}/v/${newVersion}`);
}
