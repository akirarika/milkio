export function sanitizeExecuteId(executeId: string | undefined): string {
  const value = typeof executeId === "string" ? executeId : "";
  return value.replace(/[^A-Za-z0-9_-]/g, "");
}
