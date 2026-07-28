import { DrawMode } from '@4bitlabs/sci0';
import type {
  generatePic,
  IntermediatePicState,
} from '@4bitlabs/sci0-renderer';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { uniformFloat64 } from 'pure-rand/distribution/uniformFloat64';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';
import type { RoughCanvas } from 'roughjs/bundled/canvas.js';
import type { Matrix } from 'transformation-matrix';
import {
  createGaussRng,
  type GaussianDistributionRng,
} from '../math/gauss-rng.js';
import { applyMatrixFn } from './helpers/polygons.js';
import { resolveColor, toCSS } from './helpers/resolve-color.js';

const jiggle =
  (gf64Rng: GaussianDistributionRng, [dx, dy]: readonly [number, number]) =>
  ([x, y]: readonly [number, number]): [number, number] => [
    x + gf64Rng(0, dx),
    y + gf64Rng(0, dy),
  ];

export async function inkLayer(
  rng: RandomGenerator,
  ctx: SKRSContext2D,
  rc: RoughCanvas,
  screenSpace: Matrix,
  picData: IntermediatePicState[],
  afterEach: () => Promise<void> | void,
) {
  const uf64Rng = () => uniformFloat64(rng);
  const gf64Rng = createGaussRng(uf64Rng);

  ctx.globalCompositeOperation = 'source-atop';

  /* draw lines and brushes */
  for (const [, cmd, , meta] of picData) {
    switch (cmd[0]) {
      case 'PLINE': {
        const [, [drawMode, drawCodes], ...points] = cmd;
        if (!DrawMode.isVisualMode(drawMode)) break;

        for (let i = 0; i < 4; i++) {
          const strokeColor = resolveColor(
            drawCodes,
            meta.palettes,
            gf64Rng(0.5, 0.25),
            gf64Rng(0.25, 0.125),
          );
          rc.linearPath(
            points.map(applyMatrixFn(screenSpace)).map(jiggle(gf64Rng, [1, 2])),
            {
              stroke: toCSS(strokeColor),
              roughness: gf64Rng(2.5, 1),
              strokeWidth: Math.max(1, gf64Rng(5.5, 2)),
              preserveVertices: true,
              simplification: 0.2,
              bowing: gf64Rng(0.9, 0.333),
            },
          );
          await afterEach();
        }

        break;
      }
      case 'BRUSH': {
        const [, [drawMode, drawCodes, size, isRect, isSpray], ...points] = cmd;
        if (!DrawMode.isVisualMode(drawMode)) break;

        for (const point of points.map(applyMatrixFn(screenSpace))) {
          if (isRect) {
            if (isSpray) {
              for (let i = 0; i < 3; i++) {
                const [x, y] = [
                  point[0] + gf64Rng(0, 2.5),
                  point[1] + gf64Rng(0, 3),
                ];
                const [w, h] = [
                  (2 + size) * 5 + gf64Rng(0, 2.5),
                  (1 + size) * 6 + gf64Rng(0, 3),
                ];
                rc.rectangle(x - w, y - h, w * 2, h * 2, {
                  fill: toCSS(
                    resolveColor(
                      drawCodes,
                      meta.palettes,
                      gf64Rng(0.5, 0.5),
                      0.8,
                    ),
                  ),
                  fillStyle: 'dots',
                  fillWeight: Math.max(2, gf64Rng(5, 1)),
                  hachureGap: gf64Rng(32, 5),
                  roughness: gf64Rng(1.5, 0.5),
                  stroke: 'none',
                });
                await afterEach();
              }
            } else {
              const [x, y] = [
                point[0] + gf64Rng(0, 2.5),
                point[1] + gf64Rng(0, 3),
              ];
              const [w, h] = [
                (2 + size) * 5 + gf64Rng(0, 2.5),
                (1 + size) * 6 + gf64Rng(0, 3),
              ];
              rc.rectangle(x - w, y - h, w * 2, h * 2, {
                fill: toCSS(
                  resolveColor(
                    drawCodes,
                    meta.palettes,
                    gf64Rng(0.5, 0.5),
                    0.8,
                  ),
                ),
                fillStyle: 'solid',
                stroke: 'none',
              });
              await afterEach();
            }
          } else {
            if (isSpray) {
              for (let i = 0; i < 3; i++) {
                rc.ellipse(
                  point[0] + gf64Rng(0, 3),
                  point[1] + gf64Rng(0, 3),
                  (1 + size) * 2 * 5 + gf64Rng(0, 2.5),
                  (1 + size) * 2 * 6 + gf64Rng(0, 3),
                  {
                    fill: toCSS(
                      resolveColor(
                        drawCodes,
                        meta.palettes,
                        gf64Rng(0.5, 0.5),
                        0.8,
                      ),
                    ),
                    fillStyle: 'dots',
                    fillWeight: Math.max(2, gf64Rng(5, 1)),
                    hachureGap: gf64Rng(32, 5),
                    roughness: gf64Rng(1.5, 0.5),
                    stroke: 'none',
                  },
                );
                await afterEach();
              }
            } else {
              rc.ellipse(
                point[0] + gf64Rng(0, 0.5),
                point[1] + gf64Rng(0, 0.5),
                (1 + size) * 1.5 * 5 + gf64Rng(0, 2.5),
                (1 + size) * 1.5 * 6 + gf64Rng(0, 3),
                {
                  fill: toCSS(
                    resolveColor(
                      drawCodes,
                      meta.palettes,
                      gf64Rng(0.5, 0.25),
                      0.8,
                    ),
                  ),
                  fillStyle: 'solid',
                  roughness: gf64Rng(1.5, 0.5),
                  stroke: 'none',
                },
              );
              await afterEach();
            }
          }
        }

        break;
      }
      default:
    }
  }
}
