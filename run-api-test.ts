import { executeApiTests, envToString } from "milkio";
import { exit } from "node:process";
import { milkio } from "./milkio";

async function apiTest() {
	await executeApiTests(await milkio, envToString(process.env.MILKIO_API_TEST_PATH, ""));
	exit(0);
}

apiTest();
