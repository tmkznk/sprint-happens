// Stabilne identyfikatory encji: czysty tekst, serializowalny i deterministyczny (bez losowości i czasu).
declare const entityKind: unique symbol;

export type EntityId<Kind extends string> = string & { readonly [entityKind]: Kind };

export type IdSequence = Readonly<Record<string, number>>;

export function allocateId<Kind extends string>(
  sequence: IdSequence,
  kind: Kind,
): { id: EntityId<Kind>; sequence: IdSequence } {
  const next = (sequence[kind] ?? 0) + 1;
  return { id: `${kind}-${next}` as EntityId<Kind>, sequence: { ...sequence, [kind]: next } };
}
