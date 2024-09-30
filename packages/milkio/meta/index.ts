export interface $meta {
  /**
   * type safety
   * @default ["params","results"]
   */
  typeSafety?: Array<"params" | "results">;
  /**
   * methods
   * @default ["POST"]
   */
  methods?: Array<"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | string>;
}
