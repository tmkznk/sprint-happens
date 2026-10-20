type Primitive = string | number | boolean | bigint | symbol | null | undefined;

// Stan domenowy jest niemutowalny; adaptery prezentacji dostają go wyłącznie do odczytu (SH-006).
// Typy proste (także znakowane ID) przechodzą bez zmian.
export type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : { readonly [K in keyof T]: DeepReadonly<T[K]> };
