import type { Pic } from '@4bitlabs/sci0';
import { generatePic } from '@4bitlabs/sci0-renderer';
import { type Canvas, createCanvas } from '@napi-rs/canvas';
import { uniformFloat64 } from 'pure-rand/distribution/uniformFloat64';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import Rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bundled/canvas.js';
import M from 'transformation-matrix';
import { deg2Rad } from '../math/angles.js';
import { createGaussRng } from '../math/gauss-rng.js';
import { createCapture } from '../utils/create-capture.js';
import { inkLayer } from './ink-layer.js';
import { markerLayer } from './marker-layer.js';
import { paperWrapper } from './paper-wrapper.js';
import type { RenderOptions } from './render-options.js';
import { watercolorLayer } from './watercolor-layer.js';

export async function render(
  pic: Pic,
  options: RenderOptions,
  capSteps: boolean = false,
): Promise<[Canvas, seed: number]> {
  const { seed = Date.now() ^ (Math.random() * 0x1_0000_0000) } = options;

  const rng = xoroshiro128plus(seed);
  const random = () => uniformFloat64(rng);
  const gaussRng = createGaussRng(random);

  const canvas = createCanvas(320 * 5, 190 * 6);
  const rc: RoughCanvas = Rough.canvas(canvas, { seed });
  const ctx = canvas.getContext('2d');

  const screenSpace = M.scale(5, 6);

  const cap = createCapture(canvas, capSteps);

  await paperWrapper(rng, ctx, options, async () => {
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

    const picData = [...generatePic(pic)];
    await markerLayer(rng, ctx, rc, screenSpace, picData, cap);
    await watercolorLayer(rng, ctx, screenSpace, picData, cap);
    await inkLayer(rng, ctx, rc, screenSpace, picData, cap);

    await cap();
  });

  return [canvas, seed];
}
