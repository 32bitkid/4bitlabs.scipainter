import { IBM5153Contrast } from '@4bitlabs/color';
import { TRUE_CGA_PALETTE } from '@4bitlabs/color/palettes';
import { fromUint32, mix } from '@4bitlabs/color-space/srgb';
import type { DrawCodes } from '@4bitlabs/sci0';

const PALETTE = IBM5153Contrast(TRUE_CGA_PALETTE, 0.7);

export const resolveColor = (
  drawCodes: DrawCodes,
  palettes: [Uint8Array, Uint8Array, Uint8Array, Uint8Array],
  mixMode: 'left' | 'right' | 'both' | number,
  alpha: number = 1.0,
) => {
  const pal = (drawCodes[0] / 40) >>> 0;
  const palette = palettes[pal];
  if (palette === undefined) return 'none';
  const palIndex = (drawCodes[0] % 40) >>> 0;
  const color = palette[palIndex];
  if (color === undefined) return 'none';

  const [leftIdx, rightIdx] = [color & 0b1111, (color >>> 4) & 0b1111];
  const [leftColor, rightColor] = [PALETTE[leftIdx], PALETTE[rightIdx]];
  if (leftColor === undefined || rightColor === undefined) return 'none';

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

  return `rgb(${rgb[1].toString(10)} ${rgb[2].toString(10)} ${rgb[3].toString(10)} / ${alpha})`;
};
