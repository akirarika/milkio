export function typia<TypiaInitT extends TypiaInit>(init: TypiaInitT): Typia<TypiaInitT> {
  return init as unknown as Typia<TypiaInitT>;
}

export type TypiaInit = () => Record<PropertyKey, unknown> | Promise<Record<PropertyKey, unknown>>;

export type Typia<TypiaInitT extends TypiaInit> = TypiaInitT;
