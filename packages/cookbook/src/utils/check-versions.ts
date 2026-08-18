import consola from "consola";
import { join } from "node:path";
import { exists } from "node:fs/promises";
import { exit } from "node:process";
import { __VERSION__ } from "../../__VERSION__";

// co.exe 编译时构建环境（milkio 工作区）声明的依赖版本。
// co test/dev 等会驱动项目里 .milkio 的 typia 生成，而 typia 的 ttsc 插件是
// Go 源码（native/cmd/ttsc-typia），其 driver API 与 ttsc 版本强耦合。
// 项目安装的 typia/ttsc 版本若与 co 构建时不一致（更高或更低），Go 插件会
// 构建失败（如 driver.NewTransformGraph undefined），导致 typia 不出 schema、
// route-schema 丢路由、co.exe 0 routes。因此这里做严格一致性校验。
//
// 注意：该清单必须与 packages/cookbook/package.json 中的版本保持同步，
// 每次升级 typia/ttsc 后需同步更新这里。
// milkio 版本必须与当前 co 二进制自身版本一致（引用 __VERSION__，发布时自动同步，
// 不再硬编码——硬编码会在每次 bun.publ.ts bump 版本后立即失配，导致 CI 里 co generate 自校验失败）
const REQUIRED_VERSIONS: Record<string, string> = {
  typia: "14.0.0",
  ttsc: "0.27.0",
  milkio: __VERSION__,
};

// 显式禁用检查：co --no-check-versions，或环境变量 CO_NO_CHECK_VERSIONS=1
export function versionCheckDisabled(rawArgs: Array<string>): boolean {
  if (process.env.CO_NO_CHECK_VERSIONS === "1" || process.env.CO_NO_CHECK_VERSIONS === "true") return true;
  return rawArgs.includes("--no-check-versions");
}

function normalizeVersion(v: string | undefined): string | undefined {
  if (!v) return undefined;
  return v.trim().replace(/^[~^>=<\s]+/, "");
}

function mismatchError(name: string, expected: string, declared: string | undefined, installed: string | undefined): string {
  const lines = [
    `version mismatch: "${name}" 需要与 co 二进制构建版本严格一致`,
    `  co 期望版本:   ${expected}`,
    `  项目声明版本:  ${declared ?? "(未声明)"}`,
    `  项目安装版本:  ${installed ?? "(未安装)"}`,
  ];
  return lines.join("\n");
}

// 检查当前工作区 package.json 声明与 node_modules 实际安装版本是否与 co 构建版本一致。
// 不一致（偏高或偏低）即打印错误并退出 1。版本完全一致时静默通过。
export async function checkVersions(cwd: string): Promise<void> {
  const pkgJsonPath = join(cwd, "package.json");
  if (!(await exists(pkgJsonPath))) return;

  let pkgJson: any;
  try {
    pkgJson = JSON.parse(await Bun.file(pkgJsonPath).text());
  } catch {
    return;
  }

  const errors: Array<string> = [];

  for (const name of Object.keys(REQUIRED_VERSIONS)) {
    const expected = REQUIRED_VERSIONS[name];

    // 声明版本：dependencies / devDependencies / peerDependencies 任意一处出现即校验
    let declared: string | undefined;
    for (const sec of ["dependencies", "devDependencies", "peerDependencies"]) {
      if (pkgJson?.[sec]?.[name]) {
        declared = pkgJson[sec][name];
        break;
      }
    }

    // 安装版本：优先 node_modules/<name>/package.json 的 version 字段
    let installed: string | undefined;
    const installedPkgPath = join(cwd, "node_modules", name, "package.json");
    if (await exists(installedPkgPath)) {
      try {
        installed = JSON.parse(await Bun.file(installedPkgPath).text())?.version;
      } catch {
        installed = undefined;
      }
    }

    const declaredNorm = normalizeVersion(declared);
    const installedNorm = normalizeVersion(installed);

    // 声明了但版本不一致（semver 归一化后仍不等）→ 报错
    if (declaredNorm !== undefined && declaredNorm !== expected) {
      errors.push(mismatchError(name, expected, declared, installed));
      continue;
    }

    // 未声明但已安装，且安装版本不一致 → 报错
    if (declaredNorm === undefined && installedNorm !== undefined && installedNorm !== expected) {
      errors.push(mismatchError(name, expected, declared, installed));
      continue;
    }
  }

  if (errors.length > 0) {
    consola.error(errors.join("\n\n"));
    consola.info('如确认要跳过检查，请加参数 --no-check-versions，或设置环境变量 CO_NO_CHECK_VERSIONS=1');
    exit(1);
  }
}
