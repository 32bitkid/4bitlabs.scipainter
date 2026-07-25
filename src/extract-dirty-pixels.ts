import { convolution2D, K_GAUSS_BLUR_3x3 } from '@watercolorizer/convolution';

type ExtractDirtyPixelsOptions = {
  random: () => number;
  on?: number;
  off?: number;
  threshold?: number;
};

export function extractDirtyPixels(
  tBuffer: Uint32Array,
  stepIdx: number,
  options: ExtractDirtyPixelsOptions,
) {
  const { on = 0xff, off = 0x00, threshold = 64, random } = options;

  // match
  const pixels = Uint8ClampedArray.from(
    tBuffer.map((val) => (val === stepIdx ? on : off)),
  );

  // blur
  const dest = Uint8ClampedArray.from(pixels);
  convolution2D(K_GAUSS_BLUR_3x3, pixels, [320, 190], dest, {
    dither: { type: 'random', rng: random },
  });

  return dest.map((it) => (it >= threshold ? on : off));
}
