import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
await p.goto('http://localhost:4173/?debug=1&quality=low');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 200000 });
const r = await p.evaluate(() => {
  const g = window.__game; __debug.freeze(true); __debug.renderOnce(0);
  let tank; g.astro.root.traverse(o => { if (o.isMesh && o.material.metalness === 1 && !tank) tank = o; });
  const props = g.renderer.properties.get(tank.material);
  const prog = props.currentProgram;
  return { env: !!g.scene.environment, envType: g.scene.environment?.mapping, matEnv: props.envMap?.uuid, envMapIntensity: tank.material.envMapIntensity, progName: prog?.name, hasEnvDefine: prog ? g.renderer.info.programs.find(x => x === prog)?.cacheKey?.includes('ENVMAP') : null, key: prog?.cacheKey?.slice(0, 400) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
