import { join } from "node:path";
import { defineMiddleware } from "milkio";
import { fileTypeFromBuffer } from 'file-type';
import { readFile, exists } from "node:fs/promises";

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

			let file = await readFile(join(options.assets!, detail.fullurl.pathname));
			if (!(await exists(join(options.assets!, detail.fullurl.pathname)))) {
				file = await readFile(join(options.assets!, detail.fullurl.pathname, options.index!));
				if (!(await exists(join(options.assets!, detail.fullurl.pathname, options.index!)))) {
					detail.response.status = 404;
					file = await readFile(join(options.assets!, options.notFound!));
					if (!(await exists(join(options.assets!, options.notFound!)))) {
						detail.response.headers["Cache-Control"] = "no-store";
						return; // 404 not found
					}
				}
			}

			detail.response.body = file;
			detail.response.headers["Content-Type"] = (await fileTypeFromBuffer(file))?.mime ?? "application/octet-stream";
		},
	})();
};
