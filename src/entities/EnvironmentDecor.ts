import * as THREE from 'three/webgpu';
import { AssetManager } from '@/core/AssetManager';

/** Static decoration props — purely visual (no collision), scattered once at load time to dress up the ground plane. */
export const ENV_MODEL_URLS = {
  tree1: '/models/Environment/glTF/Tree_1.gltf',
  tree2: '/models/Environment/glTF/Tree_2.gltf',
  tree3: '/models/Environment/glTF/Tree_3.gltf',
  tree4: '/models/Environment/glTF/Tree_4.gltf',
  containerSmall: '/models/Environment/glTF/Container_Small.gltf',
  containerLong: '/models/Environment/glTF/Container_Long.gltf',
  barrierLarge: '/models/Environment/glTF/Barrier_Large.gltf',
  barrierSingle: '/models/Environment/glTF/Barrier_Single.gltf',
  barrierTrash: '/models/Environment/glTF/Barrier_Trash.gltf',
  crate: '/models/Environment/glTF/Crate.gltf',
  fence: '/models/Environment/glTF/Fence.gltf',
  metalFence: '/models/Environment/glTF/MetalFence.gltf',
  streetLight: '/models/Environment/glTF/StreetLight.gltf',
  sign: '/models/Environment/glTF/Sign.gltf',
  trafficCone: '/models/Environment/glTF/TrafficCone.gltf',
  sackTrench: '/models/Environment/glTF/SackTrench.gltf',
  woodPlanks: '/models/Environment/glTF/WoodPlanks.gltf',
  pallet: '/models/Environment/glTF/Pallet.gltf',
  brokenCar: '/models/Environment/glTF/Debris_BrokenCar.gltf',
  tank: '/models/Environment/glTF/Tank.gltf',
  explodingBarrel: '/models/Environment/glTF/ExplodingBarrel.gltf',
} as const;

interface ScatterRule {
  url: string;
  count: number;
  minScale?: number;
  maxScale?: number;
}

const SCATTER_RULES: ScatterRule[] = [
  { url: ENV_MODEL_URLS.tree1, count: 12 },
  { url: ENV_MODEL_URLS.tree2, count: 12 },
  { url: ENV_MODEL_URLS.tree3, count: 10 },
  { url: ENV_MODEL_URLS.tree4, count: 10 },
  { url: ENV_MODEL_URLS.containerSmall, count: 5 },
  { url: ENV_MODEL_URLS.containerLong, count: 4 },
  { url: ENV_MODEL_URLS.barrierLarge, count: 8 },
  { url: ENV_MODEL_URLS.barrierSingle, count: 10 },
  { url: ENV_MODEL_URLS.barrierTrash, count: 6 },
  { url: ENV_MODEL_URLS.crate, count: 16 },
  { url: ENV_MODEL_URLS.fence, count: 10 },
  { url: ENV_MODEL_URLS.metalFence, count: 8 },
  { url: ENV_MODEL_URLS.streetLight, count: 7 },
  { url: ENV_MODEL_URLS.sign, count: 5 },
  { url: ENV_MODEL_URLS.trafficCone, count: 8 },
  { url: ENV_MODEL_URLS.sackTrench, count: 6 },
  { url: ENV_MODEL_URLS.woodPlanks, count: 6 },
  { url: ENV_MODEL_URLS.pallet, count: 6 },
  { url: ENV_MODEL_URLS.brokenCar, count: 3 },
  { url: ENV_MODEL_URLS.explodingBarrel, count: 8 },
];

/** Nothing is placed closer than this — keeps the Planning build area and the early wave clear of visual clutter/false obstacles. */
const CLEAR_RADIUS = 18;
const MAX_RADIUS = 92;

/**
 * Scatters every rule's prop count in an annulus around the origin, once,
 * at load time — this is permanent set dressing, not a gameplay entity, so
 * plain `Object3D.clone()` (sharing geometry/material by reference) is
 * appropriate; no pool, no per-frame work, no collision.
 */
export function scatterEnvironment(scene: THREE.Scene): void {
  for (const rule of SCATTER_RULES) {
    const gltf = AssetManager.get(rule.url);
    for (let i = 0; i < rule.count; i++) {
      const clone = gltf.scene.clone(true);
      const angle = Math.random() * Math.PI * 2;
      const dist = CLEAR_RADIUS + Math.random() * (MAX_RADIUS - CLEAR_RADIUS);
      clone.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      clone.rotation.y = Math.random() * Math.PI * 2;
      const minScale = rule.minScale ?? 0.9;
      const maxScale = rule.maxScale ?? 1.15;
      clone.scale.setScalar(minScale + Math.random() * (maxScale - minScale));
      scene.add(clone);
    }
  }

  // One fixed landmark rather than randomly scattered — reads as a point of interest, not clutter.
  const tank = AssetManager.get(ENV_MODEL_URLS.tank).scene.clone(true);
  tank.position.set(CLEAR_RADIUS + 6, 0, -(CLEAR_RADIUS + 10));
  tank.rotation.y = Math.PI * 0.2;
  scene.add(tank);
}
