import { join } from "node:path";
import { defineMiddleware } from "milkio";
import { readFile } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import mime from "mime";

export type MilkioStaticOptions = {
	assets?: string;
	index?: string;
	notFound?: string;
	headers?: Record<string, string>;
};

export const milkioStatic = (options: MilkioStaticOptions = {}) => {
	if (!options.assets) options.assets = "public";
	if (!options.index) options.index = "index.html";
	if (!options.notFound) options.notFound = "404.html";

	// Node.js
	return defineMiddleware({
		httpNotFound: async (detail): Promise<void> => {
			if (options.headers) for (const header in options.headers) detail.response.headers[header] = options.headers[header];
			if (!detail.response.headers["Cache-Control"]) detail.response.headers["Cache-Control"] = `public, max-age=1800`;

			let file: Buffer;
			let path: string;
			if (existsSync(join(options.assets!, detail.fullurl.pathname)) && lstatSync(join(options.assets!, detail.fullurl.pathname)).isFile()) {
				path = join(options.assets!, detail.fullurl.pathname);
				file = await readFile(path);
			} else if (existsSync(join(options.assets!, detail.fullurl.pathname, options.index!))) {
				path = join(options.assets!, detail.fullurl.pathname, options.index!);
				file = await readFile(path);
			} else if (existsSync(join(options.assets!, options.notFound!))) {
				path = join(options.assets!, options.notFound!);
				file = await readFile(path);
			} else {
				detail.response.status = 404;
				detail.response.headers["Cache-Control"] = "no-store";
				return; // 404 not found
			}

			detail.response.body = file;
			detail.response.headers["Content-Type"] = mime.getType(path.split(".").at(-1) ?? "") ?? "application/octet-stream";
		},
	})();
};
