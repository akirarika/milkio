import { describe, expect, it } from "vitest";

// createWorld 中 isTestMode 的判定规则：world.isTestMode === (config.mode === "test")。
// 这里直接对该判定做单元测试（与 world/index.ts 中保持同一表达式）。
function deriveIsTestMode(config: Record<string, any>): boolean {
    return (config as Record<any, any>)?.mode === "test";
}

describe("isTestMode", () => {
    it("mode 为 test 时为 true", () => {
        expect(deriveIsTestMode({ mode: "test" })).toBe(true);
    });

    it("mode 为 development / production 时为 false", () => {
        expect(deriveIsTestMode({ mode: "development" })).toBe(false);
        expect(deriveIsTestMode({ mode: "production" })).toBe(false);
    });

    it("mode 缺失时为 false", () => {
        expect(deriveIsTestMode({})).toBe(false);
        expect(deriveIsTestMode({ mode: undefined })).toBe(false);
    });
});
