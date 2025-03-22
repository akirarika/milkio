export function headersToJSON(headers: Headers) {
  const json: Record<string, string> = {};
  for (const [key, value] of (headers as any).entries()) {
    json[key] = value;
  }
  return json;
}
