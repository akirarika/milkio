import { expect, test } from "vite-plus/test";
import { astra, stargate } from "../../../test.ts";

// stargate 直接返回可抛出的 failure 对象：fail 保真，fault 只保留 kind + 通用码。

test("stargate returns a fail failure object with code/data intact", async () => {
    const [failure] = await stargate.execute("/passthrough/downstream-fail", { params: {} });

    expect(failure).toMatchObject({
        $milkioFailure: true,
        kind: "fail",
        code: "REQUEST_FAIL",
        data: "downstream fail",
    });
});

test("stargate returns a generic fault failure object, without internal fault info", async () => {
    const [failure] = await stargate.execute("/passthrough/downstream-fault", { params: {} });

    expect(failure).toMatchObject({
        $milkioFailure: true,
        kind: "fault",
        code: "INTERNAL_SERVER_ERROR",
    });
    // 内部 fault-code/data 不允许出现在客户端拿到的 failure 中
    expect(JSON.stringify(failure)).not.toContain("PASSTHROUGH_FAULT");
    expect(JSON.stringify(failure)).not.toContain("downstream fault");
});

test("middle service can rethrow a downstream fail and keep code/data", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [failure] = await world.execute("/passthrough/upstream-fail", {
        params: {},
        generateParams: false,
    });

    expect(failure?.kind).toBe("fail");
    if (failure?.kind === "fail" && failure.code === "REQUEST_FAIL") {
        expect(failure.data).toBe("downstream fail");
    } else {
        throw fail("expected a fail passthrough", failure);
    }
});

test("middle service can rethrow a downstream fault and keep the fault kind", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [failure] = await world.execute("/passthrough/upstream-fault", {
        params: {},
        generateParams: false,
    });

    // 如果中间层错误地把它包装成 fail，客户端会收到 kind:"fail"；这里必须仍是 fault。
    expect(failure).toMatchObject({ kind: "fault", code: "INTERNAL_SERVER_ERROR" });
    expect(JSON.stringify(failure)).not.toContain("PASSTHROUGH_FAULT");
});
