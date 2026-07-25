#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DrawMode,
  decompress,
  parseAllMappings,
  parseHeaderWithPayload,
  parsePic,
  ResourceMatchers,
  ResourceTypes,
} from '@4bitlabs/sci0';
import { generatePic } from '@4bitlabs/sci0-renderer';
import { type Canvas, createCanvas, loadImage } from '@napi-rs/canvas';
import { convolution1D, K_GAUSS_BLUR_5 } from '@watercolorizer/convolution';
import { trace } from '@watercolorizer/tracer';
import { watercolorize } from '@watercolorizer/watercolorizer';
import { uniformFloat64 } from 'pure-rand/distribution/uniformFloat64';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import Rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bundled/canvas.js';
import M from 'transformation-matrix';
import { ensureExists } from './ensure-exists.js';
import { extractDirtyPixels } from './extract-dirty-pixels.js';
import { createGaussRng } from './gauss-rng.js';
import { deg2Rad } from './math-helpers.js';
import { applyMatrix, pathPoly, svgPoly } from './poly-helpers.js';
import { rect } from './rect.js';
import { resolveColor } from './resolve-color.js';
import { shuffled } from './shuffled.js';

const SEED = 42; // Date.now() ^ (Math.random() * 0x100000000);
const rng = xoroshiro128plus(SEED);
const random = () => uniformFloat64(rng);
const gaussRng = createGaussRng(random);

const rootPath = '/Volumes/share/sierra/lbow1/';
const matchFn = ResourceMatchers.match({
  number: 30,
  type: ResourceTypes.PIC_TYPE,
});
// const rootPath = '/Volumes/share/sierra/pq2/';
// const matchFn = ResourceMatchers.match({
//   number: 25,
//   type: ResourceTypes.PIC_TYPE,
// });
// const rootPath = '/Volumes/share/sierra/sq3/';
// const matchFn = ResourceMatchers.match({
//   number: 63,
//   type: ResourceTypes.PIC_TYPE,
// });
// const rootPath = '/Volumes/share/sierra/camelot/';
// const matchFn = ResourceMatchers.match({
//   number: 110,
//   type: ResourceTypes.PIC_TYPE,
// });

const mappingPath = join(rootPath, 'resource.map');
const mappings = parseAllMappings(await readFile(mappingPath));

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

const createCapture = (cnvs: Canvas, enabled: boolean = false) => {
  let frames = 0;
  return async () => {
    if (!enabled) return;
    const data = await cnvs.encode('png');
    await writeFile(
      `./out/frame.${frames.toString(10).padStart(5, '0')}.png`,
      data,
    );
    frames += 1;
  };
};

const cap = createCapture(canvas);

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

  const angle = gaussRng(45, 5);

  const pixels = extractDirtyPixels(layers.tBuffer, idx, { random });
  const pathData = [...trace(pixels, [320, 190], { polygonify: true })]
    .map((ring) => svgPoly(applyMatrix(screenSpace, ring)))
    .join(' ');

  const fillStyle =
    random() < 0.25 ? 'zigzag' : random() < 0.5 ? 'hachure' : 'solid';

  rc.path(pathData, {
    fill: resolveColor(
      drawCodes,
      meta.palettes,
      gaussRng(0.5, 0.333),
      Math.max(0, gaussRng(0.2, 0.075)),
    ),
    stroke: 'none',
    fillStyle,
    fillWeight: gaussRng(30, 5),
    roughness: 2,
    bowing: gaussRng(3, 1),
    hachureAngle: angle,
    hachureGap: fillStyle === 'zigzag' ? gaussRng(55, 5) : gaussRng(35, 2),
  });

  await cap();
}

ctx.globalCompositeOperation = 'overlay';

/* collect fills */
const fills: (() => void)[] = [];
for (const [idx, cmd, layers, meta] of generatePic(pic)) {
  if (cmd[0] !== 'FILL') continue;

  const [, [drawMode, drawCodes]] = cmd;
  if (!DrawMode.isVisualMode(drawMode)) continue;

  const evolutions = 12,
    layersPerEvolution = 2;

  const result = extractDirtyPixels(layers.tBuffer, idx, { random });
  const rings = trace(result, [320, 190]);

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
        ring.map(() => Math.max(0, gaussRng(0.175, 0.1))),
        Array.from<number>({ length: ring.length }),
      ),
    }),
  ]);

  while (allPolys.some((it) => it.length)) {
    const rings = allPolys.map((it) => it.shift());
    fills.push(() => {
      ctx.save();
      ctx.beginPath();
      for (const poly of rings) {
        if (poly === undefined) continue;
        pathPoly(ctx, poly);
      }
      const color = resolveColor(
        drawCodes,
        meta.palettes,
        gaussRng(0.5, 0.1),
        gaussRng(0.07, 0.02),
      );
      ctx.fillStyle = color;
      ctx.globalCompositeOperation =
        random() < 0.5 ? 'source-over' : 'multiply';
      ctx.fill();

      if (random() < 0.3333) {
        ctx.lineWidth = gaussRng(4, 2);
        ctx.strokeStyle = color;
        ctx.stroke();
      }
      ctx.restore();
    });
  }
}

// shuffle and draw watercolor layers
for (const fillFn of shuffled(fills, rng)) {
  fillFn();
  await cap();
}

ctx.globalCompositeOperation = 'source-atop';

/* draw lines and brushes */
for (const [, cmd, , meta] of generatePic(pic)) {
  switch (cmd[0]) {
    case 'PLINE': {
      const [, [drawMode, drawCodes], ...points] = cmd;
      if (!DrawMode.isVisualMode(drawMode)) break;

      for (let i = 0; i < 4; i++) {
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
            strokeWidth: Math.max(1, gaussRng(5.5, 2)),
            preserveVertices: true,
            simplification: 0.2,
            bowing: gaussRng(0.9, 0.333),
          },
        );
        await cap();
      }

      break;
    }
    case 'BRUSH': {
      const [, [drawMode, drawCodes, size, isRect, isSpray], ...points] = cmd;
      if (!DrawMode.isVisualMode(drawMode)) break;

      for (const point of points) {
        if (isRect) {
          if (isSpray) {
            for (let i = 0; i < 3; i++) {
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
              await cap();
            }
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
            await cap();
          }
        } else {
          if (isSpray) {
            for (let i = 0; i < 3; i++) {
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
              await cap();
            }
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
            await cap();
          }
        }
      }

      break;
    }
    default:
  }
}

const paperPattern = ctx.createPattern(paper, 'repeat');

ctx.save();
ctx.fillStyle = paperPattern;
ctx.setTransform(paperMatrix);
paperPattern.setTransform(
  M.compose(
    M.scale(0.75, 0.75, paper.width / 2, paper.height / 2),
    M.rotate(random() * Math.PI * 2, paper.width / 2, paper.height / 2),
    M.translate(random() * paper.width, random() * paper.height),
  ),
);
ctx.globalCompositeOperation = 'multiply';
for (const path of paperPaths) {
  ctx.beginPath();
  pathPoly(ctx, path);
  ctx.fill();
}
ctx.restore();

await cap();

process.stdout.write(await canvas.encode('png'));
