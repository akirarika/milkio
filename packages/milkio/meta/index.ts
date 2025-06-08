export interface $meta {
  /**
   * type safety
   * @default ["params","results"]
   */
  typeSafety?: boolean;
  /**
   * methods
   * @default ["POST"]
   */
  methods?: Array<"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | string>;
}
