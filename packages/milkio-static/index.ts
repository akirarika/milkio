import type { BunFile } from "bun";
import { defineMiddleware } from "milkio";
import { join } from "node:path";

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

	return defineMiddleware({
		httpNotFound: async (detail): Promise<void> => {
			if (options.headers) for (const header in options.headers) detail.response.headers[header] = options.headers[header];
			if (!detail.response.headers["Cache-Control"]) detail.response.headers["Cache-Control"] = `public, max-age=1800`;

			let file: BunFile = Bun.file(join(options.assets!, detail.fullurl.pathname));
			if (!(await file.exists())) {
				file = Bun.file(join(options.assets!, detail.fullurl.pathname, options.index!));
				if (!(await file.exists())) {
					detail.response.status = 404;
					file = Bun.file(join(options.assets!, options.notFound!));
					if (!(await file.exists())) {
						detail.response.headers["Cache-Control"] = "no-store";
						return; // 404 not found
					}
				}
			}

			detail.response.body = file;
			detail.response.headers["Content-Type"] = file.type;
		},
	})();
};
