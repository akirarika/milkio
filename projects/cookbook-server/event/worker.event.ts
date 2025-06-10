export interface _ {
  "cookbook:worker:state": { key: string; state: "running" | "stopped"; code: number | null };
  "cookbook:worker:log": { type: "stdout" | "stderr"; key: string; chunk: string };
}
