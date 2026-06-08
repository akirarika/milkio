import type { CorsConfig } from "../index.ts";

export function buildCorsHeaders(cors: CorsConfig | undefined): Record<string, string> {
    const result: Record<string, string> = {};
    if (cors?.corsAllowMethods) result["Access-Control-Allow-Methods"] = cors.corsAllowMethods.join(", ");
    if (cors?.corsAllowHeaders) result["Access-Control-Allow-Headers"] = cors.corsAllowHeaders.join(", ");
    if (cors?.corsMaxAge !== undefined) result["Access-Control-Max-Age"] = String(cors.corsMaxAge);
    if (cors?.corsAllowOrigin) result["Access-Control-Allow-Origin"] = cors.corsAllowOrigin.join(", ");
    if (cors?.corsExposeHeaders && cors.corsExposeHeaders.length > 0) result["Access-Control-Expose-Headers"] = cors.corsExposeHeaders.join(", ");
    if (cors?.corsAllowCredentials) result["Access-Control-Allow-Credentials"] = "true";
    return result;
}