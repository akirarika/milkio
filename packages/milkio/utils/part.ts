export function part<T extends () => unknown>(handler: T): ReturnType<T> {
  return handler() as unknown as ReturnType<T>;
}
