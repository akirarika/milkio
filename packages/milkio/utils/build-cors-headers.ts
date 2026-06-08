import type { CorsConfig } from "../index.ts";

export function buildCorsHeaders(cors: CorsConfig | undefined, origin?: string | null): Record<string, string> {
    const result: Record<string, string> = {};
    if (cors?.corsAllowMethods) result["Access-Control-Allow-Methods"] = cors.corsAllowMethods.join(", ");
    if (cors?.corsAllowHeaders) result["Access-Control-Allow-Headers"] = cors.corsAllowHeaders.join(", ");
    if (cors?.corsMaxAge !== undefined) result["Access-Control-Max-Age"] = String(cors.corsMaxAge);
    if (cors?.corsAllowOrigin && cors.corsAllowOrigin.length > 0) {
        const isWildcard = cors.corsAllowOrigin.includes("*");
        if (cors.corsAllowCredentials) {
            // When credentials: true, the spec forbids Access-Control-Allow-Origin: *.
            // Echo the request origin instead (wildcard means "allow any origin").
            if (origin && (isWildcard || cors.corsAllowOrigin.includes(origin))) {
                result["Access-Control-Allow-Origin"] = origin;
                result["Vary"] = "Origin";
                result["Access-Control-Allow-Credentials"] = "true";
            }
        } else {
            if (isWildcard) {
                result["Access-Control-Allow-Origin"] = "*";
            } else if (origin && cors.corsAllowOrigin.includes(origin)) {
                result["Access-Control-Allow-Origin"] = origin;
                result["Vary"] = "Origin";
            }
        }
    }
    if (cors?.corsExposeHeaders && cors.corsExposeHeaders.length > 0) result["Access-Control-Expose-Headers"] = cors.corsExposeHeaders.join(", ");
    return result;
}