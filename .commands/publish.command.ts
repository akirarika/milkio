import { defineCookbookCommand } from "@milkio/cookbook-command";
import { $ } from "bun";
import OpenAI from "openai";
import { join } from "node:path";
import { homedir } from "node:os";
import { exists, mkdir, readFile, writeFile } from "node:fs/promises";
import { Octokit } from "@octokit/core";
import { cli } from "./utils/cli.ts";
import consola from "consola";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { rmSync } from "fs-extra";

const mainPackage = "milkio";
const childPackages = ["cookbook", "create-cookbook", "cookbook-command", "milkio-astra", "milkio-redis", "milkio-stargate", "vite-plugin-milkio"];

export default await defineCookbookCommand(async (utils) => {
  console.log("");
  console.log("[发布版本]");
  console.log("将代码发布到 NPM 中，并可选地在 Github 和 Gitee 上同步发布");
  console.log("");

  const cwd = join(process.cwd());

  let config: any;
  try {
    config = (await import(join(homedir(), "cookbook.config.ts"))).config;
  } catch (error) {
    consola.error(`未找到配置文件，请在 ${join(homedir(), "cookbook.config.ts")} 中编写你的配置`);
    console.log(`export const config = {
    github: {
      token: "<YOUR_TOKEN>",
    },
    gitee: {
      token: "<YOUR_TOKEN>",
    },
    LLM: {
      minimax: {
        groupId: "<YOUR_GROUP_ID>",
        appKey:
          "<YOUR_APP_KEY>",
      },
    },
  };`);
    process.exit(0);
  }

  console.log("发布路径", cwd);

  if (!(await exists(join(cwd, ".commands", "publish"))) || !(await exists(join(cwd, ".commands", "publish", "publish.json")))) {
    console.log("此项目还未进行过发布配置，是否初始化？");
    const selected = await cli.select("选择", ["是", "否"]);
    if (selected === "否") process.exit(0);
    const publishJson = {
      githubOwner: "akirarika",
      githubRepo: "YOUR_REPO_NAME",
      giteeOwner: "akirarika",
      giteeRepo: "YOUR_REPO_NAME",
    };
    if (!(await exists(join(cwd, ".commands", "publish")))) await mkdir(join(cwd, ".commands", "publish"));
    if (!(await exists(join(cwd, ".commands", "publish", "releases")))) await mkdir(join(cwd, "releases"));
    if (!(await exists(join(cwd, ".commands", "publish", "releases-english")))) await mkdir(join(cwd, "releases-english"));
    await writeFile(join(cwd, ".commands", "publish", "publish.json"), JSON.stringify(publishJson, null, 2), "utf-8");

    console.log("初始化完成");
    console.log(`编写 ${join(cwd, ".commands", "publish", "publish.json")} 文件，将其中的内容修改为合适的内容`);

    process.exit(0);
  }

  if ((await $`git status --porcelain`.text()).trim()) {
    console.log("当前目录存在未提交的变更，请先提交再发布版本");
    console.log("co git:commit");
    process.exit(0);
  }

  const packageJson = JSON.parse(await readFile(join(cwd, "packages", mainPackage, "package.json"), "utf-8"));
  const publishJson = JSON.parse(await readFile(join(cwd, ".commands", "publish", "publish.json"), "utf-8"));

  const lastVersion = packageJson.version;
  consola.success("上个版本号:", lastVersion);

  const newVersion = (await cli.input("要发布的新版本号是")) ?? "";
  if (!/^(\d+)\.(\d+)\.(\d+)((-rc|-beta|-alpha)\.(\d+))?$/.test(newVersion)) {
    console.log("错误的版本号，未能满足正则表达式的校验");
    process.exit(0);
  }
  console.clear();

  try {
    console.log(`检查 npm 版本是否存在.. npm view ${packageJson.name}@${newVersion} --json`);
    await $`npm view ${packageJson.name}@${newVersion} --json`.quiet();
    console.log("该版本已存在，跳过 npm 发布");
  } catch (error) {
    if ((await cli.select("\n修改版本号并推送至 npm 吗？", ["是，继续", "否，我只是想预创建版本说明"])) === "是，继续") {
      // 更新 package.json 中的版本号并保存
      packageJson.version = newVersion;
      await writeFile(join(cwd, "packages", mainPackage, "package.json"), JSON.stringify(packageJson, null, 2));
      for (const childPackage of childPackages) {
        const childPackageJson = JSON.parse(await readFile(join(cwd, "packages", childPackage, "package.json"), "utf-8"));
        childPackageJson.version = newVersion;
        await writeFile(join(cwd, "packages", childPackage, "package.json"), JSON.stringify(childPackageJson, null, 2));
      }

      const checkGitStatus = await $`git status --porcelain`.text();
      if (checkGitStatus.trim() !== "") {
        await $`git add --all`;
        await $`${{ raw: `git commit -m "🎈 publish: v${newVersion}"` }}`;
        await $`git push -u origin ${(await $`git symbolic-ref --short HEAD`).text().trim()}`;
      }

      // 将 cookbook-ui 的静态资源打包并发布
      consola.log("正在打包 cookbook-ui 的静态资源..");
      if (!(await existsSync(join(cwd, "../canto-projects/projects/cookbook-ui/package.json")))) throw new Error("未找到 cookbook-ui 项目");
      execFileSync("npm", ["run", "generate"], { stdio: "inherit", shell: true, cwd: join(cwd, "../canto-projects/projects/cookbook-ui") });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await writeFile("../canto-projects/projects/cookbook-ui/.output/public/__cookbook_ui__.js", `console.log("This package is used to distribute cookbook-ui binaries. You can run it directly.");`);
      await writeFile(
        "../canto-projects/projects/cookbook-ui/.output/public/package.json",
        JSON.stringify({
          name: "@milkio/cookbook-ui",
          type: "module",
          version: packageJson.version,
          module: "./__cookbook_ui__.js",
        }),
      );
      execFileSync("powershell.exe", ["-Command", "npm publish --access public"], { stdio: "inherit", cwd: "../canto-projects/projects/cookbook-ui/.output/public" });
      consola.success("cookbook-ui 静态资源打包并发布成功");

      // 打包 cookbook 的二进制文件并发布
      await (async () => {
        consola.log("正在打包 cookbook 的二进制文件..");
        const platforms = [
          {
            platform: "darwin",
            arch: "arm64",
            target: "bun-darwin-arm64",
          },
          {
            platform: "darwin",
            arch: "x64",
            target: "bun-darwin-x64",
          },
          {
            platform: "linux",
            arch: "arm64",
            target: "bun-linux-arm64",
          },
          {
            platform: "linux",
            arch: "x64",
            target: "bun-linux-x64-baseline",
          },
          {
            platform: "win32",
            arch: "x64",
            target: "bun-windows-x64-baseline",
          },
        ];

        if (!existsSync("./packages/cookbook/dist")) await mkdir("./packages/cookbook/dist");
        const packageJson = JSON.parse(await readFile("./packages/cookbook/package.json", "utf-8"));

        for (const platform of platforms) {
          consola.log(`正在打包 ${platform.platform} ${platform.arch} 的二进制文件..`);
          const command = `bun build ./packages/cookbook/cookbook.ts --outfile ./packages/cookbook/dist/cookbook-${platform.platform}-${platform.arch}/co --compile --minify --sourcemap=inline --env=COOKBOOK_* --target=${platform.target}`;
          execFileSync("powershell.exe", ["-Command", command], { stdio: "inherit", env: { ...process.env, COOKBOOK_PRODUCTION: "true" } });
          await writeFile(`./packages/cookbook/dist/cookbook-${platform.platform}-${platform.arch}/index.js`, `console.log("This package is used to distribute cookbook binaries. You can run it directly.");`);
          await writeFile(
            `./packages/cookbook/dist/cookbook-${platform.platform}-${platform.arch}/package.json`,
            JSON.stringify({
              name: `@milkio/cookbook-${platform.platform}-${platform.arch}`,
              type: "module",
              version: packageJson.version,
              module: "./index.js",
            }),
          );
          execFileSync("powershell.exe", ["-Command", "npm publish --access public"], { stdio: "inherit", cwd: `./packages/cookbook/dist/cookbook-${platform.platform}-${platform.arch}` });
        }
        consola.success("cookbook 二进制文件打包并发布成功");
      })();

      // 将包发布到 npm
      for (const childPackage of [mainPackage, ...childPackages]) {
        if (childPackage !== "cookbook" && childPackage !== "cookbook-ui" && childPackage !== "create-cookbook") {
          consola.log(`正在打包 ${childPackage} 到 dist..`);
          rmSync(join(cwd, "packages", childPackage, "dist"), { recursive: true, force: true });
          await Bun.build({
            entrypoints: [join(cwd, "packages", childPackage, "index.ts")],
            outdir: join(cwd, "packages", childPackage, "dist"),
            target: "node",
            format: "esm",
            splitting: true,
            sourcemap: "inline",
            minify: true,
          });
          try {
            await $`bun ../../node_modules/typescript/bin/tsc index.ts --declaration --emitDeclarationOnly --outDir ./dist --module nodenext --moduleResolution nodenext --allowImportingTsExtensions`.cwd(join(cwd, "packages", childPackage)).quiet();
          } catch (error) {}
          await Bun.write(join(cwd, "packages", childPackage, "dist", "LICENSE"), await Bun.file(join(cwd, "LICENSE")).text());
          const packageJson = JSON.parse(await readFile(join(cwd, "packages", childPackage, "package.json"), "utf-8"));
          const dependencies: Record<string, any> = {};
          if (childPackage === "milkio") dependencies["@southern-aurora/tson"] = "*";
          await writeFile(
            join(cwd, "packages", childPackage, "dist", "package.json"),
            JSON.stringify({
              name: packageJson.name,
              version: packageJson.version,
              type: "module",
              module: "./index.js",
              types: "./index.d.ts",
              dependencies,
            }),
          );

          consola.log(`正在发布 ${childPackage} 的 dist到 npm..`);
          while (true) {
            try {
              let command = "npm publish --access public";
              if (newVersion.includes("-rc")) command += " --tag rc";
              else if (newVersion.includes("-beta")) command += " --tag beta";
              else if (newVersion.includes("-alpha")) command += " --tag alpha";
              await $`${{ raw: command }}`.cwd(join(cwd, "packages", childPackage, "dist"));
              await Bun.sleep(1000);
              break;
            } catch (error: any) {
              console.log(error);
              console.log(error?.message ?? "");
              if ((await cli.select(`\n${childPackage} 发布失败，可能是网络异常，是否重试？`, ["是", "否"])) === "是") {
                console.log("好的，即将重试..");
              } else {
                console.log("已退出发布");
                process.exit(0);
              }
            }
          }
        } else {
          consola.log(`正在直接发布 ${childPackage} 到 npm..`);
          await Bun.write(join(cwd, "packages", childPackage, "dist", "LICENSE"), await Bun.file(join(cwd, "LICENSE")).text());
          while (true) {
            try {
              let command = "npm publish --access public";
              if (newVersion.includes("-rc")) command += " --tag rc";
              else if (newVersion.includes("-beta")) command += " --tag beta";
              else if (newVersion.includes("-alpha")) command += " --tag alpha";
              await $`${{ raw: command }}`.cwd(join(cwd, "packages", childPackage));
              await Bun.sleep(1000);
              break;
            } catch (error: any) {
              console.log(error);
              console.log(error?.message ?? "");
              if ((await cli.select(`\n${childPackage} 发布失败，可能是网络异常，是否重试？`, ["是", "否"])) === "是") {
                console.log("好的，即将重试..");
              } else {
                console.log("已退出发布");
                process.exit(0);
              }
            }
          }
        }
      }
    }
  }

  consola.success(`所有的包均发布完成：${[mainPackage, ...childPackages].join(", ")}`);

  console.log("\n如果版本是修复 bug 版本 (仅最小版本号增加) 则无需编写发行说明");
  if ((await cli.select("要编写发行说明吗？", ["否", "是"])) === "是") {
    console.clear();
    if (await exists(join(cwd, ".commands", "publish", "releases", `${newVersion}.md`))) {
      console.log("已存在该版本的发布说明文件，你可能输入了一个已经存在的版本号");
      if ((await cli.select("确定使用此版本吗？", ["否", "是"])) === "否") process.exit(0);
      console.log("请编辑发行说明文件，并在编辑完成后，再继续操作 (VS Code 按住 Ctrl 键点击下方路径可快速编辑)\n");
    } else {
      const markdownTemplate = `# ${newVersion} - 某章节名\n\n> 一段编纂出来的虚构科幻小说的摘抄片段\n\n## ...更新内容...\n\n...更新内容...\n\n## 升级\n\n\`\`\`\nbun i ${packageJson.name}@${newVersion}\n\`\`\``;
      await writeFile(join(cwd, ".commands", "publish", "releases", `${newVersion}.md`), markdownTemplate);
      console.log("已创建发行说明文件。请编辑它，并在编辑完成后，再继续操作 (VS Code 按住 Ctrl 键点击下方路径可快速编辑)\n");
    }

    let releaseNote: string;
    let releaseGithubNote: string;

    while (true) {
      console.log(join(cwd, ".commands", "publish", "releases", `${newVersion}.md`));
      if ((await cli.select("\n编辑好了吗？按 Ctrl + C 并退出，日后继续发版是安全的", ["否", "是"])) === "是") break;
      console.clear();
    }

    while (true) {
      console.log(join(cwd, ".commands", "publish", "releases", `${newVersion}.md`));
      releaseNote = await readFile(join(cwd, ".commands", "publish", "releases", `${newVersion}.md`), "utf8");
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

    const openai = new OpenAI({
      baseURL: "https://api.minimax.chat/v1",
      apiKey: config.LLM.minimax.appKey,
    });
    const translateToEnglish = async (message: string) => {
      const prompts = `
      ##背景
      你是一个好用的翻译助手。请将内容翻译成英文。我发给你所有的话都是需要翻译的内容，你只需要回答翻译结果。翻译结果请符合英文的语言习惯。
      下面是一份词汇对照表，当涉及到相关词汇时请使用对应的翻译。
      
      ##专业词汇
      遇到下方专业词汇时，请将其翻译成对应的单词。
      固执己见=opinionated
      渐进式=progressive
      环境变量=environment
      
      ##注意事项
      1. 确保专业术语的准确使用。
      2. 对敏感词汇体现必要的敏感性。
      3. 严格保持文章的原 Markdown 格式。
      4. 严格保持回复的内容仅包含润色后的文章本身，不包含任何多余的话，也不需要请求用户提出反馈。
      `;
      const chatCompletion = await openai.chat.completions.create({
        model: "abab6.5s-chat",
        messages: [
          { role: "system", content: prompts },
          { role: "user", content: message },
        ],
      });

      return chatCompletion.choices[0].message.content ?? "";
    };

    while (true) {
      console.log("发行说明翻译中..");
      releaseGithubNote = await translateToEnglish(releaseNote);
      const releaseGithubNoteTranslated = await translateToEnglish(releaseGithubNote);
      await writeFile(join(cwd, ".commands", "publish", "releases-english", `${newVersion}.md`), `${releaseGithubNote}\n\n----------------\n\n${releaseGithubNoteTranslated}`);
      console.log("发行说明翻译完成");
      console.log("请编辑它，检查翻译的内容是否合理");
      console.log("其中，还重新回译了一份译文，你可以结合译文和回译译文，来判断结果是否有错漏。在正式提交前，需删除回译的译文\n");
      console.log(join(cwd, ".commands", "publish", "releases-english", `${newVersion}.md`));
      if ((await cli.select("\n检查完毕并继续吗？", ["否，重新翻译", "是，继续"])) === "是，继续") break;
      console.log("好的，即将重新翻译..");
      console.clear();
    }

    while (true) {
      console.log(join(cwd, ".commands", "publish", "releases-english", `${newVersion}.md`));
      releaseGithubNote = await readFile(join(cwd, ".commands", "publish", "releases-english", `${newVersion}.md`), "utf8");
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

    await octokit.request(`POST /repos/${publishJson.githubOwner}/${publishJson.githubRepo}/releases`, {
      owner: publishJson.githubOwner,
      repo: publishJson.githubRepo,
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

    await fetch(`https://gitee.com/api/v5/repos/${publishJson.giteeOwner}/${publishJson.giteeRepo}/releases`, {
      method: "POST",
      body: (() => {
        const body = new FormData();
        body.append("access_token", config.gitee.token);
        body.append("owner", config.gitee.token);
        body.append("repo", publishJson.giteeRepo);
        body.append("tag_name", `v${newVersion}`);
        body.append("target_commitish", "main");
        body.append("name", `v${newVersion}`);
        body.append("body", releaseNote);
        body.append("prerelease", "false");
        return body;
      })(),
    });

    const checkGitStatus = await $`git status --porcelain`.text();
    if (checkGitStatus.trim() !== "") {
      await $`git add --all`;
      await $`${{ raw: `git commit -m "release: v${newVersion}"` }}`;
      await $`git push -u origin ${(await $`git symbolic-ref --short HEAD`).text().trim()}`;
    }
  }

  console.log("\n\n发布成功\n");
  console.log(`- npm: https://www.npmjs.com/package/${packageJson.name}/v/${newVersion}`);
  console.log(`- gitee: https://gitee.com/${publishJson.giteeOwner}/${publishJson.giteeRepo}/releases/tag/v${newVersion}`);
  console.log(`- github: https://github.com/${publishJson.githubOwner}/${publishJson.githubRepo}/releases/tag/v${newVersion}`);
  console.log(`- 安装命令: bun i ${packageJson.name}@${newVersion}`);
});
