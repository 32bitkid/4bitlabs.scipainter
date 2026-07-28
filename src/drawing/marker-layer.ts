import { DrawMode } from '@4bitlabs/sci0';
import type { generatePic } from '@4bitlabs/sci0-renderer';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { trace } from '@watercolorizer/tracer';
import { uniformFloat64 } from 'pure-rand/distribution/uniformFloat64';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';
import type { RoughCanvas } from 'roughjs/bundled/canvas.js';
import type { Matrix } from 'transformation-matrix';
import { createGaussRng } from '../math/gauss-rng.js';
import type { AsIterable } from '../utils/as-iterable.js';
import { extractDirtyPixels } from './helpers/extract-dirty-pixels.js';
import { applyMatrix, svgPoly } from './helpers/polygons.js';
import { resolveColor, toCSS } from './helpers/resolve-color.js';

export async function markerLayer(
  rng: RandomGenerator,
  ctx: SKRSContext2D,
  rc: RoughCanvas,
  screenSpace: Matrix,
  picData: AsIterable<ReturnType<typeof generatePic>>,
  afterEach: () => Promise<void> | void,
) {
  const uf64Rng = () => uniformFloat64(rng);
  const gf64Rng = createGaussRng(uf64Rng);

  ctx.save();

  ctx.globalCompositeOperation = 'multiply';
  /* marker layer */
  for (const [idx, cmd, layers, meta] of picData) {
    if (cmd[0] !== 'FILL') continue;

    const [, [drawMode, drawCodes]] = cmd;
    if (!DrawMode.isVisualMode(drawMode)) continue;

    const angle = gf64Rng(45, 5);

    const pixels = extractDirtyPixels(layers.tBuffer, idx, { random: uf64Rng });
    const pathData = [...trace(pixels, [320, 190], { polygonify: true })]
      .map((ring) => svgPoly(applyMatrix(screenSpace, ring)))
      .join(' ');

    const fillStyle =
      uf64Rng() < 0.25 ? 'zigzag' : uf64Rng() < 0.5 ? 'hachure' : 'solid';

    rc.path(pathData, {
      fill: toCSS(
        resolveColor(
          drawCodes,
          meta.palettes,
          gf64Rng(0.5, 0.333),
          Math.max(0, gf64Rng(0.2, 0.075)),
        ),
      ),
      stroke: 'none',
      fillStyle,
      fillWeight: gf64Rng(30, 5),
      roughness: 2,
      bowing: gf64Rng(3, 1),
      hachureAngle: angle,
      hachureGap: fillStyle === 'zigzag' ? gf64Rng(55, 5) : gf64Rng(35, 2),
    });

    await afterEach();
  }

  ctx.restore();
}
