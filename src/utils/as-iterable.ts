export type AsIterable<T> = T extends Generator<infer Y> ? Iterable<Y> : never;
