import { $ } from "bun";
import { join } from "node:path";
import { Octokit } from "@octokit/core";
import { useMinimax } from "../uses/minimax";
import { useInteractiveCli } from "../uses/interactive-cli";
import { exists, readdir, readFile, writeFile } from "node:fs/promises";
import { config } from "../config";

export default async function () {
	const npmPackage = "milkio";
	const owner = "akirarika";
	const repo = "milkio";

	const interactiveCli = await useInteractiveCli();

	const releases = await readdir(join(".publish", "releases"));
	const lastVersion = releases.at(0)!.slice(0, -3);
	console.log("上个版本号:", JSON.parse(await readFile(join("packages", npmPackage, "package.json"), "utf8")).version);
	const newVersion = await interactiveCli.input("要发布的新版本号是");
	if (!/^(\d+)\.(\d+)\.(\d+)((-rc|-beta|-alpha)\.(\d+))?$/.test(newVersion)) {
		return console.log("错误的版本号，未能满足正则表达式的校验");
	}

	console.clear();

	try {
		await $`npm view ${npmPackage}@${newVersion} --json`.quiet();
		console.log("该版本已存在，不进行 npm 发布");
	} catch (error) {
		if ((await interactiveCli.select("\n提交 git 并推送至 npm 吗？", ["否，我只是想预创建版本说明", "是，继续"])) === "是，继续") {
			const packageJson = await readFile(join("packages", "milkio", "package.json"), "utf8");
			await writeFile(join("packages", "milkio", "package.json"), packageJson.replace(/"version": ".*"/, `"version": "${newVersion}"`));

			const checkGitStatus = await $`git status --porcelain`.text();
			if (checkGitStatus.trim() !== "") {
				const gitUser = {
					mail: "33272184+akirarika@users.noreply.github.com",
					name: "akirarika",
				}
				await $`git config user.email ${gitUser.mail}`;
				await $`git config user.name ${gitUser.name}`;
				await $`git add --all`;
				await $`${{ raw: `git commit -m "🎈 publish: v${newVersion}"` }}`;
				await $`git push -u origin ${(await $`git symbolic-ref --short HEAD`).text().trim()}`;
			}

			await $`cd ${join("packages", "milkio")} && npm publish --access public`;
		}
	}

	console.log("🧊 如果版本是修复 bug 版本 (仅最小版本号增加) 则无需编写发行说明");
	if ((await interactiveCli.select("要编写发行说明吗？", ["否", "是"])) === "是") {
		console.clear();
		if (await exists(join(".publish", "releases", `${newVersion}.md`))) {
			console.log("已存在该版本的发布说明文件，你可能输入了一个已经存在的版本号");
			if ((await interactiveCli.select("确定使用此版本吗？", ["否", "是"])) === "否") return;
			console.log("🧊 请编辑发行说明文件，并在编辑完成后，再继续操作 (VS Code 按住 Ctrl 键点击下方路径可快速编辑)\n");
		} else {
			const markdownTemplate = `# ${newVersion} - 某章节名\n\n> 一段编纂出来的虚构科幻小说的摘抄片段\n\n## ...更新内容...\n\n...更新内容...\n\n## 升级\n\n\`\`\`\nbun i milkio@${newVersion}\n\`\`\``;
			await writeFile(join(".publish", "releases", `${newVersion}.md`), markdownTemplate);
			console.log("🧊 已创建发行说明文件。请编辑它，并在编辑完成后，再继续操作 (VS Code 按住 Ctrl 键点击下方路径可快速编辑)\n");
		}

		let releaseNote: string;
		let releaseGithubNote: string;

		while (true) {
			console.log(`/.publish/releases/${newVersion}.md`);
			if ((await interactiveCli.select("\n编辑好了吗？按 Ctrl + C 并退出，日后继续发版是安全的", ["否", "是"])) === "是") break;
			console.clear();
		}

		while (true) {
			console.log(`/.publish/releases/${newVersion}.md`);
			releaseNote = await readFile(join(".publish", "releases", `${newVersion}.md`), "utf8");
			if (releaseNote.includes("...更新内容...")) {
				console.log(`含有 "...更新内容..." 内容，校验未通过，请重新编辑它`);
				alert("按回车以继续");
				continue;
			}
			if (releaseNote.includes("某章节名")) {
				console.log(`含有 "某章节名" 内容，校验未通过，请重新编辑它`);
				alert("按回车以继续");
				continue;
			}
			if (releaseNote.includes("一段编纂出来的虚构科幻小说的摘抄片段")) {
				console.log(`含有 "一段编纂出来的虚构科幻小说的摘抄片段" 内容，校验未通过，请重新编辑它`);
				alert("按回车以继续");
				continue;
			}
			console.clear();
			break;
		}

		const minimax = await useMinimax();

		while (true) {
			console.log("发行说明翻译中..");
			releaseGithubNote = await minimax.translateDoc(releaseNote, "中文");
			const releaseGithubNoteTranslated = await minimax.translateDoc(releaseGithubNote, "英文");
			await writeFile(join(".publish", "releases-github", `${newVersion}.md`), `${releaseGithubNote}\n\n----------------\n\n${releaseGithubNoteTranslated}`);
			console.log("发行说明翻译完成");
			console.log("🧊 请编辑它，检查翻译的内容是否合理");
			console.log("其中，还重新回译了一份译文，你可以结合译文和回译译文，来判断结果是否有错漏。在正式提交前，需删除回译的译文\n");
			console.log(`/.publish/releases-github/${newVersion}.md`);
			if ((await interactiveCli.select("\n检查完毕并继续吗？", ["否，重新翻译", "是，继续"])) === "是，继续") break;
			console.log("好的，即将重新翻译..");
			console.clear();
		}

		while (true) {
			console.log(`/.publish/releases-github/${newVersion}.md`);
			releaseGithubNote = await readFile(join(".publish", "releases-github", `${newVersion}.md`), "utf8");
			if (releaseGithubNote.includes("----------------")) {
				console.log(`含有 "分割线(---)" 内容，校验未通过，请重新编辑它`);
				alert("按回车以继续");
				continue;
			}
			break;
		}

		const octokit = new Octokit({
			auth: config.github.token,
		});

		await octokit.request(`POST /repos/${owner}/${repo}/releases`, {
			owner,
			repo,
			tag_name: `v${newVersion}`,
			target_commitish: "main",
			name: `v${newVersion}`,
			body: releaseGithubNote,
			draft: false,
			prerelease: false,
			generate_release_notes: false,
			headers: {
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});

		await fetch(`https://gitee.com/api/v5/repos/${owner}/${repo}/releases`, {
			method: "POST",
			body: (() => {
				const body = new FormData();
				body.append("access_token", config.gitee.token);
				body.append("owner", config.gitee.token);
				body.append("repo", repo);
				body.append("tag_name", `v${newVersion}`);
				body.append("target_commitish", "main");
				body.append("name", `v${newVersion}`);
				body.append("body", releaseNote);
				body.append("prerelease", "false");
				return body;
			})(),
		});

		await $`git add --all && git commit -m "🎉 release: v${newVersion}"`;
	}

	console.log("\n\n🎉 发布成功\n");
	console.log(`- npm: https://www.npmjs.com/package/${npmPackage}/v/${newVersion}`);
	console.log(`- gitee: https://gitee.com/${owner}/${repo}/releases/tag/v${newVersion}`);
	console.log(`- github: https://github.com/${owner}/${repo}/releases/tag/v${newVersion}`);
	console.log(`- 安装命令: bun i ${npmPackage}@${newVersion}`);
}
