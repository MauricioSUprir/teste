import { generateRows } from './heightgen';

self.onmessage = (e: MessageEvent<{ seed: number; j0: number; j1: number; far: boolean }>) => {
  const { seed, j0, j1, far } = e.data;
  const r = generateRows(seed, j0, j1, far);
  const tr: Transferable[] = [r.heights.buffer];
  if (r.far) tr.push(r.far.buffer);
  (self as unknown as Worker).postMessage({ j0, j1, heights: r.heights, far: r.far, craters: r.craters }, tr);
};
