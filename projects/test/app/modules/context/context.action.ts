// oxlint-disable-next-line no-unused-vars

import type { MilkioContext } from "../../../.milkio/declares.ts";

type Params = {};

type Result = { success: string; routeType: string };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    if (!context.executeId) throw context.fail("REQUEST_FAIL", "Context is not 'executeId'");
    if (!context.http) throw context.fail("REQUEST_FAIL", "Context is not 'http'");
    if (!context.logger) throw context.fail("REQUEST_FAIL", "Context is not 'logger'");
    if (!context.path) throw context.fail("REQUEST_FAIL", "Context is not 'path'");
    if (!context.routeType) throw context.fail("REQUEST_FAIL", "Context is not 'routeType'");
    return {
        success: "success",
        routeType: context.routeType,
    };
}