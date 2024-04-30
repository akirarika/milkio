import { env, type SpawnOptions } from "bun";

/**
 * This is a legacy wrapper that was written before $ Shell was created.
 * All relevant code should be replaced with $ Shell in the future.
 */

export const exec = async (cwd: string, command: Array<string>, options: Partial<SpawnOptions.OptionsObject> = {}) => {
	return new Promise((resolve, reject) => {
		if (!("cwd" in options)) options.cwd = cwd;
		if (!("stdin" in options)) options.stdin = "inherit";
		if (!("stdout" in options)) options.stdout = "inherit";
		if (!("env" in options)) options.env = { ...env };

		options.onExit = (proc, exitCode, signalCode, error) => {
			// eslint-disable-next-line prefer-promise-reject-errors
			if (exitCode !== 0) reject({ proc, exitCode, signalCode, error });
			else resolve({ proc, exitCode, signalCode, error });
		};

		try {
			Bun.spawn(command, options);
		} catch (error) {
			reject(error);
		}
	});
};
