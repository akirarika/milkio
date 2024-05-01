/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
// @ts-ignore
import Enquirer from "enquirer";

export const useInteractiveCli = () => {
	const interactiveCli = {
		async input(message: string, initial?: string): Promise<string> {
			try {
				const result: any = await Enquirer.prompt([
					{
						type: "input",
						name: "data",
						initial,
						message,
					},
				]);
				return result.data;
			} catch (error) {
				process.exit(0);
			}
		},
		async confirm(message: string): Promise<boolean> {
			try {
				const result: any = await Enquirer.prompt([
					{
						type: "input",
						name: "data",
						message,
					},
				]);
				return result.data;
			} catch (error) {
				process.exit(0);
			}
		},
		async select(message: string, choices: Array<string>): Promise<string> {
			try {
				const result: any = await Enquirer.prompt([
					{
						type: "select",
						name: "data",
						message,
						choices,
					},
				]);
				return result.data;
			} catch (error) {
				process.exit(0);
			}
		},
		async autocomplete(message: string, choices: Array<string>): Promise<string> {
			try {
				const result: any = await Enquirer.prompt([
					{
						type: "autocomplete",
						name: "data",
						message,
						choices,
					},
				]);
				return result.data;
			} catch (error) {
				process.exit(0);
			}
		},
	};
	return interactiveCli;
};
