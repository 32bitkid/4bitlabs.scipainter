export const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
): [number, number][] => [
  [x, y],
  [x, y + h],
  [x + w, y + h],
  [x + w, y],
];
