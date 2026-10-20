// Stan domenowy jest niemutowalny; adaptery prezentacji dostają go wyłącznie do odczytu (SH-006).
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
