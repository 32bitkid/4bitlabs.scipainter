import { writeFile } from 'node:fs/promises';
import type { Canvas } from '@napi-rs/canvas';

export const createCapture = (cnvs: Canvas, enabled: boolean = false) => {
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
