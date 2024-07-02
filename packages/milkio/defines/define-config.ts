export function defineConfig<T>(handler: (options: { config: typeof configFn }) => T): T {
	const result = handler({ config: configFn });
	if (!result) throw new Error("defineConfig must return a value, Did you forget to add a return statement?");
	if (typeof result !== "object" || Array.isArray(result)) throw new Error("defineConfig must return an object.");
	if ("environment" in result && "done" in result && typeof result["environment"] === "function" && typeof result["done"] === "function") throw new Error("Did you accidentally return the config method without adding \`.done()\`?");
	return result;
}

function configFn<ConfigT extends Config>(config: ConfigT): ConfigMore<ConfigT> {
	let skipMore = false;

	const configMore: ConfigMore<ConfigT> = {
		environment: (when, configMixin) => {
			if (skipMore || !when()) return configMore;
			skipMore = true;
			for (const key in configMixin) (config as any)[key] = configMixin[key];
			return configMore;
		},
		done: () => {
			return config;
		},
	} satisfies ConfigMore<ConfigT>;

	return configMore;
}

export type Config = Record<string, unknown>;

export type ConfigMore<ConfigT extends Config> = {
	environment: (when: () => boolean, config: Partial<ConfigT>) => ConfigMore<ConfigT>;
	done: () => ConfigT;
};