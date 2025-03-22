export type TypeSafety<Value extends Record<any, any>> = (value: Value) => TypeSafetyValue;

export interface TypeSafetyValue {
  type: <Type extends Record<any, any>>() => Type;
}

export interface TypeSafetyType<Type extends Record<any, any>> {
  $milkioType: "type-safety";
  value: Type;
}

export function typeSafety<Value extends Record<any, any>>(value: Value): TypeSafetyValue {
  return {
    type: () => ({ $milkioType: "type-safety", value }),
  } as any;
}
