export interface RngOptions {
  rng?: () => number;
}

export const createGaussRng = (baseRng: () => number) =>
  function gaussRng(μ: number = 0, σ: number = 1, fnOptions: RngOptions = {}) {
    const { rng = baseRng } = fnOptions;
    const u = 1 - rng();
    const v = rng();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * σ + μ;
  };

export const gaussRng = createGaussRng(Math.random);
