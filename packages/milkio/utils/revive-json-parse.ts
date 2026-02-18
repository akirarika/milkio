const isoDatePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?$/;

export function reviveJSONParse<T>(json: T): T {
  if (json !== null && typeof json === 'object') {
    if (json instanceof Date || (typeof (json as any).getTime === 'function' && typeof (json as any).toISOString === 'function')) {
      return json;
    }
    if (Array.isArray(json)) {
      return json.map((item) => reviveJSONParse(item)) as any;
    }
    return Object.entries(json).reduce((acc, [key, value]) => {
      acc[key as keyof T] = reviveJSONParse(value);
      return acc;
    }, {} as T);
  }
  if (typeof json === 'string') {
    const match = json.match(isoDatePattern);
    if (match) {
      const normalizedDateString = match[2] ? `${match[1]}${match[2].replace(':', '')}` : `${match[1]}Z`;
      return new Date(normalizedDateString) as any;
    }
  }
  return json;
}