export interface MilkioMeta {
    /**
     * type safety
     * @default ["params"]
     */
    // typeSafety?: boolean | Array<"params" | "results">;
    typeSafety?: boolean | Array<"params">;
    /**
     * methods
     * @default ["POST"]
     */
    methods?: Array<"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | string>;
}
