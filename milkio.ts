import { createMilkioApp } from "milkio";
import { milkioStatic } from "milkio-static";

export const milkio = createMilkioApp({
	bootstraps: () => [],
	middlewares: () => [milkioStatic()],
});
