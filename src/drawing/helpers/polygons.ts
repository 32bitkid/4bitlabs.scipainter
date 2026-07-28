import type { CanvasRenderingContext2D } from '@napi-rs/canvas';
import type { Matrix } from 'transformation-matrix';

export function pathPoly(
  ctx: CanvasRenderingContext2D,
  points: (readonly [number, number])[],
) {
  const [first, ...rest] = points;
  if (first === undefined) return;

  ctx.moveTo(...first);
  rest.forEach(([x, y]) => {
    ctx.lineTo(x, y);
  });
  ctx.closePath();
}

export function svgPoly(points: (readonly [number, number])[]): string {
  const path = points.reduce((prev, point, idx) => {
    const cmd = idx === 0 ? 'M' : 'L';
    return `${prev} ${cmd} ${point[0]} ${point[1]}`;
  }, '');
  return `${path} Z`;
}

type Point = [x: number, y: number];

export const applyMatrixFn =
  ({ a, b, c, d, e, f }: Matrix) =>
  ([x, y]: Readonly<Point>): Point => [a * x + c * y + e, b * x + d * y + f];

export const applyMatrix = (
  matrix: Matrix,
  points: Readonly<Point>[],
): Point[] => points.map(applyMatrixFn(matrix));

export function windingOrder(polygon: Readonly<Point>[]): 'cw' | 'ccw' {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (a === undefined || b === undefined) continue;
    sum += (b[0] - a[0]) * (b[1] + a[1]);
  }
  return sum > 0 ? 'cw' : 'ccw';
}
