import { type Canvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { watercolorize } from '@watercolorizer/watercolorizer';
import { uniformFloat64 } from 'pure-rand/distribution/uniformFloat64';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';
import M from 'transformation-matrix';
import { deg2Rad } from '../math/angles.js';
import { createGaussRng } from '../math/gauss-rng.js';
import { pathPoly } from './helpers/polygons.js';
import { rect } from './helpers/rect.js';

export async function paperWrapper(
  rng: RandomGenerator,
  ctx: SKRSContext2D,
  content: () => Promise<void> | void,
): Promise<void> {
  const canvas = ctx.canvas;
  const uf64Rng = () => uniformFloat64(rng);
  const gf64Rng = createGaussRng(uf64Rng);

  const paper = await loadImage('/Users/jholmes/Pictures/paper.png');
  const paperPaths = [
    ...watercolorize(
      rect(-100, -100, canvas.width + 200, canvas.height + 200),
      {
        random: uf64Rng,
        preEvolutions: 0,
        evolutions: 1,
        layersPerEvolution: 1,
        simplifyEachEvolution: 4,
        vertexWeights: [0.025, 0.025, 0.025, 0.025],
      },
    ),
  ];
  const paperMatrix = M.compose([
    M.scale(0.75, 0.75, canvas.width / 2, canvas.height / 2),
    M.rotate(gf64Rng(0, deg2Rad(0.125)), canvas.width / 2, canvas.height / 2),
  ]);

  ctx.save();
  ctx.shadowColor = 'rgba(0 0 0 / 0.75)';
  ctx.shadowOffsetX = 10 + gf64Rng(0, 1.5);
  ctx.shadowOffsetY = 8 + gf64Rng(0, 1);
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'white'; // paperPattern;
  ctx.setTransform(paperMatrix);
  for (const path of paperPaths) {
    ctx.beginPath();
    pathPoly(ctx, path);
    ctx.fill();
  }
  ctx.restore();

  await content();

  const paperPattern = ctx.createPattern(paper, 'repeat');
  ctx.save();
  ctx.fillStyle = paperPattern;
  ctx.setTransform(paperMatrix);
  paperPattern.setTransform(
    M.compose(
      M.scale(0.75, 0.75, paper.width / 2, paper.height / 2),
      M.rotate(uf64Rng() * Math.PI * 2, paper.width / 2, paper.height / 2),
      M.translate(uf64Rng() * paper.width, uf64Rng() * paper.height),
    ),
  );
  ctx.globalCompositeOperation = 'multiply';
  for (const path of paperPaths) {
    ctx.beginPath();
    pathPoly(ctx, path);
    ctx.fill();
  }
  ctx.restore();
}
