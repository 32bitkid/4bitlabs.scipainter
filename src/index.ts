#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  decompress,
  parseAllMappings,
  parseHeaderWithPayload,
  parsePic,
  ResourceMatchers,
  ResourceTypes,
} from '@4bitlabs/sci0';
import { generatePic } from '@4bitlabs/sci0-renderer';
import { createCanvas } from '@napi-rs/canvas';
import { uniformFloat64 } from 'pure-rand/distribution/uniformFloat64';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import Rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bundled/canvas.js';
import M from 'transformation-matrix';
import { inkLayer } from './drawing/ink-layer.js';
import { markerLayer } from './drawing/marker-layer.js';
import { paperWrapper } from './drawing/paper-wrapper.js';
import { watercolorLayer } from './drawing/watercolor-layer.js';
import { deg2Rad } from './math/angles.js';
import { createGaussRng } from './math/gauss-rng.js';
import { createCapture } from './utils/create-capture.js';
import { ensureExists } from './utils/ensure-exists.js';

const SEED = Date.now() ^ (Math.random() * 0x1_0000_0000);
const rng = xoroshiro128plus(SEED);
const random = () => uniformFloat64(rng);
const gaussRng = createGaussRng(random);

const rootPath = '/Volumes/share/sierra/lbow1/';
const matchFn = ResourceMatchers.match({
  number: 128,
  type: ResourceTypes.PIC_TYPE,
});
// const rootPath = '/Volumes/share/sierra/pq2/';
// const matchFn = ResourceMatchers.match({
//   number: 25,
//   type: ResourceTypes.PIC_TYPE,
// });
// const rootPath = '/Volumes/share/sierra/sq3/';
// const matchFn = ResourceMatchers.match({
//   number: 30,
//   type: ResourceTypes.PIC_TYPE,
// });
// const rootPath = '/Volumes/share/sierra/camelot/';
// const matchFn = ResourceMatchers.match({
//   number: 69,
//   type: ResourceTypes.PIC_TYPE,
// });
// const rootPath = '/Volumes/share/sierra/qg1/';
// const matchFn = ResourceMatchers.match({
//   number: 10,
//   type: ResourceTypes.PIC_TYPE,
// });
// const rootPath = '/Volumes/share/sierra/qg2';
// const matchFn = ResourceMatchers.match({
//   number: 290,
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

const canvas = createCanvas(320 * 5, 190 * 6);
const rc: RoughCanvas = Rough.canvas(canvas, { seed: SEED });
const ctx = canvas.getContext('2d');

const screenSpace = M.scale(5, 6);

const cap = createCapture(canvas);

await paperWrapper(rng, ctx, async () => {
  ctx.setTransform(
    M.compose([
      M.scale(0.7, 0.7, canvas.width / 2, canvas.height / 2),
      M.translate(gaussRng(0, 5), gaussRng(0, 6)),
      M.rotate(
        gaussRng(0, deg2Rad(0.25)),
        canvas.width / 2 + gaussRng(0, 50),
        canvas.height / 2 + gaussRng(0, 50),
      ),
    ]),
  );

  const pic = parsePic(payload, { defer: true });
  const picData = [...generatePic(pic)];
  await markerLayer(rng, ctx, rc, screenSpace, picData, cap);
  await watercolorLayer(rng, ctx, screenSpace, picData, cap);
  await inkLayer(rng, ctx, rc, screenSpace, picData, cap);

  await cap();
});

process.stdout.write(await canvas.encode('png'));
