import { action, reject } from "milkio";

export default action({
    meta: {},
    async handler(
        context,
        params: {
            a: string;
            b: number;
            throw?: boolean;
        },
    ): Promise<{ count: number }> {
        const results = {
            count: 2 + params.b,
            say: "hello world",
        };
        if (params.throw) throw reject("FAIL", "Reject this request");

        return results;
    },
});
// 123456
