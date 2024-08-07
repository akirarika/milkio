import ejs from "ejs";
import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { cwd, exit } from "node:process";
import { unlink, writeFile, readFile, exists } from "node:fs/promises";
import { camel, hyphen } from "@poech/camel-hump-under";
import { $, Glob } from "bun";
import type { MilkioConfig } from "..";

export default async () => {
	// Delete the files generated in the past and regenerate them
	try {
		await unlink(join(cwd(), "generated", "api-schema.ts"));
	} catch (error) {} // Maybe the file does not exist

	// Make sure that the existing directories are all present
	(await exists(join("generated"))) || mkdirSync(join("generated"));
	(await exists(join("generated", "raw"))) || mkdirSync(join("generated", "raw"));
	(await exists(join("generated", "raw", "apps"))) || mkdirSync(join("generated", "raw", "apps"));

	if (!(await exists(join(cwd(), "milkio.toml")))) return;
	const milkioConfig = (await import(join(cwd(), "milkio.toml"))).default as MilkioConfig;

	for (const key in milkioConfig.exists) {
		const file = milkioConfig.exists[key];
		if (!(await exists(join(cwd(), file.path)))) await writeFile(join(cwd(), file.path), file.content ?? "");
	}

	if (!(await exists(join("generated", "README.md")))) {
		await writeFile(join("generated", "README.md"), "⚠️ All files in this directory are generated by milkio. Please do not modify the content, otherwise your modifications will be overwritten in the next generation.");
	}

	const utils = {
		camel: (str: string) => camel(str).replaceAll("-", "").replaceAll("_", ""),
		hyphen: (str: string) => hyphen(str).replaceAll("_", ""),
	};

	// Write a basic framework to ensure that there are no errors when reading later
	const apiSchemaSkeleton = `
  export default {
    apiValidator: {},
    apiMethodsSchema: {},
    apiMethodsTypeSchema: {},
  }
  `;
	await writeFile(join(cwd(), "generated", "api-schema.ts"), ejs.render(apiSchemaSkeleton, { utils }));

	// Generate api-schema.ts file through templates
	const templateVars = {
		utils,
		apiPaths: [] as Array<string>,
		apiTestPaths: [] as Array<string>,
	};

	const glob = new Glob("**/*.ts");
	const appFiles = await Array.fromAsync(glob.scan({ cwd: join(cwd(), "src", "apps") }));

	console.time(`File Stage`);

	const results: Array<Promise<void>> = [];
	for (const pathRaw of appFiles) {
		if (!pathRaw.endsWith(".ts")) continue;
		results.push(
			(async () => {
				const path = pathRaw.replaceAll("\\", "/");
				// const module = await import(/* @vite-ignore */ join(cwd(), "src", "apps", path));
				const moduleCode = await readFile(join(cwd(), "src", "apps", pathRaw), "utf-8");

				if (/\nexport const api( )*\=( )*defineApi\(\{/.test(moduleCode)) {
					// Exclude disallowed characters
					if (path.includes("_")) {
						console.error(`\n\nPath: "${path.slice(0, -3)}"`);
						console.error(`Do not use "_" in the path. If you want to add a separator between words, please use "-".\n`);
						exit(1);
					}
					if (!/^[a-z0-9/$/-]+$/.test(path.slice(0, -3))) {
						console.error(`\n\nPath: "${path.slice(0, -3)}"`);
						console.error(`The path can only contain lowercase letters, numbers, and "-".\n`);
						exit(1);
					}

					templateVars.apiPaths.push(path);

					if (/\nexport const test( )*=( )*defineApiTest\(api\,/.test(moduleCode)) {
						templateVars.apiTestPaths.push(path);
					}

					// typia
					const filePath = join(cwd(), "generated", "raw", "apps", path);
					const dirPath = join(cwd(), "generated", "raw", "apps", path).split("/").slice(0, -1).join("/");
					if (!(await exists(dirPath))) {
						mkdirSync(dirPath, { recursive: true });
					}
					let importPath = "../../../";

					for (let i = 0; i < path.split("/").length - 1; i++) {
						importPath = `${importPath}../`;
					}
					importPath = `${importPath}src/apps`;
					const template = `
import typia from "typia";
import { _validate, type ExecuteResultFail, type ExecuteResultSuccess } from "milkio";
import { type TSONEncode } from "@southern-aurora/tson";
import type * as <%= utils.camel(path.slice(0, -3).replaceAll('/', '$')) %> from '${importPath}/<%= path.slice(0, -3) %>';

type ParamsT = Parameters<typeof <%= utils.camel(path.replaceAll('/', '$').slice(0, -${3})) %>['api']['action']>[0];
export const validateParams = async (params: any) => typia.misc.validatePrune<ParamsT>(params);
type ResultsT = Awaited<ReturnType<typeof <%= utils.camel(path.replaceAll('/', '$').slice(0, -${3})) %>['api']['action']>>;
export const randParams = async () => typia.random<ParamsT>();
`.trim();
					// export const paramsSchema = typia.json.application<[{ data: ParamsT }], "swagger">();

					if (!(await exists(dirname(filePath)))) mkdirSync(dirname(filePath), { recursive: true });
					await writeFile(filePath, ejs.render(template, { ...templateVars, path }));
				}
			})(),
		);
	}
	await Promise.all(results);

	await writeFile(
		join(cwd(), "generated", "api-schema.ts"),
		ejs.render(
			`
/**
 * ⚠️ This file is generated and modifications will be overwritten
 */

// api
<% for (const path of ${"apiPaths"}) { %>import type * as <%= utils.camel(path.slice(0, -3).replaceAll('/', '$')) %> from '${"../src/apps"}/<%= path.slice(0, -3) %>'
<% } %>
import _apiValidator from './products/api-validator.ts'

export default {
  apiValidator: _apiValidator,
  ${"apiMethodsSchema"}: {
    <% for (const path of apiPaths) { %>'<%= utils.hyphen(path.slice(0, -${3})) %>': () => ({ module: import('../src/apps/<%= path.slice(0, -${3}) %>') }),
    <% } %>
  },
  ${"apiMethodsTypeSchema"}: {
    <% for (const path of apiPaths) { %>'<%= utils.hyphen(path.slice(0, -${3})) %>': undefined as unknown as typeof <%= utils.camel(path.slice(0, -${3}).replaceAll('/', '$')) %>,
    <% } %>
  },
  ${"apiTestsSchema"}: {
    <% for (const path of apiTestPaths) { %>'<%= utils.hyphen(path.slice(0, -${3})) %>': () => ({ module: import('../src/apps/<%= path.slice(0, -${3}) %>') }),
    <% } %>
  },
}
 `.trim(),
			templateVars,
		),
	);

	// api
	const apiValidatorTemplate = `/**
 * ⚠️This file is generated and modifications will be overwritten
 */

export default {
  generatedAt: ${new Date().getTime()},
  ${"validate"}: {
    <% for (const path of apiPaths) { %>'<%= utils.hyphen(path.slice(0, -${3})) %>': () => import('./apps/<%= utils.hyphen(path) %>'),
    <% } %>
  },
}
`.trim();
	await writeFile(join(cwd(), "generated", "raw", "api-validator.ts"), ejs.render(apiValidatorTemplate, templateVars));

	console.timeEnd(`File Stage`);
	console.log(``);

	// typia
	console.time(`Typia Stage`);
	await $`bun run ./node_modules/typia/lib/executable/typia.js generate --input generated/raw --output generated/products --project tsconfig.json`;
	console.timeEnd(`Typia Stage`);
	console.log(``);

	if (!milkioConfig?.generate?.significant) return;
	let i = 0;
	for (const command of milkioConfig.generate.significant) {
		++i;
		console.time(`Significant Stage (LINE ${i})`);
		await $`${{ raw: command }}`;
		console.timeEnd(`Significant Stage (LINE ${i})`);
	}
};
