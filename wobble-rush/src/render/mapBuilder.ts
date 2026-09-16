/**
 * Builds the visible world from the same MapDef the simulation uses.
 *
 * One source of truth matters more than it sounds: if the mesh and the collider
 * came from different data they would drift, and players would be stopped by
 * things they cannot see. Here a prop *is* its collider.
 *
 * Static geometry is merged per (layout group x material) so a 300-prop map
 * costs a handful of draw calls and groups can still be toggled by the Round
 * Director.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapDef, PropDef } from '../shared/mapdef';
import { ObstacleRuntime } from '../shared/obstacles';
import { ShapeKind, Surface } from '../shared/collision';
import { styleMaterial, StyleKey, PALETTES, TEXTURE_TILE } from './palette';
import { MatchSim } from '../shared/world';

interface GroupMeshes {
  group: string;
  meshes: THREE.Object3D[];
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();

/**
 * Rescales UVs so one texture tile always covers the same world distance.
 * Without this a 30 m floor and a 2 m crate get the same single tile stretched
 * across them, which is what makes untextured-looking "programmer art".
 */
function retileUVs(geo: THREE.BufferGeometry, shape: string, size: [number, number, number]): void {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) return;
  const T = TEXTURE_TILE;
  if (shape === 'box') {
    // BoxGeometry emits faces in the order +X, -X, +Y, -Y, +Z, -Z, 4 verts each.
    const dims: [number, number][] = [
      [size[2], size[1]], [size[2], size[1]],
      [size[0], size[2]], [size[0], size[2]],
      [size[0], size[1]], [size[0], size[1]],
    ];
    for (let f = 0; f < 6; f++) {
      const [du, dv] = dims[f];
      const su = (du * 2) / T;
      const sv = (dv * 2) / T;
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, uv.getX(idx) * su, uv.getY(idx) * sv);
      }
    }
  } else if (shape === 'cylinder' || shape === 'capsule') {
    const su = (2 * Math.PI * size[0]) / T;
    const sv = (size[1] * 2) / T;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  } else {
    const s = (size[0] * 2) / T;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
  }
  uv.needsUpdate = true;
}

function geometryFor(p: PropDef): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry;
  switch (p.shape) {
    case 'cylinder':
      geo = new THREE.CylinderGeometry(p.size[0], p.size[0], p.size[1] * 2, 20); break;
    case 'sphere':
      geo = new THREE.SphereGeometry(p.size[0], 18, 14); break;
    case 'capsule':
      geo = new THREE.CapsuleGeometry(p.size[0], p.size[1] * 2, 6, 14); break;
    default:
      geo = new THREE.BoxGeometry(p.size[0] * 2, p.size[1] * 2, p.size[2] * 2); break;
  }
  retileUVs(geo, p.shape, p.size);
  return geo;
}

export class MapRenderer {
  readonly root = new THREE.Group();
  private groups = new Map<string, GroupMeshes>();
  private obstacleMeshes = new Map<ObstacleRuntime, THREE.Object3D[]>();
  private beltMaterials: THREE.MeshStandardMaterial[] = [];
  private palette: string;
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  private crumbleShake = new Map<ObstacleRuntime, number>();

  constructor(private map: MapDef, private sim: MatchSim) {
    this.palette = map.ambient.palette;
    this.buildStatics();
    this.buildObstacles();
    this.syncGroups();
  }

  private buildStatics(): void {
    // Bucket props by (group, style, colour) so each bucket becomes one mesh.
    const buckets = new Map<string, { props: PropDef[]; style: StyleKey; color?: number; group: string }>();
    for (const p of this.map.props) {
      if (p.collisionOnly) continue;
      const style = (p.style ?? 'floor') as StyleKey;
      const group = p.group ?? '';
      const key = `${group}|${style}|${p.color ?? 'x'}`;
      let b = buckets.get(key);
      if (!b) { b = { props: [], style, color: p.color, group }; buckets.set(key, b); }
      b.props.push(p);
    }

    for (const b of buckets.values()) {
      const geos: THREE.BufferGeometry[] = [];
      for (const p of b.props) {
        const g = geometryFor(p);
        const rot = p.rot ?? [0, 0, 0];
        _e.set(rot[0], rot[1], rot[2], 'YXZ');
        _q.setFromEuler(_e);
        _m.compose(_v.set(p.pos[0], p.pos[1], p.pos[2]), _q, new THREE.Vector3(1, 1, 1));
        g.applyMatrix4(_m);
        geos.push(g);
      }
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) for (const g of geos) g.dispose();
      if (!merged) continue;
      merged.computeVertexNormals();
      const mat = styleMaterial(this.palette, b.style, b.color);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = b.style !== 'lightPanel';
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.root.add(mesh);
      this.disposables.push(merged);
      this.addToGroup(b.group, mesh);
    }
  }

  private addToGroup(group: string, obj: THREE.Object3D): void {
    if (!group) return;
    let g = this.groups.get(group);
    if (!g) { g = { group, meshes: [] }; this.groups.set(group, g); }
    g.meshes.push(obj);
  }

  private buildObstacles(): void {
    for (const rt of this.sim.obstacles) {
      const objs: THREE.Object3D[] = [];
      const def = rt.def;
      const color = def.color;

      for (const c of rt.colliders) {
        let geo: THREE.BufferGeometry;
        let style: StyleKey = 'metal';
        const half: [number, number, number] = [c.half.x, c.half.y, c.half.z];
        switch (c.kind) {
          case ShapeKind.Sphere:
            geo = new THREE.SphereGeometry(c.half.x, 20, 16);
            retileUVs(geo, 'sphere', half); break;
          case ShapeKind.Cylinder:
            geo = new THREE.CylinderGeometry(c.half.x, c.half.x, c.half.y * 2, 24);
            retileUVs(geo, 'cylinder', half); break;
          case ShapeKind.Capsule:
            geo = new THREE.CapsuleGeometry(c.half.x, c.half.y * 2, 8, 16);
            retileUVs(geo, 'capsule', half); break;
          default:
            geo = new THREE.BoxGeometry(c.half.x * 2, c.half.y * 2, c.half.z * 2);
            retileUVs(geo, 'box', half); break;
        }
        if (c.surface === Surface.Rubber) style = 'rubber';
        else if (c.surface === Surface.Grate) style = 'grate';
        else if (c.surface === Surface.Glass) style = 'glass';
        else if (c.surface === Surface.Conveyor) style = 'metal';
        if (c.impact > 0) style = 'hazard';
        if (c.bounce > 0) style = 'accent';

        let mat: THREE.Material;
        if (c.surface === Surface.Conveyor) {
          // Belts need their own material instance: the texture offset scrolls.
          const shared = styleMaterial(this.palette, 'conveyor', color) as THREE.MeshStandardMaterial;
          const bm = shared.clone();
          bm.map = shared.map ? shared.map.clone() : null;
          if (bm.map) { bm.map.needsUpdate = true; bm.map.wrapS = bm.map.wrapT = THREE.RepeatWrapping; }
          this.beltMaterials.push(bm);
          this.disposables.push(bm);
          mat = bm;
        } else {
          mat = styleMaterial(this.palette, style, color);
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.root.add(mesh);
        objs.push(mesh);
        this.disposables.push(geo);

        // Hazards already carry caution stripes in their texture; an extra
        // emissive band on top just made them read as solid black bricks.
      }

      // Force-only obstacles have no collider but still need to be visible.
      if (def.kind === 'fan' || def.kind === 'cannon') {
        const g = new THREE.CylinderGeometry(1.6, 1.6, 0.4, 20);
        const mesh = new THREE.Mesh(g, styleMaterial(this.palette, 'accent'));
        mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
        this.root.add(mesh);
        objs.push(mesh);
        this.disposables.push(g);
      }

      // Pendulum arm: a visible rod from pivot to head sells the mechanism.
      if (def.kind === 'pendulum') {
        const len = def.range ?? 5;
        const g = new THREE.CylinderGeometry(0.12, 0.12, len, 10);
        g.translate(0, -len / 2, 0);
        const rod = new THREE.Mesh(g, styleMaterial(this.palette, 'metal'));
        rod.castShadow = true;
        this.root.add(rod);
        objs.push(rod);
        this.disposables.push(g);
      }

      this.obstacleMeshes.set(rt, objs);
      if (def.group) for (const o of objs) this.addToGroup(def.group, o);
    }

    // Checkpoint gates and the finish line: the player must never wonder where to go.
    for (const cp of this.map.checkpoints) {
      if (cp.index === 0) continue;
      const g = new THREE.TorusGeometry(2.1, 0.13, 8, 28, Math.PI);
      const mesh = new THREE.Mesh(g, styleMaterial(this.palette, 'lightPanel', 0x5cf2c8));
      mesh.position.set(cp.pos[0], cp.pos[1] - 1.4, cp.pos[2]);
      mesh.rotation.z = 0;
      this.root.add(mesh);
      this.disposables.push(g);
      if (cp.group) this.addToGroup(cp.group, mesh);
    }
    for (const v of this.map.volumes) {
      if (v.kind !== 'finish') continue;
      const g = new THREE.BoxGeometry(v.size[0] * 2, 0.3, 0.6);
      const mesh = new THREE.Mesh(g, styleMaterial(this.palette, 'lightPanel', 0xffd166));
      mesh.position.set(v.pos[0], v.pos[1] - v.size[1] + 0.2, v.pos[2]);
      this.root.add(mesh);
      this.disposables.push(g);
    }
    // Updraft columns get a visible shaft of light.
    for (const v of this.map.volumes) {
      if (v.kind !== 'wind') continue;
      const g = new THREE.CylinderGeometry(v.size[0] * 0.9, v.size[0] * 0.6, v.size[1] * 2, 20, 1, true);
      const m = new THREE.MeshBasicMaterial({
        color: 0x9df7ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(v.pos[0], v.pos[1], v.pos[2]);
      mesh.renderOrder = 2;
      this.root.add(mesh);
      this.disposables.push(g, m);
      if (v.group) this.addToGroup(v.group, mesh);
    }
  }

  /** Shows/hides everything according to the Director's active layout. */
  syncGroups(): void {
    const active = this.sim.getActiveGroups();
    for (const [name, g] of this.groups) {
      const on = active.has(name);
      for (const m of g.meshes) m.visible = on;
    }
  }

  /** Copies obstacle transforms from the authoritative colliders. */
  update(dt: number, time: number): void {
    for (const [rt, objs] of this.obstacleMeshes) {
      let i = 0;
      for (const c of rt.colliders) {
        const o = objs[i++];
        if (!o) break;
        o.position.set(c.pos.x, c.pos.y, c.pos.z);
        o.quaternion.set(c.rot.x, c.rot.y, c.rot.z, c.rot.w);
        o.visible = c.enabled && rt.active;
      }
      // Pendulum rod hangs from the pivot toward its head.
      if (rt.def.kind === 'pendulum' && objs.length > i) {
        const rod = objs[i];
        const head = rt.colliders[0];
        if (head && rod) {
          rod.position.set(rt.def.pos[0], rt.def.pos[1], rt.def.pos[2]);
          _v.set(head.pos.x - rt.def.pos[0], head.pos.y - rt.def.pos[1], head.pos.z - rt.def.pos[2]);
          rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), _v.normalize());
          rod.visible = rt.active;
        }
      }
      // Crumbling tiles shudder before they go.
      if (rt.def.kind === 'crumble') {
        const o = objs[0];
        if (o) {
          if (rt.state === 1) {
            const shake = Math.sin(time * 60) * 0.06;
            o.position.x += shake;
            o.position.z += Math.cos(time * 53) * 0.05;
            this.crumbleShake.set(rt, 1);
          } else if (this.crumbleShake.get(rt)) {
            this.crumbleShake.set(rt, 0);
          }
        }
      }
    }
    // Belts scroll.
    for (const m of this.beltMaterials) {
      if (m.map) m.map.offset.y = (m.map.offset.y - dt * 0.9) % 1;
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}

export { PALETTES };
