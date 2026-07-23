#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { IBM5153Contrast } from '@4bitlabs/color';
import { TRUE_CGA_PALETTE } from '@4bitlabs/color/palettes';
import { fromUint32, mix } from '@4bitlabs/color-space/srgb';
import {
  type DrawCodes,
  DrawMode,
  decompress,
  parseAllMappings,
  parseHeaderWithPayload,
  parsePic,
  ResourceMatchers,
  ResourceTypes,
} from '@4bitlabs/sci0';
import { generatePic } from '@4bitlabs/sci0-renderer';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  convolution1D,
  convolution2D,
  K_GAUSS_BLUR_3x3,
  K_GAUSS_BLUR_5,
} from '@watercolorizer/convolution';
import { trace } from '@watercolorizer/tracer';
import { watercolorize } from '@watercolorizer/watercolorizer';
import { uniformFloat64 } from 'pure-rand/distribution/uniformFloat64';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import Rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bundled/canvas.js';
import M from 'transformation-matrix';
import { createGaussRng } from './gauss-rng.js';
import { deg2Rad } from './math-helpers.js';
import { applyMatrix, pathPoly, svgPoly } from './poly-helpers.js';
import { rect } from './rect.js';

const SEED = 42; // Date.now() ^ (Math.random() * 0x100000000);
const rng = xoroshiro128plus(SEED);
const random = () => uniformFloat64(rng);
const gaussRng = createGaussRng({ rng: () => random() });

const PALETTE = IBM5153Contrast(TRUE_CGA_PALETTE, 0.7);

function ensureExists<T>(
  it: T | null | undefined,
  message: string = 'value is not defined',
): asserts it is T {
  if (it === null || it === undefined) {
    console.error(message);
    process.exit(-1);
  }
}

const rootPath = '/Volumes/share/sierra/lbow1/';
const matchFn = ResourceMatchers.match({
  number: 28,
  type: ResourceTypes.PIC_TYPE,
});
// const rootPath = '/Volumes/share/sierra/pq2/';
// const matchFn = ResourceMatchers.match({
//   number: 300,
//   type: ResourceTypes.PIC_TYPE,
// });

const mappingPath = join(rootPath, 'resource.map');
const mappings = parseAllMappings(await readFile(mappingPath));

const resolveColor = (
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

const match = mappings.find(matchFn);
ensureExists(match, 'resource not found…');

const resourcePath = join(
  rootPath,
  `resource.${match.file.toString(10).padStart(3, '0')}`,
);
const [header, resourcePayload] = parseHeaderWithPayload(
  await readFile(resourcePath),
  match.offset,
);
const payload = decompress('sci0', header.compression, resourcePayload);
const pic = parsePic(payload, { defer: true });

const canvas = createCanvas(320 * 5, 190 * 6);
const rc: RoughCanvas = Rough.canvas(canvas, { seed: SEED });
const ctx = canvas.getContext('2d');

const screenSpace = M.scale(5, 6);

const paper = await loadImage('/Users/jholmes/Pictures/paper.png');
const paperPaths = [
  ...watercolorize(rect(-100, -100, canvas.width + 200, canvas.height + 200), {
    random,
    preEvolutions: 0,
    evolutions: 1,
    layersPerEvolution: 1,
    simplifyEachEvolution: 4,
    vertexWeights: [0.025, 0.025, 0.025, 0.025],
  }),
];
const paperMatrix = M.compose([
  M.scale(0.75, 0.75, canvas.width / 2, canvas.height / 2),
  M.rotate(gaussRng(0, deg2Rad(0.25)), canvas.width / 2, canvas.height / 2),
]);
const paperPattern = ctx.createPattern(paper, 'repeat');
paperPattern.setTransform(
  M.compose(
    M.rotate(random() * Math.PI * 2),
    M.translate(random() * paper.width, random() * paper.height),
  ),
);

ctx.save();
ctx.shadowColor = 'rgba(0 0 0 / 0.75)';
ctx.shadowOffsetX = 10;
ctx.shadowOffsetY = 8;
ctx.shadowBlur = 10;
ctx.fillStyle = 'white'; // paperPattern;
ctx.setTransform(paperMatrix);
for (const path of paperPaths) {
  ctx.beginPath();
  pathPoly(ctx, path);
  ctx.fill();
}
ctx.restore();

ctx.setTransform(
  M.compose([
    M.scale(0.7, 0.7, canvas.width / 2, canvas.height / 2),
    M.translate(gaussRng(0, 5), gaussRng(0, 6)),
    M.rotate(
      gaussRng(0, deg2Rad(0.5)),
      canvas.width / 2 + gaussRng(0, 50),
      canvas.height / 2 + gaussRng(0, 50),
    ),
  ]),
);

ctx.globalCompositeOperation = 'multiply';
/* marker layer */
for (const [idx, cmd, layers, meta] of generatePic(pic)) {
  if (cmd[0] !== 'FILL') continue;

  const [, [drawMode, drawCodes]] = cmd;
  if (!DrawMode.isVisualMode(drawMode)) continue;

  const pixels = Uint8ClampedArray.from(
    layers.tBuffer.map((val) => (val === idx ? 0xff : 0x00)),
  );

  const dest = Uint8ClampedArray.from(pixels);
  convolution2D(K_GAUSS_BLUR_3x3, pixels, [320, 190], dest);
  dest.map((it) => (it > 128 ? 0xff : 0x00));

  const angle = gaussRng(45, 5);

  const pathData = [...trace(dest, [320, 190], { polygonify: false })]
    .map((ring) => svgPoly(applyMatrix(screenSpace, ring)))
    .join(' ');

  const fillStyle = random() < 0.5 ? 'zigzag' : 'hachure';

  rc.path(pathData, {
    fill: resolveColor(
      drawCodes,
      meta.palettes,
      gaussRng(0.5, 0.333),
      Math.max(0, gaussRng(0.125, 0.05)),
    ),
    stroke: 'none',
    fillStyle,
    fillWeight: gaussRng(30, 2),
    roughness: 4,
    bowing: gaussRng(3, 1),
    hachureAngle: angle,
    hachureGap: fillStyle === 'zigzag' ? gaussRng(55, 5) : gaussRng(35, 2),
  });
}

ctx.globalCompositeOperation = 'source-over';

/* perform fills */
for (const [idx, cmd, layers, meta] of generatePic(pic)) {
  if (cmd[0] !== 'FILL') continue;

  const [, [drawMode, drawCodes]] = cmd;
  if (!DrawMode.isVisualMode(drawMode)) continue;

  const pixels = Uint8ClampedArray.from(
    layers.tBuffer.map((val) => (val === idx ? 0xff : 0x00)),
  );

  const evolutions = 12,
    layersPerEvolution = 2;

  const rings = trace(pixels, [320, 190]);

  if (rings.length === 0) continue;

  const allPolys = [...rings].map((ring) => [
    ...watercolorize(applyMatrix(screenSpace, ring), {
      random,
      preEvolutions: 2,
      evolutions,
      layersPerEvolution,
      layerEvolutions: 2,
      blurWeightsOnDistort: true,
      simplifyEachEvolution: 5,
      vertexWeights: convolution1D(
        K_GAUSS_BLUR_5,
        ring.map(() => Math.max(0, gaussRng(0.1, 0.025))),
        Array.from<number>({ length: ring.length }),
      ),
    }),
  ]);

  while (allPolys.some((it) => it.length)) {
    ctx.beginPath();
    for (const poly of allPolys.map((it) => it.shift())) {
      if (poly === undefined) continue;
      pathPoly(ctx, poly);
    }
    ctx.fillStyle = resolveColor(
      drawCodes,
      meta.palettes,
      gaussRng(0.5, 0.1),
      gaussRng(0.075, 0.02),
    );
    ctx.fill();
  }
}

ctx.globalCompositeOperation = 'source-atop';

/* draw lines and brushes */
for (const [, cmd, , meta] of generatePic(pic)) {
  switch (cmd[0]) {
    case 'PLINE': {
      const [, [drawMode, drawCodes], ...points] = cmd;
      if (!DrawMode.isVisualMode(drawMode)) break;

      Array(4)
        .fill(0)
        .forEach(() => {
          const strokeColor = resolveColor(
            drawCodes,
            meta.palettes,
            gaussRng(0.5, 0.25),
            gaussRng(0.25, 0.125),
          );
          rc.linearPath(
            points.map(([x, y]) => [
              x * 5 + gaussRng(0, 1),
              y * 6 + gaussRng(0, 2),
            ]),
            {
              stroke: strokeColor,
              roughness: gaussRng(2.5, 1),
              strokeWidth: Math.max(1, gaussRng(5, 2)),
              preserveVertices: true,
              simplification: 0.2,
              bowing: gaussRng(0.75, 0.333),
            },
          );
        });

      break;
    }
    case 'BRUSH': {
      const [, [drawMode, drawCodes, size, isRect, isSpray], ...points] = cmd;
      if (!DrawMode.isVisualMode(drawMode)) break;

      for (const point of points) {
        if (isRect) {
          if (isSpray) {
            Array.from({ length: 3 }).forEach(() => {
              const [x, y] = [
                point[0] * 5 + gaussRng(0, 2.5),
                point[1] * 6 + gaussRng(0, 3),
              ];
              const [w, h] = [
                (2 + size) * 5 + gaussRng(0, 2.5),
                (1 + size) * 6 + gaussRng(0, 3),
              ];
              rc.rectangle(x - w, y - h, w * 2, h * 2, {
                fill: resolveColor(
                  drawCodes,
                  meta.palettes,
                  gaussRng(0.5, 0.5),
                  0.8,
                ),
                fillStyle: 'dots',
                fillWeight: Math.max(2, gaussRng(5, 1)),
                hachureGap: gaussRng(32, 5),
                roughness: gaussRng(1.5, 0.5),
                stroke: 'none',
              });
            });
          } else {
            const [x, y] = [
              point[0] * 5 + gaussRng(0, 2.5),
              point[1] * 6 + gaussRng(0, 3),
            ];
            const [w, h] = [
              (2 + size) * 5 + gaussRng(0, 2.5),
              (1 + size) * 6 + gaussRng(0, 3),
            ];
            rc.rectangle(x - w, y - h, w * 2, h * 2, {
              fill: resolveColor(
                drawCodes,
                meta.palettes,
                gaussRng(0.5, 0.5),
                0.8,
              ),
              fillStyle: 'solid',
              stroke: 'none',
            });
          }
        } else {
          if (isSpray) {
            Array.from({ length: 3 }).forEach(() => {
              rc.ellipse(
                point[0] * 5 + gaussRng(0, 3),
                point[1] * 6 + gaussRng(0, 3),
                (1 + size) * 2 * 5 + gaussRng(0, 2.5),
                (1 + size) * 2 * 6 + gaussRng(0, 3),
                {
                  fill: resolveColor(
                    drawCodes,
                    meta.palettes,
                    gaussRng(0.5, 0.5),
                    0.8,
                  ),
                  fillStyle: 'dots',
                  fillWeight: Math.max(2, gaussRng(5, 1)),
                  hachureGap: gaussRng(32, 5),
                  roughness: gaussRng(1.5, 0.5),
                  stroke: 'none',
                },
              );
            });
          } else {
            rc.ellipse(
              point[0] * 5 + gaussRng(0, 3),
              point[1] * 6 + gaussRng(0, 3),
              (1 + size) * 2 * 5 + gaussRng(0, 2.5),
              (1 + size) * 2 * 6 + gaussRng(0, 3),
              {
                fill: resolveColor(
                  drawCodes,
                  meta.palettes,
                  gaussRng(0.5, 0.25),
                  0.8,
                ),
                fillStyle: 'solid',
                roughness: gaussRng(1.5, 0.5),
                stroke: 'none',
              },
            );
          }
        }
      }

      break;
    }
    default:
  }
}

ctx.save();
ctx.fillStyle = paperPattern;
ctx.setTransform(paperMatrix);
ctx.globalCompositeOperation = 'multiply';
for (const path of paperPaths) {
  ctx.beginPath();
  pathPoly(ctx, path);
  ctx.fill();
}
ctx.restore();

process.stdout.write(await canvas.encode('png'));
