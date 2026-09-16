/**
 * Instanced character rendering.
 *
 * Each Wobbler keeps its own bone hierarchy (so animation stays simple and
 * readable), but nothing in that hierarchy is a mesh. Instead every part type -
 * head, torso, upper arm, eye - gets one InstancedMesh shared by the whole
 * field. Thirty-two fully articulated characters then cost about a dozen draw
 * calls instead of seven hundred, which is the difference between shipping on a
 * phone and not.
 *
 * Distance also drops detail: fingers and eyebrows on a character ten pixels
 * tall are pure waste.
 */
import * as THREE from 'three';
import { Wobbler, PART_GEO, PartGeoKey, PartMaterial } from './character';

interface Slot {
  wobbler: Wobbler;
  colorVersion: number;
}

interface Batch {
  mesh: THREE.InstancedMesh;
  /** Which (wobbler, part) each instance belongs to. */
  refs: { slot: number; partIndex: number }[];
  material: PartMaterial;
}

const _m = new THREE.Matrix4();
const _hide = new THREE.Matrix4().makeScale(0, 0, 0);
const _color = new THREE.Color();
const _camPos = new THREE.Vector3();
const _partPos = new THREE.Vector3();

export class CharacterBatch {
  readonly root = new THREE.Group();
  private slots: (Slot | null)[] = [];
  batches = new Map<string, Batch>();
  private materials = new Map<PartMaterial, THREE.Material>();
  private capacity: number;
  private dirtyColors = true;
  /** Squared distances at which LOD 2 and LOD 1 parts stop being drawn. */
  private lod2DistSq = 26 * 26;
  private lod1DistSq = 52 * 52;

  constructor(capacity = 40) {
    this.capacity = capacity;
    this.materials.set('skin', new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 }));
    this.materials.set('accent', new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 }));
    this.materials.set('eye', new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
    this.materials.set('dark', new THREE.MeshStandardMaterial({ color: 0x1b2233, roughness: 0.25 }));
    this.root.frustumCulled = false;
  }

  /** Detail distances scale with the quality preset. */
  setLodScale(scale: number): void {
    this.lod2DistSq = (26 * scale) ** 2;
    this.lod1DistSq = (52 * scale) ** 2;
  }

  add(w: Wobbler): number {
    let slot = this.slots.findIndex((s) => s === null);
    if (slot < 0) { slot = this.slots.length; this.slots.push(null); }
    this.slots[slot] = { wobbler: w, colorVersion: -1 };
    this.rebuild();
    return slot;
  }

  remove(w: Wobbler): void {
    const i = this.slots.findIndex((s) => s?.wobbler === w);
    if (i >= 0) { this.slots[i] = null; this.rebuild(); }
  }

  /**
   * Rebuilds the instance tables. Only happens when players join or leave, not
   * per frame, so the O(n) walk here is free in practice.
   */
  private rebuild(): void {
    for (const b of this.batches.values()) b.refs.length = 0;

    for (let slot = 0; slot < this.slots.length; slot++) {
      const s = this.slots[slot];
      if (!s) continue;
      const parts = s.wobbler.parts;
      for (let pi = 0; pi < parts.length; pi++) {
        const part = parts[pi];
        const key = `${part.geo}|${part.mat}`;
        let batch = this.batches.get(key);
        if (!batch) {
          batch = this.makeBatch(key, part.geo, part.mat);
          this.batches.set(key, batch);
        }
        batch.refs.push({ slot, partIndex: pi });
      }
    }

    for (const b of this.batches.values()) {
      if (b.refs.length > b.mesh.count) {
        // Grow: instanced meshes cannot be resized, so replace it.
        const old = b.mesh;
        const geoKey = old.userData.geo as PartGeoKey;
        const grown = this.makeInstanced(geoKey, b.material, Math.ceil(b.refs.length * 1.4));
        this.root.remove(old);
        old.dispose();
        this.root.add(grown);
        b.mesh = grown;
      }
      b.mesh.count = b.refs.length;
    }
    this.dirtyColors = true;
  }

  private makeBatch(key: string, geo: PartGeoKey, mat: PartMaterial): Batch {
    const mesh = this.makeInstanced(geo, mat, Math.max(8, this.capacity * 2));
    this.root.add(mesh);
    void key;
    return { mesh, refs: [], material: mat };
  }

  private makeInstanced(geo: PartGeoKey, mat: PartMaterial, count: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(PART_GEO[geo], this.materials.get(mat)!, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.userData.geo = geo;
    mesh.count = 0;
    // Per-instance colour is only meaningful for the character-tinted parts.
    if (mat === 'skin' || mat === 'accent') {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    return mesh;
  }

  /** Copies every visible part's world matrix into its instance slot. */
  sync(camera: THREE.Camera): void {
    camera.getWorldPosition(_camPos);

    for (const s of this.slots) {
      if (!s) continue;
      s.wobbler.root.updateWorldMatrix(false, true);
    }

    for (const b of this.batches.values()) {
      let colorDirty = this.dirtyColors;
      for (let i = 0; i < b.refs.length; i++) {
        const ref = b.refs[i];
        const s = this.slots[ref.slot];
        if (!s || !s.wobbler.root.visible) { b.mesh.setMatrixAt(i, _hide); continue; }
        const part = s.wobbler.parts[ref.partIndex];

        // Colour first, unconditionally. Writing it after the LOD test means a
        // part that happens to be culled on the one frame colours were dirty
        // keeps the default white forever - which is exactly what happened
        // when the round started with the camera 150 m away on a flyover.
        // Rebuilds also reshuffle instance indices, so a colour written for an
        // old index means nothing: re-upload whenever the table changed.
        if ((this.dirtyColors || s.colorVersion !== s.wobbler.colorVersion) && b.mesh.instanceColor) {
          _color.setHex(b.material === 'accent' ? s.wobbler.accentColor : s.wobbler.skinColor);
          b.mesh.setColorAt(i, _color);
          colorDirty = true;
        }

        // Distance LOD: skip fine detail that is a few pixels tall anyway.
        if (part.lod > 0) {
          _partPos.setFromMatrixPosition(s.wobbler.root.matrixWorld);
          const dSq = _partPos.distanceToSquared(_camPos);
          if ((part.lod >= 2 && dSq > this.lod2DistSq) || (part.lod === 1 && dSq > this.lod1DistSq)) {
            b.mesh.setMatrixAt(i, _hide);
            continue;
          }
        }
        _m.copy(part.node.matrixWorld);
        b.mesh.setMatrixAt(i, _m);
      }
      b.mesh.instanceMatrix.needsUpdate = true;
      if (colorDirty && b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
    }

    for (const s of this.slots) if (s) s.colorVersion = s.wobbler.colorVersion;
    this.dirtyColors = false;
  }

  /** Forces a colour refresh (used after a cosmetic change). */
  invalidateColors(): void {
    this.dirtyColors = true;
    for (const s of this.slots) if (s) s.colorVersion = -1;
  }

  get drawCalls(): number { return this.batches.size; }

  dispose(): void {
    for (const b of this.batches.values()) { this.root.remove(b.mesh); b.mesh.dispose(); }
    this.batches.clear();
    for (const m of this.materials.values()) m.dispose();
    this.slots.length = 0;
  }
}
