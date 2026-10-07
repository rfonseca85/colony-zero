import * as THREE from 'three/webgpu';
import { WEAPON_NODE_NAMES, WeaponName } from '@/core/AssetManager';

const box = new THREE.Box3();
const size = new THREE.Vector3();
const WEAPON_NAME_SET: ReadonlySet<string> = new Set(WEAPON_NODE_NAMES);

/** Uniformly scales `root` so its current world-space bounding-box height becomes `targetHeight`. Call once, right after cloning — not per frame. */
export function scaleToHeight(root: THREE.Object3D, targetHeight: number): number {
  box.setFromObject(root);
  box.getSize(size);
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  root.scale.setScalar(scale);
  return scale;
}

/** The character rig ships every weapon pre-attached to the hand bone; equipping one is just hiding the rest. Pass `null` to hide all of them (bare-handed). Call once per spawn, not per frame. */
export function setActiveWeapon(root: THREE.Object3D, weapon: WeaponName | null): void {
  root.traverse((o) => {
    if (WEAPON_NAME_SET.has(o.name)) o.visible = o.name === weapon;
  });
}

/** Shifts `root` on Y so its current bounding-box bottom sits exactly on the ground plane. Call once after scaling, not per frame. */
export function groundAlign(root: THREE.Object3D): void {
  box.setFromObject(root);
  root.position.y -= box.min.y;
}
