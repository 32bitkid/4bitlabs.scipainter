import {
  fromHex,
  mix as mixRGB,
  type sRGBTuple,
} from '@4bitlabs/color-space/srgb';
import type { Vec2 } from '@4bitlabs/vec2';
import type { CanvasGradient, SKRSContext2D } from '@napi-rs/canvas';
import { gaussRng$ } from '../../math/gauss-rng.js';
import { ensureExists } from '../../utils/ensure-exists.js';
import { setAlpha, toCSS } from './resolve-color.js';

type Bounds = [number, number, number, number];

const boundsOf = (points: Vec2[]): Bounds =>
  points.reduce(
    (bounds, [x, y]) => {
      bounds[0] = Math.min(x, bounds[0]);
      bounds[1] = Math.min(y, bounds[1]);
      bounds[2] = Math.max(x, bounds[2]);
      bounds[3] = Math.max(y, bounds[3]);
      return bounds;
    },
    [Infinity, Infinity, -Infinity, -Infinity],
  );

const centerOf = ([x0, y0, x1, y1]: Bounds): Vec2 => [
  (x1 + x0) / 2,
  (y1 + y0) / 2,
];
const dimensionsOf = ([x0, y0, x1, y1]: Bounds): Vec2 => [x1 - x0, y1 - y0];

export const colors = [
  fromHex(`#000000`),
  fromHex(`#1D2B53`),
  fromHex(`#7E2553`),
  fromHex(`#008751`),
  fromHex(`#AB5236`),
  fromHex(`#5F574F`),
  fromHex(`#FF004D`),
  fromHex(`#FFA300`),
  fromHex(`#FFEC27`),
  fromHex(`#00E436`),
  fromHex(`#29ADFF`),
  fromHex(`#83769C`),
  fromHex(`#FF77A8`),
];

export const generateFillStyle = (
  ctx: SKRSContext2D,
  points: Vec2[],
  base: sRGBTuple,
  randomDouble: () => number,
  randomInt: (min: number, max: number) => number,
): CanvasGradient | string => {
  const bounds = boundsOf(points);
  const [w, h] = dimensionsOf(bounds);
  const [cx, cy] = centerOf(bounds);

  const [cx0, cy0] = [cx + gaussRng$(0, w / 4), cy + gaussRng$(0, h / 15)];
  const [cx1, cy1] = [cx0 + gaussRng$(0, 10), cy0 + gaussRng$(0, 10)];

  const g = ctx.createRadialGradient(cx0, cy0, w / 10, cx1, cy1, w);

  const alt = colors[randomInt(0, colors.length - 1)];
  ensureExists(alt, 'index out of range');

  const isBlack = base[1] === 0 && base[2] === 0 && base[3] === 0;

  const clr0 = setAlpha(
    mixRGB(base, alt, randomDouble() * 0.5),
    isBlack ? 0.22 : Math.max(0, gaussRng$(0.01, 0.001)),
  );
  const clr1 = setAlpha(mixRGB(base, alt, randomDouble() * 0.15), 0.09);
  const clr2 = setAlpha(
    mixRGB(base, alt, randomDouble() * 0.075),
    isBlack ? 0.29 : 0.25,
  );

  const dir = randomDouble() < 0.25;
  g.addColorStop(dir ? 0.0 : 1.0, toCSS(clr2));
  g.addColorStop(dir ? 1.0 : 0.0, toCSS(clr0));

  return randomDouble() < 0.25 ? g : toCSS(clr1);
};
