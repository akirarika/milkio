// @ts-ignore
import { camel, hump, hyphen, underline } from "@poech/camel-hump-under";

export type StringToolsOptions = {
	// your options..
};

export const useStringTools = (options: StringToolsOptions = {}) => {
	const stringTools = {
		camel: (str: string) => camel(str.replaceAll(" ", "-")).replaceAll("-", "").replaceAll("_", ""),
		hump: (str: string) => hump(str.replaceAll(" ", "-")).replaceAll("-", "").replaceAll("_", ""),
		hyphen: (str: string) => hyphen(str.replaceAll(" ", "-")).replace(/^(-)/, ""),
		underline: (str: string) => underline(str.replaceAll(" ", "-")).replace(/^(_)/, ""),
	};
	return stringTools;
};
