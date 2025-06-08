function isPlainObject(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeDeep<T extends Record<string, any>, U extends Record<string, any>>(target: T, source: U): T {
  const merged = { ...target };

  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

    const sourceValue = source[key];
    const targetValue = target[key as keyof T];

    if (Object.prototype.hasOwnProperty.call(target, key)) {
      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        merged[key as keyof T & keyof U] = mergeDeep(targetValue, sourceValue) as any;
      }
    } else {
      (merged as any)[key] = sourceValue;
    }
  }

  return merged as T & U;
}
