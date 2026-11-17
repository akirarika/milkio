import { expect, test } from "vite-plus/test";
import { astra, stargate } from "../../../test.ts";

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

type MirrorWorld = Awaited<ReturnType<typeof astra.createMirrorWorld>>[2];

/**
 * 编译期回归：测试侧（world.execute / world.emit）的失败返回值类型必须与
 * 客户端侧（stargate.execute）完全一致——包括客户端自己合成的传输层故障
 * （NETWORK_ERROR / REQUEST_TIMEOUT），这样测试里的失败收窄写法与线上完全同构。
 * 该函数不会被调用，只用于触发类型检查。
 */
function assertTestSideFailureTypesMatchClientSide(world: MirrorWorld): void {
    // action
    const clientAction = stargate.execute<"/passthrough/downstream-fail">;
    const testAction = world.execute<"/passthrough/downstream-fail">;
    type ClientActionResult = Awaited<ReturnType<typeof clientAction>>;
    type TestActionResult = Awaited<ReturnType<typeof testAction>>;
    type _ActionTuple = Assert<Equal<TestActionResult, ClientActionResult>>;

    // stream（包含流迭代器内的失败帧类型）
    const clientStream = stargate.execute<"/stream/flow-fail~">;
    const testStream = world.execute<"/stream/flow-fail~">;
    type ClientStreamResult = Awaited<ReturnType<typeof clientStream>>;
    type TestStreamResult = Awaited<ReturnType<typeof testStream>>;
    type _StreamTuple = Assert<Equal<TestStreamResult, ClientStreamResult>>;

    // emit
    const testEmit = world.emit<"event:notify">;
    type TestEmitResult = Awaited<ReturnType<typeof testEmit>>;
    type _EmitFailure = Assert<Equal<TestEmitResult[0], ClientActionResult[0]>>;
}
void assertTestSideFailureTypesMatchClientSide;

test("测试侧失败对象与客户端侧一致（fail 保真、fault 只保留通用码）", async () => {
    const [, , world] = await astra.createMirrorWorld(import.meta.url);

    const [clientFail] = await stargate.execute("/passthrough/downstream-fail", { params: {} });
    const [testFail] = await world.execute("/passthrough/downstream-fail", { params: {}, generateParams: false });
    expect(clientFail).toMatchObject({ $milkioFailure: true, kind: "fail", code: "REQUEST_FAIL", data: "downstream fail" });
    expect(testFail).toEqual(clientFail);
    if (testFail?.kind === "fail" && testFail.code === "REQUEST_FAIL") {
        // 与 stargate 一样：按 kind + code 收窄后 data 有精确类型
        const data: string = testFail.data;
        expect(data).toBe("downstream fail");
    }

    const [clientFault] = await stargate.execute("/passthrough/downstream-fault", { params: {} });
    const [testFault] = await world.execute("/passthrough/downstream-fault", { params: {}, generateParams: false });
    expect(clientFault).toMatchObject({ $milkioFailure: true, kind: "fault", code: "INTERNAL_SERVER_ERROR" });
    expect(testFault).toEqual(clientFault);
});
