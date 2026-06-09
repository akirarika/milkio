// @ts-nocheck  standalone script, runs via `tsx` outside monorepo TS context
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module, Controller, Post, Req } from "@nestjs/common";
import type { Request } from "express";

const PORT = 19003;

@Controller("benchmark")
class BenchmarkController {
	@Post("json")
	json(@Req() req: Request) {
		const { a, b } = req.body;
		return { result: a + b };
	}
}

@Module({
	controllers: [BenchmarkController],
})
class AppModule {}

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { logger: false });
	await app.listen(PORT);
	console.log(`[nest] listening on :${PORT}`);
}

void bootstrap();
