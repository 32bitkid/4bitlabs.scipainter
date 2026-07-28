import { DrawMode } from '@4bitlabs/sci0';
import type {
  generatePic,
  IntermediatePicState,
} from '@4bitlabs/sci0-renderer';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { convolution1D, K_GAUSS_BLUR_5 } from '@watercolorizer/convolution';
import { trace } from '@watercolorizer/tracer';
import { watercolorize } from '@watercolorizer/watercolorizer';
import { uniformFloat64 } from 'pure-rand/distribution/uniformFloat64';
import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';
import type { Matrix } from 'transformation-matrix';

import { createGaussRng } from '../math/gauss-rng.js';
import { ensureExists } from '../utils/ensure-exists.js';
import { shuffled } from '../utils/shuffled.js';
import { extractDirtyPixels } from './helpers/extract-dirty-pixels.js';
import { applyMatrix, pathPoly } from './helpers/polygons.js';
import { resolveColor, setAlpha, toCSS } from './helpers/resolve-color.js';
import { generateFillStyle } from './helpers/watercolor-gradient.js';

export async function watercolorLayer(
  rng: RandomGenerator,
  ctx: SKRSContext2D,
  screenSpace: Matrix,
  picData: IntermediatePicState[],
  afterEach: () => Promise<void> | void,
) {
  const uf64Rng = () => uniformFloat64(rng);
  const gf64Rng = createGaussRng(uf64Rng);

  ctx.globalCompositeOperation = 'overlay';

  /* collect fills */
  const fills: (() => void)[] = [];
  for (const [idx, cmd, layers, meta] of picData) {
    if (cmd[0] !== 'FILL') continue;

    const [, [drawMode, drawCodes]] = cmd;
    if (!DrawMode.isVisualMode(drawMode)) continue;

    const result = extractDirtyPixels(layers.tBuffer, idx, { random: uf64Rng });
    const rings = trace(result, [320, 190]);

    if (rings.length === 0) continue;

    const allPolys = rings.map((ring) => [
      ...watercolorize(applyMatrix(screenSpace, ring), {
        random: uf64Rng,
        preEvolutions: 2,
        evolutions: 10,
        layersPerEvolution: 2,
        layerEvolutions: 2,
        blurWeightsOnDistort: true,
        simplifyEachEvolution: 5,
        windingOrder: 'ccw',
        vertexWeights: convolution1D(
          K_GAUSS_BLUR_5,
          ring.map(() => Math.max(0, gf64Rng(0.125, 0.05))),
          Array.from<number>({ length: ring.length }),
        ),
      }),
    ]);

    while (allPolys.some((it) => it.length)) {
      const rings = allPolys.map((it) => it.shift());
      fills.push(() => {
        ensureExists(rings[0], 'index out of range');

        ctx.save();
        ctx.beginPath();

        for (const poly of rings) {
          if (poly === undefined) continue;
          pathPoly(ctx, poly);
        }

        const color = resolveColor(drawCodes, meta.palettes, gf64Rng(0.5, 0.1));

        ctx.fillStyle = // toCSS(setAlpha(color, gf64Rng(0.08, 0.05)));
          generateFillStyle(ctx, rings[0], color, uf64Rng, (min, max) =>
            uniformInt(rng, min, max),
          );

        ctx.globalCompositeOperation =
          uf64Rng() < 0.5 ? 'source-over' : 'multiply';
        ctx.fill();

        if (uf64Rng() < 0.3333) {
          ctx.lineWidth = gf64Rng(2, 1);
          ctx.strokeStyle = toCSS(setAlpha(color, gf64Rng(0.1, 0.05)));
          ctx.stroke();
        }
        ctx.restore();
      });
    }
  }

  // shuffle and draw watercolor layers
  for (const fillFn of shuffled(fills, rng)) {
    fillFn();
    await afterEach();
  }
}
