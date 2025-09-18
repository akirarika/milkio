import { stream } from "milkio";

export default stream({
    async *handler(context, params: { a: string; b: number; sleep: number }): AsyncGenerator<number> {
        let count = Number(params.a);
        for (let index = 0; index < params.b; index++) {
            if (params.sleep) await new Promise((resolve) => setTimeout(resolve, params.sleep));
            count = count * Number(params.a);
            context.logger.info("count", count);
            yield count;
        }
    },
});
