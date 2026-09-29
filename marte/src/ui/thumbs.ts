// Miniaturas holográficas das estruturas: renderizadas UMA vez (128 px) com o material de holograma.
import * as THREE from 'three';
import { holoMaterial, HOLO_OK } from '../render/holo';

export function makeThumbs(renderer: THREE.WebGLRenderer, items: Record<string, () => THREE.Object3D>, size = 128) {
  const out: Record<string, string> = {};
  const scene = new THREE.Scene();
  const mat = holoMaterial(HOLO_OK, 1.6);
  scene.overrideMaterial = mat;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const rt = new THREE.WebGLRenderTarget(size, size);
  const buf = new Uint8Array(size * size * 4);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const prevTarget = renderer.getRenderTarget();
  const prevColor = new THREE.Color(); renderer.getClearColor(prevColor);
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  for (const [k, make] of Object.entries(items)) {
    const obj = make();
    obj.traverse((o) => { if ((o as THREE.Light).isLight) o.visible = false; });
    scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() * 0.5;
    const d = r / Math.sin(THREE.MathUtils.degToRad(15)) * 1.02;
    cam.position.set(c.x + d * 0.62, c.y + d * 0.42, c.z + d * 0.66);
    cam.lookAt(c);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const si = ((size - 1 - y) * size + x) * 4, di = (y * size + x) * 4;
      const l = Math.max(buf[si], buf[si + 1], buf[si + 2]);
      img.data[di] = buf[si]; img.data[di + 1] = buf[si + 1]; img.data[di + 2] = buf[si + 2]; img.data[di + 3] = Math.min(255, l * 2);
    }
    ctx.putImageData(img, 0, 0);
    out[k] = cv.toDataURL();
    scene.remove(obj);
  }
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose(); mat.dispose();
  return out;
}
