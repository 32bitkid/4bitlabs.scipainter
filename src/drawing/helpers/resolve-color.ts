import { IBM5153Contrast } from '@4bitlabs/color';
import { TRUE_CGA_PALETTE } from '@4bitlabs/color/palettes';
import { fromUint32, mix, type sRGBTuple } from '@4bitlabs/color-space/srgb';
import type { DrawCodes } from '@4bitlabs/sci0';

const PALETTE = IBM5153Contrast(TRUE_CGA_PALETTE, 0.7);

export const setAlpha = (
  [id, r, g, b]: sRGBTuple,
  alpha: number,
): sRGBTuple => [id, r, g, b, alpha];

export const toCSS = ([, r, g, b, a = 1]: sRGBTuple) =>
  `rgba(${[r, g, b].map((it) => it.toFixed(0)).join(' ')} / ${(a * 100).toFixed(1)}%)`;

export const resolveColor = (
  drawCodes: DrawCodes,
  palettes: [Uint8Array, Uint8Array, Uint8Array, Uint8Array],
  mixMode: 'left' | 'right' | 'both' | number,
  alpha: number = 1.0,
): sRGBTuple => {
  const pal = (drawCodes[0] / 40) >>> 0;
  const palette = palettes[pal];
  if (palette === undefined) throw new Error(`pal(${pal}) is out of range`);
  const palIndex = (drawCodes[0] % 40) >>> 0;
  const color = palette[palIndex];
  if (color === undefined)
    throw new Error(`palIndex(${palette}) is out of range`);

  const [leftIdx, rightIdx] = [color & 0b1111, (color >>> 4) & 0b1111];
  const [leftColor, rightColor] = [PALETTE[leftIdx], PALETTE[rightIdx]];
  if (leftColor === undefined)
    throw new Error(`leftIdx(${leftIdx}) is out of range`);
  if (rightColor === undefined)
    throw new Error(`rightIdx(${rightIdx}) is out of range`);

  const rgb =
    mixMode === 'left'
      ? fromUint32(leftColor)
      : mixMode === 'right'
        ? fromUint32(rightColor)
        : mix(
            fromUint32(leftColor),
            fromUint32(rightColor),
            typeof mixMode === 'number' ? mixMode : 0.5,
          );

  return setAlpha(rgb, alpha);
};
