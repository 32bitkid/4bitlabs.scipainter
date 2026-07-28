import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';

export function* shuffled<T>(source: T[], rng: RandomGenerator): Generator<T> {
  const shuffled = Array.from(source);
  while (shuffled.length) {
    const idx = uniformInt(rng, 0, shuffled.length);
    const [item] = shuffled.splice(idx, 1);
    if (item !== undefined) yield item;
  }
}
