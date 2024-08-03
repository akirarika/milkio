import { defineCommandHandler } from "milkio";
import { milkio } from "./milkio";

async function command() {
	const commandHandler = defineCommandHandler(await milkio, {
		notFoundHandler(e) {
			console.log("command not found");
		},
	});
	await commandHandler(process.argv);
}

command();
