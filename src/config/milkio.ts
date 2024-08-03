import { defineConfig } from "milkio";

export const configMilkio = defineConfig(({ config }) => {
	return config({
		debug: false,

		// http server
		ignorePathLevel: 0,
		corsAllowMethods: "*",
		corsAllowHeaders: "*",
		corsAllowOrigin: "*",
	}).done();
});
